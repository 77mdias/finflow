import { z } from "zod";

import { DateOnlyInput, Id, MoneyInput, OptionalText, SignedMoneyInput } from "@/shared/application/schemas";

export const RegisterPaymentSchema = z.object({
  invoiceId: Id,
  amount: MoneyInput,
  paidOn: DateOnlyInput,
  note: OptionalText(200),
});

export const DeletePaymentSchema = z.object({ paymentId: Id });

export const CreateAdjustmentSchema = z.object({
  invoiceId: Id,
  amount: SignedMoneyInput,
  description: z.string().trim().min(1, "Informe uma descrição").max(160),
  categoryId: Id.optional(),
});

export const DeleteAdjustmentSchema = z.object({ chargeId: Id });

export const OverrideInvoiceDatesSchema = z.object({
  invoiceId: Id,
  closingDate: DateOnlyInput,
  dueDate: DateOnlyInput,
});

export const InvoiceIdSchema = z.object({ invoiceId: Id });
