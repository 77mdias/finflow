"use server";

import { action } from "@/shared/ui/action";

import * as uc from "../application/payments";
import * as s from "../application/schemas";

const areas = ["invoices", "cards", "dashboard"] as const;

export const registerPayment = action({
  name: "invoices.registerPayment",
  schema: s.RegisterPaymentSchema,
  revalidate: [...areas],
  handler: (ctx, { amount, ...input }) => uc.registerPayment(ctx, { ...input, amountCents: amount }),
});
export const deletePayment = action({
  name: "invoices.deletePayment",
  schema: s.DeletePaymentSchema,
  revalidate: [...areas],
  handler: uc.deletePayment,
});
export const createAdjustment = action({
  name: "invoices.createAdjustment",
  schema: s.CreateAdjustmentSchema,
  revalidate: [...areas],
  handler: (ctx, { amount, ...input }) => uc.createAdjustment(ctx, { ...input, amountCents: amount }),
});
export const deleteAdjustment = action({
  name: "invoices.deleteAdjustment",
  schema: s.DeleteAdjustmentSchema,
  revalidate: [...areas],
  handler: uc.deleteAdjustment,
});
export const overrideInvoiceDates = action({
  name: "invoices.overrideDates",
  schema: s.OverrideInvoiceDatesSchema,
  revalidate: [...areas],
  handler: uc.overrideInvoiceDates,
});
export const resetInvoiceDates = action({
  name: "invoices.resetDates",
  schema: s.InvoiceIdSchema,
  revalidate: [...areas],
  handler: uc.resetInvoiceDates,
});
