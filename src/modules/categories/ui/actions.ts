"use server";

import { action } from "@/shared/ui/action";

import * as uc from "../application/categories";

const areas = ["categories", "subscriptions", "invoices", "dashboard"] as const;

export const createCategory = action({
  name: "categories.create",
  schema: uc.CreateCategorySchema,
  revalidate: ["categories"],
  handler: uc.createCategory,
});
export const updateCategory = action({
  name: "categories.update",
  schema: uc.UpdateCategorySchema,
  revalidate: [...areas],
  handler: uc.updateCategory,
});
export const deleteCategory = action({
  name: "categories.delete",
  schema: uc.DeleteCategorySchema,
  revalidate: [...areas],
  handler: uc.deleteCategory,
});
