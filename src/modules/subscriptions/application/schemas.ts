import { z } from "zod";

import { BillingCycle } from "@/generated/prisma/enums";
import {
  ClientRequestId,
  DateOnlyInput,
  ExpectedUpdatedAt,
  Id,
  MoneyInput,
  OptionalText,
} from "@/shared/application/schemas";

const Cycle = z.enum(Object.values(BillingCycle) as [BillingCycle, ...BillingCycle[]]);
const ManageUrl = z.url({ protocol: /^https?$/, message: "URL inválida" }).max(500);

export const CreateSubscriptionSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome").max(80),
    amount: MoneyInput,
    cycle: Cycle.default("MONTHLY"),
    /** Para TRIAL, padrão = fim do teste. */
    nextChargeDate: DateOnlyInput.optional(),
    cardId: Id,
    categoryId: Id.optional(),
    status: z.enum(["ACTIVE", "TRIAL"]).default("ACTIVE"),
    trialEndsOn: DateOnlyInput.optional(),
    manageUrl: ManageUrl.optional(),
    notes: OptionalText(2000),
    catalogSlug: z.string().max(60).optional(),
    clientRequestId: ClientRequestId,
  })
  .refine((s) => s.status !== "TRIAL" || !!s.trialEndsOn, {
    path: ["trialEndsOn"],
    message: "Informe o fim do teste",
  })
  .refine((s) => s.status === "TRIAL" || !!s.nextChargeDate, {
    path: ["nextChargeDate"],
    message: "Informe a próxima cobrança",
  });

export const UpdateSubscriptionSchema = z.object({
  id: Id,
  expectedUpdatedAt: ExpectedUpdatedAt,
  name: z.string().trim().min(1, "Informe um nome").max(80).optional(),
  categoryId: Id.nullable().optional(),
  cycle: Cycle.optional(),
  nextChargeDate: DateOnlyInput.optional(),
  manageUrl: ManageUrl.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const ChangePriceSchema = z.object({ id: Id, amount: MoneyInput, effectiveFrom: DateOnlyInput });
export const ChangeCardSchema = z.object({ id: Id, cardId: Id });
export const SubscriptionIdSchema = z.object({ id: Id });
export const ResumeSchema = z.object({ id: Id, nextChargeDate: DateOnlyInput });
export const CancelSchema = z.object({ id: Id, effectiveOn: DateOnlyInput });

export const ListSubscriptionsSchema = z.object({
  status: z.enum(["TRIAL", "ACTIVE", "PAUSED", "CANCELED"]).optional(),
  cardId: Id.optional(),
  categoryId: Id.optional(),
  sort: z.enum(["name", "amount", "nextCharge"]).default("nextCharge"),
});
