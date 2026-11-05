import { z } from "zod";

import type { Card, Expense, Prisma } from "@/generated/prisma/client";
import { assertNotStale } from "@/shared/application/concurrency";
import { type QueryContext, type UseCaseContext, todayOf } from "@/shared/application/context";
import { day, iso, n } from "@/shared/application/dto";
import {
  ClientRequestId,
  DateOnlyInput,
  ExpectedUpdatedAt,
  Id,
  MoneyInput,
  OptionalText,
} from "@/shared/application/schemas";
import {
  addYearMonths,
  fromDbDate,
  toDbDate,
  type DateOnly,
  type YearMonth,
} from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";
import type { Tx } from "@/shared/infrastructure/db";

import { assertOwnCategory } from "@/modules/categories";
import { postCharge, removeCharges } from "@/modules/invoices";

import { installmentDescription, MAX_INSTALLMENTS, splitInstallments } from "../domain/installments";

export const CreateExpenseSchema = z.object({
  description: z.string().trim().min(1, "Informe uma descrição").max(120),
  total: MoneyInput,
  purchaseDate: DateOnlyInput,
  cardId: Id,
  categoryId: Id.optional(),
  installments: z.int().min(1).max(MAX_INSTALLMENTS).default(1),
  notes: OptionalText(2000),
  clientRequestId: ClientRequestId,
});

