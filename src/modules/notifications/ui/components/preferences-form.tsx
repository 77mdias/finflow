"use client";

import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";
import { describedBy, Field, FormError, MoneyInput } from "@/shared/ui/field";
import { decimal } from "@/shared/ui/format";
import { SavedNote } from "@/shared/ui/saved-note";

import type { NotificationPreferencesDTO } from "../../application/notifications";
import { updateNotificationPreferences } from "../actions";
import { ReminderRow } from "./reminder-row";

function Channel({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-body"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

/** Lembretes (FLOW_MAP §12, RF-060 a RF-064): canais, tipos e antecedência. */
export function PreferencesForm({ prefs }: { prefs: NotificationPreferencesDTO }) {
  const [v, setV] = useState({
    emailEnabled: prefs.emailEnabled,
    inAppEnabled: prefs.inAppEnabled,
    invoiceDue: prefs.invoiceDueEnabled,
    invoiceDays: String(prefs.invoiceDueDaysBefore),
    subscription: prefs.subscriptionDaysBefore !== null,
    subscriptionDays: String(prefs.subscriptionDaysBefore ?? 1),
    subscriptionMin: prefs.subscriptionMinCents > 0 ? decimal(prefs.subscriptionMinCents) : "",
    trialReminders: prefs.trialReminders,
    overdueAlerts: prefs.overdueAlerts,
    dailyDigest: prefs.dailyDigest,
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<typeof v>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };
  const toggle = (key: keyof typeof v) => (e: { target: { checked: boolean } }) =>
    update({ [key]: e.target.checked });
  const pick = (key: keyof typeof v) => (e: { target: { value: string } }) =>
    update({ [key]: e.target.value });
  const minError = errors.subscriptionMin?.[0];
  const noChannel = !v.emailEnabled && !v.inAppEnabled;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await updateNotificationPreferences({
      emailEnabled: v.emailEnabled,
      inAppEnabled: v.inAppEnabled,
      invoiceDueEnabled: v.invoiceDue,
      invoiceDueDaysBefore: Number(v.invoiceDays),
      subscriptionDaysBefore: v.subscription ? Number(v.subscriptionDays) : null,
      subscriptionMin: v.subscriptionMin.trim() || "0",
      trialReminders: v.trialReminders,
      overdueAlerts: v.overdueAlerts,
      dailyDigest: v.dailyDigest,
    });
    setBusy(false);
    if (res.ok) return setSaved(true);
    setErrors(res.error.fieldErrors ?? {});
    setMessage(res.error.code === "VALIDATION_ERROR" ? null : res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-label">Onde avisar</legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Channel
            id="canal-email"
            label="Por e-mail"
            checked={v.emailEnabled}
            onChange={(c) => update({ emailEnabled: c })}
          />
          <Channel
            id="canal-app"
            label="Aqui no app"
            checked={v.inAppEnabled}
            onChange={(c) => update({ inAppEnabled: c })}
          />
        </div>
        {noChannel && (
          <p className="mt-2 text-body-sm text-status-warning-fg">
            Com os dois desligados, você não recebe nenhum lembrete.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-label">O que avisar</legend>
        <ul className="mt-2 flex flex-col gap-3">
          <ReminderRow
            id="pref-fatura"
            label="Vencimento da fatura"
            hint="Para pagar sem atraso."
            checked={v.invoiceDue}
            onCheck={toggle("invoiceDue")}
            days={v.invoiceDays}
            onDays={pick("invoiceDays")}
          />
          <ReminderRow
            id="pref-assinatura"
            label="Cobrança de assinatura"
            hint="Dá tempo de cancelar o que não usa."
            checked={v.subscription}
            onCheck={toggle("subscription")}
            days={v.subscriptionDays}
            onDays={pick("subscriptionDays")}
          />
          <ReminderRow
            id="pref-teste"
            label="Fim do período de teste"
            hint="Antes de o teste virar cobrança."
            checked={v.trialReminders}
            onCheck={toggle("trialReminders")}
          />
          <ReminderRow
            id="pref-vencida"
            label="Fatura vencida"
            hint="Se o vencimento passar sem pagamento registrado."
            checked={v.overdueAlerts}
            onCheck={toggle("overdueAlerts")}
          />
          <ReminderRow
            id="pref-resumo"
            label="Resumo diário por e-mail"
            hint="Junta os avisos do dia em um e-mail só."
            checked={v.dailyDigest}
            onCheck={toggle("dailyDigest")}
          />
        </ul>
      </fieldset>

      {v.subscription && (
        <div className="sm:max-w-xs">
          <Field
            id="pref-minimo"
            label="Avisar cobranças a partir de"
            error={minError}
            hint="Deixe vazio para avisar todas."
          >
            <MoneyInput
              {...describedBy("pref-minimo", minError, "Deixe vazio para avisar todas.")}
              value={v.subscriptionMin}
              onChange={pick("subscriptionMin")}
            />
          </Field>
        </div>
      )}

      {message && <FormError>{message}</FormError>}
      <div className="flex items-center justify-end gap-3">
        <SavedNote show={saved} />
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Salvar lembretes
        </button>
      </div>
    </form>
  );
}
