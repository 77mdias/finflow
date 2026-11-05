"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Diálogo do design system (DESIGN §6.10) sobre o `<dialog>` nativo, que já prende o foco, fecha no
 * Esc e deixa o fundo inerte. No celular vira sheet presa à base, com cantos arredondados só no topo.
 * O conteúdo só existe aberto, então formulários recomeçam limpos a cada abertura.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // Clique no fundo (fora da caixa) fecha.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-surface p-0 text-fg shadow-lg backdrop:bg-ink-950/50 sm:m-auto sm:max-w-[480px] sm:rounded-xl"
    >
      {open && (
        <div className="relative p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div aria-hidden className="mx-auto -mt-2 mb-4 h-1 w-9 rounded-full bg-border-strong sm:hidden" />
          <h2 id={titleId} className="pr-10 font-display text-heading-sm">
            {title}
          </h2>
          <div className="mt-4">{children}</div>
          {/* Depois do conteúdo no DOM: o <dialog> foca o primeiro campo (ou "Voltar"), não o fechar. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-fg-muted hover:bg-surface-subtle hover:text-fg max-sm:top-6"
          >
            <X aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </dialog>
  );
}

/** Rodapé de ações (DESIGN §6.10): à direita; no celular empilhadas, com a primária em cima. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
