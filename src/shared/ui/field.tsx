import { CircleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** Campo de formulário (DESIGN §6.2): fundo `--surface-subtle`, sem borda, anel `--ring` no foco. */
export const FIELD =
  "mt-1.5 h-11 w-full rounded-md bg-surface-subtle px-4 text-body text-fg transition-colors duration-150 " +
  "outline-none placeholder:text-fg-subtle hover:bg-surface-muted focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring " +
  "aria-invalid:ring-2 aria-invalid:ring-status-danger-fg";

/** Props de acessibilidade do controle: liga a ajuda e o erro ao campo. */
export const describedBy = (id: string, error?: string, hint?: string) => ({
  id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-erro` : hint ? `${id}-ajuda` : undefined,
});

/** Label acima (gap 6), ajuda ou erro abaixo, erro com ícone. Use com `describedBy` no controle. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-erro`} className="mt-1.5 flex gap-1.5 text-body-sm text-status-danger-fg">
          <CircleAlert aria-hidden size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-ajuda`} className="mt-1.5 text-body-sm text-fg-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** `MoneyInput` (DESIGN §6.2): prefixo "R$" fixo e teclado numérico; o servidor converte "1.234,56". */
export function MoneyInput(props: Omit<ComponentProps<"input">, "type" | "inputMode">) {
  // shortcut: sem máscara enquanto digita; o schema aceita "55,9", "1.234,56" e "1234,56".
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1.5 left-4 flex h-11 items-center text-fg-muted"
      >
        R$
      </span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={props.placeholder ?? "0,00"}
        className={`${FIELD} pl-11 tabular-nums`}
      />
    </div>
  );
}

/** Mensagem de erro geral do formulário (o que aconteceu e o que fazer, DESIGN §8). */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex gap-2 rounded-md bg-status-danger p-3 text-body-sm text-status-danger-fg">
      <CircleAlert aria-hidden size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