export const UpdateExpenseSchema = z.object({
  id: Id,
  expectedUpdatedAt: ExpectedUpdatedAt,
  description: z.string().trim().min(1).max(120).optional(),
  total: MoneyInput.optional(),
  purchaseDate: DateOnlyInput.optional(),
  cardId: Id.optional(),
  categoryId: Id.nullable().optional(),
  installments: z.int().min(1).max(MAX_INSTALLMENTS).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const DeleteExpenseSchema = z.object({ id: Id, confirmClosedInvoices: z.boolean().optional() });

export interface ExpenseDTO {
  id: string;
  description: string;
  totalCents: number;
  installments: number;
  purchaseDate: string;
  cardId: string;
  categoryId: string | null;
  notes: string | null;
  updatedAt: string;
  schedule: {
    number: number;
    date: string;
    referenceMonth: string;
    amountCents: number;
    invoiceStatus: string;
  }[];
}

async function activeCard(tx: Tx, userId: string, cardId: string): Promise<Card> {
  const card = await tx.card.findFirst({ where: { id: cardId, userId } });
  if (!card) throw AppError.notFound("Cartão");
  if (card.archivedAt) throw new AppError("CARD_ARCHIVED", "Este cartão está arquivado.");
  return card;
}

/** RN-10: lança todas as parcelas, cada uma na fatura correspondente. */
async function postInstallments(tx: Tx, expense: Expense, card: Card, today: DateOnly) {
  for (const p of splitInstallments(
    expense.totalCents,
    expense.installments,
    fromDbDate(expense.purchaseDate),
    card,
  )) {
    await postCharge(
      tx,
      {
        card,
        chargeDate: p.date,
        period: p.invoice,
        sourceType: "INSTALLMENT",
        expenseId: expense.id,
        installmentNumber: p.number,
        installmentTotal: p.total,
        description: installmentDescription(expense.description, p.number, p.total),
        amountCents: p.amountCents,
        categoryId: expense.categoryId,
      },
      today,
    );
  }
}

const SCHEDULE = {
  include: { invoice: { select: { referenceMonth: true, status: true } } },
  orderBy: { installmentNumber: "asc" },
} as const;

type ScheduledCharge = Prisma.ChargeGetPayload<typeof SCHEDULE>;

function toDTO(e: Expense, charges: readonly ScheduledCharge[]): ExpenseDTO {
  return {
    id: e.id,
    description: e.description,
    totalCents: n(e.totalCents),
    installments: e.installments,
    purchaseDate: day(e.purchaseDate),
    cardId: e.cardId,
    categoryId: e.categoryId,
    notes: e.notes,
    updatedAt: iso(e.updatedAt),
    schedule: charges.map((c) => ({
      number: c.installmentNumber ?? 1,
      date: day(c.chargeDate),
      referenceMonth: c.invoice.referenceMonth,
      amountCents: n(c.amountCents),
      invoiceStatus: c.invoice.status,
    })),
  };
}

async function toExpenseDTO(tx: Tx | QueryContext["db"], e: Expense): Promise<ExpenseDTO> {
  return toDTO(e, await tx.charge.findMany({ where: { expenseId: e.id }, ...SCHEDULE }));
}

/** RF-030 / RF-031 */
export async function createExpense(
  ctx: UseCaseContext,
  input: z.infer<typeof CreateExpenseSchema>,
): Promise<ExpenseDTO> {
  const card = await activeCard(ctx.tx, ctx.user.id, input.cardId);
  await assertOwnCategory(ctx.tx, ctx.user.id, input.categoryId);
  const expense = await ctx.tx.expense.create({
    data: {
      userId: ctx.user.id,
      cardId: card.id,
      categoryId: input.categoryId ?? null,
      description: input.description,
      totalCents: input.total,
      installments: input.installments,
      purchaseDate: toDbDate(input.purchaseDate),
      notes: input.notes ?? null,
    },
  });
  await postInstallments(ctx.tx, expense, card, todayOf(ctx));
  return toExpenseDTO(ctx.tx, expense);
}

async function lockedInstallments(tx: Tx, expenseId: string): Promise<number> {
  return tx.charge.count({ where: { expenseId, invoice: { status: { not: "OPEN" } } } });
}

/** RF-032: campos financeiros só mudam se nenhuma parcela estiver em fatura fechada. */
export async function updateExpense(
  ctx: UseCaseContext,
  input: z.infer<typeof UpdateExpenseSchema>,
): Promise<ExpenseDTO> {
  const e = await ctx.tx.expense.findFirst({ where: { id: input.id, userId: ctx.user.id } });
  if (!e) throw AppError.notFound("Despesa");
  assertNotStale(e.updatedAt, input.expectedUpdatedAt);
  if (input.categoryId) await assertOwnCategory(ctx.tx, ctx.user.id, input.categoryId);

  const financial =
    (input.total !== undefined && input.total !== e.totalCents) ||
    (input.purchaseDate !== undefined && input.purchaseDate !== fromDbDate(e.purchaseDate)) ||
    (input.cardId !== undefined && input.cardId !== e.cardId) ||
    (input.installments !== undefined && input.installments !== e.installments);
  const regenerate = financial || input.description !== undefined || input.categoryId !== undefined;

  if (financial && (await lockedInstallments(ctx.tx, e.id)) > 0) {
    throw new AppError("INVOICE_LOCKED", "Há parcelas em faturas fechadas. Lance um ajuste na fatura.");
  }
  const card = await activeCard(ctx.tx, ctx.user.id, input.cardId ?? e.cardId);
  const updated = await ctx.tx.expense.update({
    where: { id: e.id },
    data: {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.total !== undefined ? { totalCents: input.total } : {}),
      ...(input.purchaseDate !== undefined ? { purchaseDate: toDbDate(input.purchaseDate) } : {}),
      ...(input.cardId !== undefined ? { cardId: input.cardId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.installments !== undefined ? { installments: input.installments } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
  const today = todayOf(ctx);
  if (financial) {
    await removeCharges(ctx.tx, { userId: ctx.user.id, expenseId: e.id }, today);
    await postInstallments(ctx.tx, updated, card, today);
  } else if (regenerate) {
    // Descrição/categoria: atualiza o snapshot apenas nas parcelas de faturas abertas.
    const open = await ctx.tx.charge.findMany({ where: { expenseId: e.id, invoice: { status: "OPEN" } } });
    for (const c of open) {
      await ctx.tx.charge.update({
        where: { id: c.id },
        data: {
          description: installmentDescription(
            updated.description,
            c.installmentNumber ?? 1,
            c.installmentTotal ?? 1,
          ),
          categoryId: updated.categoryId,
        },
      });
    }
  }
  return toExpenseDTO(ctx.tx, updated);
}

/** RF-033 */
export async function deleteExpense(ctx: UseCaseContext, input: z.infer<typeof DeleteExpenseSchema>) {
  const e = await ctx.tx.expense.findFirst({ where: { id: input.id, userId: ctx.user.id } });
  if (!e) throw AppError.notFound("Despesa");
  if (!input.confirmClosedInvoices && (await lockedInstallments(ctx.tx, e.id)) > 0) {
    throw new AppError(
      "INVOICE_LOCKED",
      "Há parcelas em faturas fechadas. Confirme para removê-las mesmo assim.",
    );
  }
  const affected = await removeCharges(ctx.tx, { userId: ctx.user.id, expenseId: e.id }, todayOf(ctx));
  await ctx.tx.expense.delete({ where: { id: e.id } });
  return { deleted: true, affectedInvoices: affected };
}

/** RF-033: despesas por data da compra (mais recentes primeiro), opcionalmente de um mês e cartão. */
export async function listExpenses(
  ctx: QueryContext,
  filters: { cardId?: string; month?: YearMonth } = {},
): Promise<ExpenseDTO[]> {
  const rows = await ctx.db.expense.findMany({
    where: {
      userId: ctx.user.id,
      ...(filters.cardId ? { cardId: filters.cardId } : {}),
      ...(filters.month
        ? {
            purchaseDate: {
              gte: toDbDate(`${filters.month}-01` as DateOnly),
              lt: toDbDate(`${addYearMonths(filters.month, 1)}-01` as DateOnly),
            },
          }
        : {}),
    },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  // Uma consulta para todas as parcelas, em vez de uma por despesa.
  const charges = await ctx.db.charge.findMany({
    where: { expenseId: { in: rows.map((e) => e.id) } },
    ...SCHEDULE,
  });
  return rows.map((e) =>
    toDTO(
      e,
      charges.filter((c) => c.expenseId === e.id),
    ),
  );
}
