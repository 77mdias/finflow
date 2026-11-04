/**
 * Seed de desenvolvimento: cria o usuário demo@finflow.local com cartões, assinaturas
 * e despesas parceladas, usando os próprios casos de uso (dados sempre consistentes).
 *
 *   pnpm db:seed            # recria o usuário demo
 *
 * Para entrar como ele, use o login por magic link com demo@finflow.local (Mailpit captura o e-mail).
 */
import "dotenv/config";

import { addDays, addMonthsTo, todayIn, type DateOnly } from "../src/shared/domain/date-only";
import { systemClock } from "../src/shared/infrastructure/clock";
import { prisma, transaction } from "../src/shared/infrastructure/db";
import { MemoryMailer } from "../src/shared/infrastructure/mailer";
import type { UseCaseContext, UserContext } from "../src/shared/application/context";

import { onUserCreated } from "../src/modules/accounts";
import { createCard } from "../src/modules/cards";
import { listCategories } from "../src/modules/categories";
import { createExpense } from "../src/modules/expenses";
import { registerPayment } from "../src/modules/invoices";
import { runDailyJob } from "../src/modules/jobs";
import { createSubscription } from "../src/modules/subscriptions";

const EMAIL = "demo@finflow.local";
const TZ = "America/Sao_Paulo";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed não deve rodar em produção.");
  const db = prisma();
  await db.user.deleteMany({ where: { email: EMAIL } });
  const created = await db.user.create({
    data: { email: EMAIL, name: "Ana Demo", emailVerified: true, timezone: TZ },
  });
  await transaction((tx) => onUserCreated(tx, created.id));
  await db.user.update({ where: { id: created.id }, data: { onboardingCompletedAt: new Date() } });

  const user: UserContext = { id: created.id, timezone: TZ, plan: "FREE" };
  const run = <T>(fn: (ctx: UseCaseContext) => Promise<T>) =>
    transaction((tx) => fn({ tx, user, clock: systemClock }));
  const today = todayIn(TZ);
  const cat = Object.fromEntries((await listCategories(db, user.id)).map((c) => [c.name, c.id]));
  const ago = (days: number): DateOnly => addDays(today, -days);

  const roxinho = await run((ctx) =>
    createCard(ctx, {
      nickname: "Roxinho",
      issuer: "Nubank",
      brand: "MASTERCARD",
      color: "violet",
      limit: 800_000n,
      closingDay: 25,
      dueDay: 5,
      last4: "1234",
    }),
  );
  const azul = await run((ctx) =>
    createCard(ctx, {
      nickname: "Azul Viagem",
      issuer: "Itaú",
      brand: "VISA",
      color: "blue",
      limit: 1_500_000n,
      closingDay: 3,
      dueDay: 10,
    }),
  );
  const loja = await run((ctx) =>
    createCard(ctx, { nickname: "Cartão da Loja", brand: "ELO", color: "amber", closingDay: 15, dueDay: 25 }),
  );

  const subs = [
    { name: "Netflix", amount: 5_590n, card: roxinho.id, cat: "Streaming", next: ago(70) },
    { name: "Spotify Família", amount: 3_490n, card: roxinho.id, cat: "Música", next: ago(65) },
    { name: "ChatGPT Plus", amount: 11_000n, card: azul.id, cat: "IA", next: ago(50) },
    { name: "iCloud 200 GB", amount: 1_490n, card: roxinho.id, cat: "Nuvem & Armazenamento", next: ago(40) },
    { name: "Academia", amount: 12_990n, card: azul.id, cat: "Saúde & Academia", next: ago(60) },
    { name: "Xbox Game Pass", amount: 5_999n, card: loja.id, cat: "Jogos", next: ago(20) },
  ] as const;
  for (const s of subs) {
    await run((ctx) =>
      createSubscription(ctx, {
        name: s.name,
        amount: s.amount,
        cycle: "MONTHLY",
        nextChargeDate: s.next,
        cardId: s.card,
        categoryId: cat[s.cat],
        status: "ACTIVE",
      }),
    );
  }
  await run((ctx) =>
    createSubscription(ctx, {
      name: "Duolingo Super",
      amount: 23_990n,
      cycle: "YEARLY",
      nextChargeDate: addMonthsTo(today, 4),
      cardId: roxinho.id,
      categoryId: cat["Educação"],
      status: "ACTIVE",
    }),
  );
  await run((ctx) =>
    createSubscription(ctx, {
      name: "Claude Pro",
      amount: 11_000n,
      cycle: "MONTHLY",
      cardId: azul.id,
      categoryId: cat["IA"],
      status: "TRIAL",
      trialEndsOn: addDays(today, 3),
    }),
  );

  await run((ctx) =>
    createExpense(ctx, {
      description: "Notebook",
      total: 480_000n,
      purchaseDate: ago(45),
      cardId: roxinho.id,
      categoryId: cat["Compras"],
      installments: 10,
    }),
  );
  await run((ctx) =>
    createExpense(ctx, {
      description: "Passagem aérea",
      total: 186_000n,
      purchaseDate: ago(12),
      cardId: azul.id,
      categoryId: cat["Transporte"],
      installments: 3,
    }),
  );
  await run((ctx) =>
    createExpense(ctx, {
      description: "Mercado",
      total: 42_315n,
      purchaseDate: ago(2),
      cardId: loja.id,
      categoryId: cat["Alimentação"],
      installments: 1,
    }),
  );

  const job = await runDailyJob({ db, clock: systemClock, mailer: new MemoryMailer() });
  // Faturas já vencidas aparecem pagas no vencimento, como num histórico real.
  for (const inv of await db.invoice.findMany({ where: { userId: user.id, status: "OVERDUE" } })) {
    const dueDate = inv.dueDate.toISOString().slice(0, 10) as DateOnly;
    await run((ctx) =>
      registerPayment(ctx, {
        invoiceId: inv.id,
        amountCents: inv.totalCents - inv.paidCents,
        paidOn: dueDate,
      }),
    );
  }
  const counts = await db.$transaction([
    db.card.count({ where: { userId: user.id } }),
    db.subscription.count({ where: { userId: user.id } }),
    db.charge.count({ where: { userId: user.id } }),
    db.invoice.count({ where: { userId: user.id } }),
  ]);
  console.log(
    `Seed concluído para ${EMAIL}: ${counts[0]} cartões, ${counts[1]} assinaturas, ${counts[2]} cobranças, ${counts[3]} faturas (job diário: ${job.status}).`,
  );
}

main()
  .then(() => prisma().$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma().$disconnect();
    process.exit(1);
  });
