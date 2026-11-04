"use server";

import { action } from "@/shared/ui/action";

import * as uc from "../application/expenses";

const areas = ["expenses", "invoices", "cards", "dashboard"] as const;

export const createExpense = action({
  name: "expenses.create",
  schema: uc.CreateExpenseSchema,
  revalidate: [...areas],
  handler: uc.createExpense,
});
export const updateExpense = action({
  name: "expenses.update",
  schema: uc.UpdateExpenseSchema,
  revalidate: [...areas],
  handler: uc.updateExpense,
});
export const deleteExpense = action({
  name: "expenses.delete",
  schema: uc.DeleteExpenseSchema,
  revalidate: [...areas],
  handler: uc.deleteExpense,
});
