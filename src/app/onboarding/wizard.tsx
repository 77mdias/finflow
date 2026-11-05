"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { button } from "@/shared/ui/button";
import { DialogActions } from "@/shared/ui/dialog";
import { FIELD, FormError } from "@/shared/ui/field";
import { brl } from "@/shared/ui/format";

import { completeOnboarding } from "@/modules/accounts/ui/actions";
import { CardForm } from "@/modules/cards/ui/components/card-form";
import type { NotificationPreferencesDTO } from "@/modules/notifications";
import { updateNotificationPreferences } from "@/modules/notifications/ui/actions";
import { ServiceAvatar } from "@/modules/subscriptions/ui/components/subscription-bits";
import { SubscriptionForm } from "@/modules/subscriptions/ui/components/subscription-form";

interface Option {
  id: string;
  name: string;
}

type Step = 1 | 2 | 3;

const STEPS: Record<Step, { name: string; title: string; description: string }> = {
  1: {
    name: "Cartão",
    title: "Seu primeiro cartão",
    description:
      "Só o apelido, a cor e os dias de fechamento e vencimento. O FinFlow nunca pede o número do cartão.",
  },
  2: {
    name: "Assinaturas",
    title: "Suas assinaturas",
    description: "Adicione as que você paga hoje, uma de cada vez. Dá para incluir outras depois.",
  },
  3: {
    name: "Lembretes",
    title: "Lembretes",
    description: "Escolha quando o FinFlow deve avisar. Dá para mudar isso depois.",
  },
};

/**
 * Os 3 passos do onboarding. Cartões e assinaturas vêm do servidor: cada ação salva atualiza a
 * página, e o passo atual fica no estado do cliente.
 */
