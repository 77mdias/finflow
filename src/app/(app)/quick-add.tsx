"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";

import { CardForm } from "@/modules/cards/ui/components/card-form";
import { ExpenseForm } from "@/modules/expenses/ui/components/expense-form";
import { SubscriptionForm } from "@/modules/subscriptions/ui/components/subscription-form";

type Tab = "subscription" | "expense" | "card";
const TABS: { value: Tab; label: string }[] = [
  { value: "subscription", label: "Assinatura" },
  { value: "expense", label: "Despesa" },
  { value: "card", label: "Cartão" },
];

interface Option {
  id: string;
  name: string;
}

/**
 * Novo lançamento (VISUAL_BRIEF §6 tela 4, DESIGN §6.9): abas Assinatura · Despesa · Cartão num só
 * diálogo, aberto pelo "+" flutuante no celular ou pelo botão da sidebar no desktop. Ao salvar, um
 * aviso (DESIGN §6.10) confirma o que entrou.
 */
export function QuickAdd({
  variant,
  cards,
  categories,
  today,
}: {
  variant: "fab" | "sidebar";
  cards: Option[];
  categories: Option[];
  today: string;
}) {
  const initial: Tab = cards.length > 0 ? "subscription" : "card";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(initial);
  const [toast, setToast] = useState<string | null>(null);
  const close = () => setOpen(false);
  const lists = { cards, categories, today, onDone: close, onSaved: setToast };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTab(initial);
          setOpen(true);
        }}
        aria-label={variant === "fab" ? "Novo lançamento" : undefined}
        className={
          variant === "fab"
            ? "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-lg transition-transform duration-150 hover:bg-primary-hover active:scale-95"
            : `${button("primary", "md")} w-full`
        }
      >
        <Plus aria-hidden size={variant === "fab" ? 26 : 18} strokeWidth={1.5} />
        {variant === "sidebar" && "Novo lançamento"}
      </button>

      <Dialog open={open} onClose={close} title="Novo lançamento">
        <fieldset className="mb-6">
          <legend className="sr-only">Tipo de lançamento</legend>
          <div className="grid grid-cols-3 rounded-full bg-surface-subtle p-1">
            {TABS.map((t) => (
              <label key={t.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="tipo-lancamento"
                  value={t.value}
                  checked={tab === t.value}
                  onChange={() => setTab(t.value)}
                  className="peer sr-only"
                />
                <span className="flex h-9 items-center justify-center rounded-full text-label text-fg-muted transition-colors duration-150 peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                  {t.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {tab === "card" ? (
          <CardForm onDone={close} onSaved={setToast} />
        ) : cards.length === 0 ? (
          <p className="rounded-md bg-status-info p-4 text-body-sm text-status-info-fg">
            Toda {tab === "subscription" ? "assinatura" : "despesa"} é cobrada em um cartão.{" "}
            <button type="button" onClick={() => setTab("card")} className="font-semibold underline">
              Criar um cartão primeiro
            </button>
          </p>
        ) : tab === "subscription" ? (
          <SubscriptionForm {...lists} />
        ) : (
          <ExpenseForm {...lists} />
        )}
      </Dialog>

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center lg:inset-x-auto lg:right-8 lg:bottom-8"
      >
        {toast && (
          <p className="rounded-lg bg-surface-inverse px-5 py-3 text-body-sm text-bg shadow-lg lg:rounded-full">
            {toast}
          </p>
        )}
      </div>
    </>
  );
}
