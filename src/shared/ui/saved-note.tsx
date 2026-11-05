import { Check } from "lucide-react";

/** Confirmação discreta ao lado do botão (anunciada por leitores de tela). */
export function SavedNote({ show }: { show: boolean }) {
  return (
    <p role="status" className="flex items-center gap-1.5 text-body-sm text-status-positive-fg">
      {show && (
        <>
          <Check aria-hidden size={16} strokeWidth={1.5} />
          Salvo
        </>
      )}
    </p>
  );
}
