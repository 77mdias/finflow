"use client";

import { FIELD } from "@/shared/ui/field";

/** "No dia", "1 dia antes", … "10 dias antes" (o schema aceita 0 a 10). */
export const REMINDER_DAYS = Array.from({ length: 11 }, (_, d) => ({
  value: String(d),
  label: d === 0 ? "No dia" : d === 1 ? "1 dia antes" : `${d} dias antes`,
}));

/** Lembrete liga/desliga, com antecedência opcional (onboarding e Configurações). */
export function ReminderRow({
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
          {REMINDER_DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
