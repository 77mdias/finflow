"use server";

import { z } from "zod";

import { env } from "@/shared/config/env";
import { mailer } from "@/shared/infrastructure/mailer";
import { action } from "@/shared/ui/action";

import { accountDeletionEmail } from "@/modules/notifications";

import * as uc from "../application/accounts";

export const updateProfile = action({
  name: "accounts.updateProfile",
  schema: uc.UpdateProfileSchema,
  revalidate: ["profile", "dashboard"],
  handler: uc.updateProfile,
});
export const completeOnboarding = action({
  name: "accounts.completeOnboarding",
  schema: z.object({}),
  revalidate: ["profile"],
  handler: (ctx) => uc.completeOnboarding(ctx),
});
export const requestAccountDeletion = action({
  name: "accounts.requestDeletion",
  schema: uc.RequestDeletionSchema,
  revalidate: ["profile"],
  handler: uc.requestAccountDeletion,
  afterCommit: async (r) => {
    await mailer().send(
      accountDeletionEmail({ to: r.email, appUrl: env().NEXT_PUBLIC_APP_URL, purgeAfter: r.purgeAfter }),
    );
  },
});
export const reactivateAccount = action({
  name: "accounts.reactivate",
  schema: z.object({}),
  allowDeleted: true,
  revalidate: ["profile"],
  handler: (ctx) => uc.reactivateAccount(ctx),
});
