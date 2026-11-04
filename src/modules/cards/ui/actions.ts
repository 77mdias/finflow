"use server";

import { action } from "@/shared/ui/action";

import * as uc from "../application/cards";

const areas = ["cards", "invoices", "dashboard"] as const;

export const createCard = action({
  name: "cards.create",
  schema: uc.CreateCardSchema,
  revalidate: [...areas],
  handler: uc.createCard,
});
export const updateCard = action({
  name: "cards.update",
  schema: uc.UpdateCardSchema,
  revalidate: [...areas],
  handler: uc.updateCard,
});
export const setDefaultCard = action({
  name: "cards.setDefault",
  schema: uc.CardIdSchema,
  revalidate: ["cards"],
  handler: uc.setDefaultCard,
});
export const archiveCard = action({
  name: "cards.archive",
  schema: uc.ArchiveCardSchema,
  revalidate: [...areas, "subscriptions"],
  handler: uc.archiveCard,
});
export const unarchiveCard = action({
  name: "cards.unarchive",
  schema: uc.CardIdSchema,
  revalidate: [...areas],
  handler: uc.unarchiveCard,
});
export const deleteCard = action({
  name: "cards.delete",
  schema: uc.CardIdSchema,
  revalidate: [...areas],
  handler: uc.deleteCard,
});
