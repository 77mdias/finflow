"use server";

import { z } from "zod";

import { action } from "@/shared/ui/action";

import * as uc from "../application/notifications";

export const markNotificationRead = action({
  name: "notifications.markRead",
  schema: uc.NotificationIdSchema,
  revalidate: ["notifications"],
  handler: uc.markNotificationRead,
});
export const markAllNotificationsRead = action({
  name: "notifications.markAllRead",
  schema: z.object({}),
  revalidate: ["notifications"],
  handler: (ctx) => uc.markAllNotificationsRead(ctx),
});
export const updateNotificationPreferences = action({
  name: "notifications.updatePreferences",
  schema: uc.UpdatePreferencesSchema,
  revalidate: ["profile"],
  handler: uc.updateNotificationPreferences,
});
