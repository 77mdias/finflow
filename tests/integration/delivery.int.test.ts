import { randomBytes } from "node:crypto";

import { Webhook } from "svix";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }));

import { updateTag } from "next/cache";

import { setSessionProvider, type SessionUser } from "@/lib/session";
import { resetEnvCache } from "@/shared/config/env";
import { fixedClock } from "@/shared/infrastructure/clock";
import { setActionClock } from "@/shared/ui/action";

import { GET as cronDaily } from "@/app/api/cron/daily/route";
import { GET as exportRoute } from "@/app/api/export/route";
import { GET as health } from "@/app/api/health/route";
import { POST as unsubscribe } from "@/app/api/unsubscribe/route";
import { POST as resendWebhook } from "@/app/api/webhooks/resend/route";
import { requestAccountDeletion } from "@/modules/accounts/ui/actions";
import { createCard, deleteCard } from "@/modules/cards/ui/actions";
import { registerPayment } from "@/modules/invoices/ui/actions";
import { createUnsubscribeToken } from "@/modules/notifications";

import { at, db, mail, makeUser, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();

const WEBHOOK_SECRET = `whsec_${randomBytes(24).toString("base64")}`;
let current: SessionUser | null = null;

beforeAll(() => {
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  resetEnvCache();
  setSessionProvider(async () => current);
  setActionClock(fixedClock(at("2026-11-04")));
});
afterEach(() => {
  current = null;
});

async function login() {
  const u = await makeUser();
  current = { ...u, deletedAt: null, onboardingCompletedAt: new Date() };
  return u;
}

describe("Server Actions (wrapper action())", () => {
  it("exige sessão", async () => {
    const r = await createCard({ nickname: "X", closingDay: 1, dueDay: 10 });
    expect(r).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("valida entrada com fieldErrors, cria e revalida tags, serializa bigint", async () => {
    const u = await login();
    const bad = await createCard({ nickname: "", closingDay: 32, dueDay: 10, last4: "12a4" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(bad.error.fieldErrors ?? {}).sort()).toEqual(["closingDay", "last4", "nickname"]);
      expect(bad.error.requestId).toMatch(/[0-9a-f-]{36}/);
    }
    const ok = await createCard({ nickname: "Roxinho", closingDay: 25, dueDay: 5, limit: "5.000,00" });
    expect(ok).toMatchObject({
      ok: true,
      data: { nickname: "Roxinho", limitCents: 500_000, isDefault: true },
    });
    expect(updateTag).toHaveBeenCalledWith(`user:${u.id}:cards`);
  });

  it("erros de domínio viram código estável; recurso alheio é NOT_FOUND", async () => {
    await login();
    const card = await createCard({ nickname: "A", closingDay: 25, dueDay: 5 });
    if (!card.ok) throw new Error("setup");
    const inv = await db.invoice.findFirstOrThrow({ where: { cardId: card.data.id } });
    const pay = await registerPayment({ invoiceId: inv.id, amount: "10,00", paidOn: "2026-11-04" });
    expect(pay).toMatchObject({ ok: false, error: { code: "PAYMENT_EXCEEDS_BALANCE" } });

    await login(); // outro usuário
    expect(await deleteCard({ id: card.data.id })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("exclusão de conta envia e-mail após o commit e bloqueia novas ações", async () => {
    const u = await login();
    const r = await requestAccountDeletion({ confirmEmail: u.email });
    expect(r).toMatchObject({ ok: true, data: { purgeAfter: "2026-12-04" } });
    expect(mail.sent.map((m) => m.subject)).toEqual(["Sua conta do FinFlow será excluída em 30 dias"]);
    current = { ...current!, deletedAt: new Date() };
    expect(await createCard({ nickname: "X", closingDay: 1, dueDay: 10 })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });
});

describe("rotas HTTP", () => {
  it("GET /api/health", async () => {
    const res = await health(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", db: "ok" });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("cron exige Bearer CRON_SECRET e devolve JobRunResult", async () => {
    const denied = await cronDaily(
      new Request("http://localhost/api/cron/daily", { headers: { authorization: "Bearer errado" } }),
    );
    expect(denied.status).toBe(401);
    expect((await denied.json()).error.code).toBe("UNAUTHENTICATED");
    const ok = await cronDaily(
      new Request("http://localhost/api/cron/daily", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ job: "DAILY", status: "SUCCEEDED" });
  });

  it("POST /api/unsubscribe aplica token válido e recusa inválido", async () => {
    const u = await makeUser();
    const token = createUnsubscribeToken(u.id, "TRIAL_ENDING");
    const res = await unsubscribe(
      new Request(`http://localhost/api/unsubscribe?token=${token}`, { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unsubscribed: "TRIAL_ENDING" });
    expect(
      (await db.notificationPreference.findUniqueOrThrow({ where: { userId: u.id } })).trialReminders,
    ).toBe(false);
    const bad = await unsubscribe(
      new Request("http://localhost/api/unsubscribe?token=abc.def", { method: "POST" }),
    );
    expect(bad.status).toBe(422);
  });

  it("POST /api/webhooks/resend verifica assinatura Svix", async () => {
    const u = await makeUser();
    const body = JSON.stringify({
      type: "email.complained",
      created_at: new Date().toISOString(),
      data: { email_id: "e1", to: [u.email] },
    });
    const id = "msg_test_1";
    const ts = new Date();
    const signature = new Webhook(WEBHOOK_SECRET).sign(id, ts, body);
    const headers = {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(ts.getTime() / 1000)),
      "svix-signature": signature,
    };

    const forged = await resendWebhook(
      new Request("http://localhost/api/webhooks/resend", {
        method: "POST",
        body,
        headers: { ...headers, "svix-signature": "v1,AAAA" },
      }),
    );
    expect(forged.status).toBe(401);

    const res = await resendWebhook(
      new Request("http://localhost/api/webhooks/resend", { method: "POST", body, headers }),
    );
    expect(res.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailSuppressedAt).not.toBeNull();
  });

  it("GET /api/export exige sessão e devolve anexo JSON", async () => {
    expect((await exportRoute(new Request("http://localhost/api/export"))).status).toBe(401);
    await login();
    const res = await exportRoute(new Request("http://localhost/api/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="finflow-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect((await res.json()).schemaVersion).toBe(1);
  });
});
