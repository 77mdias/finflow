"use client";

import { Archive, ArchiveRestore, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { FIELD, FormError } from "@/shared/ui/field";

import { archiveCard, unarchiveCard } from "../actions";

/**
 * Arquivar (FLOW_MAP §4, RF-013). Se o cartão ainda tem assinaturas ativas, o servidor recusa e o
 * diálogo pede para movê-las para outro cartão ou cancelá-las.
 */
function ArchiveForm({
  card,
  otherCards,
  onDone,
}: {
  card: { id: string; nickname: string };
  otherCards: { id: string; nickname: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<string | null>(null);
  const [choice, setChoice] = useState<"move" | "cancel">(otherCards.length ? "move" : "cancel");
  const [dest, setDest] = useState(otherCards[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await archiveCard({
      id: card.id,
      ...(subscriptions ? (choice === "move" ? { reassignTo: dest } : { cancelSubscriptions: true }) : {}),
    });
    setBusy(false);
    if (res.ok) {
      onDone();
      return router.push("/cards");
    }
    if (res.error.code === "CARD_HAS_ACTIVE_SUBSCRIPTIONS") return setSubscriptions(res.error.message);
    setMessage(res.error.message);
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="text-body text-fg-muted">
        O {card.nickname} sai do painel e das projeções. As faturas continuam guardadas e você pode
        desarquivar quando quiser.
      </p>
      {subscriptions && (
        <fieldset className="mt-4 flex flex-col gap-3">
          <legend className="text-label">{subscriptions}</legend>
          {otherCards.length > 0 && (
            <label className="flex flex-col gap-2 rounded-md bg-surface-subtle p-3">
              <span className="flex items-center gap-2 text-body">
                <input
                  type="radio"
                  name="assinaturas"
                  checked={choice === "move"}
                  onChange={() => setChoice("move")}
                  className="size-4 accent-primary"
                />
                Mover para outro cartão
              </span>
              {choice === "move" && (
                <select
                  aria-label="Cartão de destino"
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  className={`${FIELD} mt-0 bg-surface`}
                >
                  {otherCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nickname}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}
          <label className="flex items-center gap-2 rounded-md bg-surface-subtle p-3 text-body">
            <input
              type="radio"
              name="assinaturas"
              checked={choice === "cancel"}
              onChange={() => setChoice("cancel")}
              className="size-4 accent-primary"
            />
            Cancelar as assinaturas
          </label>
        </fieldset>
      )}
      {message && (
        <div className="mt-4">
          <FormError>{message}</FormError>
        </div>
      )}
      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost", "md")}>
          Voltar
        </button>
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          {subscriptions && choice === "cancel" ? "Cancelar assinaturas e arquivar" : "Arquivar cartão"}
        </button>
      </DialogActions>
    </form>
  );
}

export function ArchiveCardButton(props: {
  card: { id: string; nickname: string };
  otherCards: { id: string; nickname: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={button("ghost", "sm")}>
        <Archive aria-hidden size={16} strokeWidth={1.5} />
        Arquivar
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Arquivar cartão?">
        <ArchiveForm {...props} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

/** Desarquivar volta o cartão ao painel (pode esbarrar no limite do plano). */
export function UnarchiveCardButton({ id, nickname }: { id: string; nickname: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        aria-label={`Desarquivar ${nickname}`}
        onClick={async () => {
          setBusy(true);
          const res = await unarchiveCard({ id });
          setBusy(false);
          setMessage(res.ok ? null : res.error.message);
        }}
        className={button("tonal", "sm")}
      >
        {busy ? (
          <LoaderCircle aria-hidden size={16} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <ArchiveRestore aria-hidden size={16} strokeWidth={1.5} />
        )}
        Desarquivar
      </button>
      {message && (
        <p role="alert" className="mt-2 text-body-sm text-status-danger-fg">
          {message}
        </p>
      )}
    </div>
  );
}
