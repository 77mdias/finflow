"use server";

import { action } from "@/shared/ui/action";

import * as s from "../application/schemas";
import * as uc from "../application/subscriptions";

const areas = ["subscriptions", "invoices", "dashboard"] as const;

export const createSubscription = action({
  name: "subscriptions.create",
  schema: s.CreateSubscriptionSchema,
  revalidate: [...areas],
  handler: uc.createSubscription,
});
export const updateSubscription = action({
  name: "subscriptions.update",
  schema: s.UpdateSubscriptionSchema,
  revalidate: [...areas],
  handler: uc.updateSubscription,
});
export const changeSubscriptionPrice = action({
  name: "subscriptions.changePrice",
  schema: s.ChangePriceSchema,
  revalidate: [...areas],
  handler: uc.changeSubscriptionPrice,
});
export const changeSubscriptionCard = action({
  name: "subscriptions.changeCard",
  schema: s.ChangeCardSchema,
  revalidate: [...areas],
  handler: uc.changeSubscriptionCard,
});
export const pauseSubscription = action({
  name: "subscriptions.pause",
  schema: s.SubscriptionIdSchema,
  revalidate: [...areas],
  handler: uc.pauseSubscription,
});
export const resumeSubscription = action({
  name: "subscriptions.resume",
  schema: s.ResumeSchema,
  revalidate: [...areas],
  handler: uc.resumeSubscription,
});
export const cancelSubscription = action({
  name: "subscriptions.cancel",
  schema: s.CancelSchema,
  revalidate: [...areas],
  handler: uc.cancelSubscription,
});
export const duplicateSubscription = action({
  name: "subscriptions.duplicate",
  schema: s.SubscriptionIdSchema,
  revalidate: [...areas],
  handler: uc.duplicateSubscription,
});
export const deleteSubscription = action({
  name: "subscriptions.delete",
  schema: s.SubscriptionIdSchema,
  revalidate: [...areas],
  handler: uc.deleteSubscription,
});
