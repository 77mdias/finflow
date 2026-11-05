import { describe, expect, it } from "vitest";

import { reactivateAccount, requestAccountDeletion } from "@/modules/accounts";
import {
  getNotificationPreferences,
  UpdatePreferencesSchema,
  updateNotificationPreferences,
} from "@/modules/notifications";

import { at, makeUser, queryCtx, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();

describe("preferências de lembrete (Configurações)", () => {
  it("salva o mínimo de cobrança e volta a zero (avisar todas)", async () => {
    const ana = await makeUser();
    const save = (input: unknown) =>
      run(ana, at("2026-11-05"), (ctx) =>
        updateNotificationPreferences(ctx, UpdatePreferencesSchema.parse(input)),
      );

    expect((await save({ subscriptionMin: "20,00", subscriptionDaysBefore: 2 })).subscriptionMinCents).toBe(
      2_000,
    );
    const reset = await save({ subscriptionMin: "0", emailEnabled: false });
    expect(reset).toMatchObject({ subscriptionMinCents: 0, subscriptionDaysBefore: 2, emailEnabled: false });
    expect(await getNotificationPreferences(queryCtx(ana, at("2026-11-05")))).toEqual(reset);
  });

  it("recusa mínimo negativo", () => {
    expect(UpdatePreferencesSchema.safeParse({ subscriptionMin: "-1,00" }).success).toBe(false);
  });
});

describe("reativação de conta (RF-007)", () => {
  it("reativa dentro dos 30 dias e recusa depois do prazo", async () => {
    const ana = await makeUser();
    await run(ana, at("2026-11-05"), (ctx) => requestAccountDeletion(ctx, { confirmEmail: ana.email }));
    const back = await run(ana, at("2026-12-04"), (ctx) => reactivateAccount(ctx));
    expect(back.deletionRequestedAt).toBeNull();

    await run(ana, at("2026-11-05"), (ctx) => requestAccountDeletion(ctx, { confirmEmail: ana.email }));
    await expect(run(ana, at("2026-12-05"), (ctx) => reactivateAccount(ctx))).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
    });
  });
});