export function Wizard({
  cards,
  categories,
  subscriptions,
  prefs,
  today,
}: {
  cards: Option[];
  categories: Option[];
  subscriptions: { id: string; name: string; monthlyCents: number }[];
  prefs: NotificationPreferencesDTO;
  today: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [notice, setNotice] = useState<string | null>(null);
  // Cada assinatura salva remonta o formulário vazio para a próxima.
  const [round, setRound] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(step);

  useEffect(() => {
    // Ao trocar de passo, o foco vai para o título novo (leitor de tela anuncia onde está).
    if (shown.current !== step) heading.current?.focus();
    shown.current = step;
  }, [step]);
  useEffect(() => {
    if (round > 0) document.getElementById("assinatura-nome")?.focus();
  }, [round]);

  const go = (next: Step) => {
    if (next !== 2) setNotice(null);
    setStep(next);
  };
  const { name, title, description } = STEPS[step];
  const monthly = subscriptions.reduce((sum, s) => sum + s.monthlyCents, 0);

  return (
    <>
      <div className="mt-10">
        <p className="text-label text-fg-muted">
          Passo {step} de 3 · {name}
        </p>
        <div aria-hidden className="mt-2 grid grid-cols-3 gap-1.5">
          {([1, 2, 3] as const).map((i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-colors duration-200 ${i <= step ? "bg-primary" : "bg-surface-muted"}`}
            />
          ))}
        </div>
      </div>

      <section
        aria-labelledby="onboarding-titulo"
        className="mt-6 rounded-xl bg-surface p-6 shadow-hairline sm:p-8"
      >
        <h1
          id="onboarding-titulo"
          ref={heading}
          tabIndex={-1}
          className="font-display text-heading focus:outline-none"
        >
          {title}
        </h1>
        <p className="mt-1 text-body-sm text-fg-muted">{description}</p>
        <div aria-live="polite">
          {notice && (
            <p className="mt-4 flex items-center gap-2 rounded-md bg-status-positive px-3 py-2 text-body-sm text-status-positive-fg">
              <Check aria-hidden size={16} strokeWidth={2} />
              {notice}
            </p>
          )}
        </div>

        <div className="mt-6">
          {step === 1 && <CardForm cancelLabel="Pular" onSaved={setNotice} onDone={() => go(2)} />}

          {step === 2 && (
            <>
              {subscriptions.length > 0 && (
                <div className="mb-6">
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {subscriptions.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                        <ServiceAvatar name={s.name} />
                        <span className="min-w-0 flex-1 truncate text-body">{s.name}</span>
                        <span className="text-body-sm text-fg-muted tabular-nums">
                          {brl(s.monthlyCents)}/mês
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-body-sm text-fg-muted">
                    Juntas: <span className="font-semibold text-fg tabular-nums">{brl(monthly)}</span> por mês
                  </p>
                </div>
              )}
              {cards.length === 0 ? (
                <>
                  <p className="rounded-md bg-status-info p-4 text-body-sm text-status-info-fg">
                    Toda assinatura é cobrada em um cartão.{" "}
                    <button type="button" onClick={() => go(1)} className="font-semibold underline">
                      Criar um cartão primeiro
                    </button>
                  </p>
                  <DialogActions>
                    <button type="button" onClick={() => go(3)} className={button("ghost", "md")}>
                      Pular
                    </button>
                  </DialogActions>
                </>
              ) : (
                <SubscriptionForm
                  key={round}
                  cards={cards}
                  categories={categories}
                  today={today}
                  onSaved={setNotice}
                  onDone={() => setRound((r) => r + 1)}
                  onCancel={() => go(3)}
                  cancelLabel={subscriptions.length > 0 ? "Continuar" : "Pular"}
                />
              )}
            </>
          )}

          {step === 3 && <Reminders prefs={prefs} />}
        </div>
      </section>
    </>
  );
}

const DAYS = Array.from({ length: 11 }, (_, d) => ({
  value: String(d),
  label: d === 0 ? "No dia" : d === 1 ? "1 dia antes" : `${d} dias antes`,
}));

/** Passo 3: as preferências padrão já vêm marcadas (FLOW_MAP §2); "Pular" mantém o padrão. */
function Reminders({ prefs }: { prefs: NotificationPreferencesDTO }) {
  const router = useRouter();
  const [v, setV] = useState({
    invoiceDue: prefs.invoiceDueEnabled,
    invoiceDays: String(prefs.invoiceDueDaysBefore),
    subscription: prefs.subscriptionDaysBefore !== null,
    subscriptionDays: String(prefs.subscriptionDaysBefore ?? 1),
    dailyDigest: prefs.dailyDigest,
  });
  const [busy, setBusy] = useState<"save" | "skip" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const toggle =
    (key: "invoiceDue" | "subscription" | "dailyDigest") => (e: { target: { checked: boolean } }) =>
      setV((prev) => ({ ...prev, [key]: e.target.checked }));
  const pick = (key: "invoiceDays" | "subscriptionDays") => (e: { target: { value: string } }) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));

  async function finish(save: boolean) {
    setBusy(save ? "save" : "skip");
    setMessage(null);
    const saved = save
      ? await updateNotificationPreferences({
          invoiceDueEnabled: v.invoiceDue,
          invoiceDueDaysBefore: Number(v.invoiceDays),
          subscriptionDaysBefore: v.subscription ? Number(v.subscriptionDays) : null,
          dailyDigest: v.dailyDigest,
        })
      : null;
    const done = saved && !saved.ok ? saved : await completeOnboarding({});
    if (done.ok) return router.push("/dashboard");
    setBusy(null);
    setMessage(done.error.message);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void finish(true);
      }}
    >
      <ul className="flex flex-col gap-3">
        <ReminderRow
          id="lembrete-fatura"
          label="Vencimento da fatura"
          hint="Para pagar sem atraso."
          checked={v.invoiceDue}
          onCheck={toggle("invoiceDue")}
          days={v.invoiceDays}
          onDays={pick("invoiceDays")}
        />
        <ReminderRow
          id="lembrete-assinatura"
          label="Cobrança de assinatura"
          hint="Dá tempo de cancelar o que não usa."
          checked={v.subscription}
          onCheck={toggle("subscription")}
          days={v.subscriptionDays}
          onDays={pick("subscriptionDays")}
        />
        <ReminderRow
          id="lembrete-resumo"
          label="Resumo diário por e-mail"
          hint="Junta os avisos do dia em um e-mail só."
          checked={v.dailyDigest}
          onCheck={toggle("dailyDigest")}
        />
      </ul>

      {message && (
        <div className="mt-4">
          <FormError>{message}</FormError>
        </div>
      )}

      <DialogActions>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void finish(false)}
          className={button("ghost", "md")}
        >
          {busy === "skip" && (
            <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />
          )}
          Pular
        </button>
        <button type="submit" disabled={!!busy} className={button("primary", "md")}>
          {busy === "save" && (
            <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />
          )}
          Concluir e ir ao painel
        </button>
      </DialogActions>
    </form>
  );
}

function ReminderRow({
  id,
  label,
  hint,
  checked,
  onCheck,
  days,
  onDays,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheck: (e: { target: { checked: boolean } }) => void;
  days?: string;
  onDays?: (e: { target: { value: string } }) => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
      <label htmlFor={id} className="flex flex-1 cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          aria-describedby={`${id}-ajuda`}
          className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-body">{label}</span>
          <span id={`${id}-ajuda`} className="block text-body-sm text-fg-muted">
            {hint}
          </span>
        </span>
      </label>
      {onDays && (
        <select
          aria-label={`Quando avisar: ${label.toLowerCase()}`}
          value={days}
          onChange={onDays}
          disabled={!checked}
          className={`${FIELD} sm:w-40 disabled:opacity-50`}
        >
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
