"use client";

import {
  AlarmClock,
  CheckCheck,
  Hourglass,
  LoaderCircle,
  Newspaper,
  Receipt,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { button } from "@/shared/ui/button";

import type { NotificationDTO } from "../../application/notifications";
import { markAllNotificationsRead, markNotificationRead } from "../actions";

const ICONS: Record<NotificationDTO["type"], LucideIcon> = {
  INVOICE_DUE: Receipt,
  INVOICE_OVERDUE: AlarmClock,
  SUBSCRIPTION_CHARGE: Repeat,
  TRIAL_ENDING: Hourglass,
  DAILY_DIGEST: Newspaper,
};

const RELATIVE = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** DESIGN §8: "há 2 horas", "ontem". */
function ago(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  for (const [unit, ms] of STEPS) {
    if (Math.abs(diff) >= ms) return RELATIVE.format(Math.round(diff / ms), unit);
  }
  return "agora";
}

/** Central de notificações (RF-065): abrir marca como lida e leva ao destino. */
export function NotificationList({ items, now }: { items: NotificationDTO[]; now: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function open(n: NotificationDTO) {
    setPending(n.id);
    if (!n.readAt) await markNotificationRead({ id: n.id });
    setPending(null);
    if (n.href) router.push(n.href as Route);
    else router.refresh();
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((n) => {
        const Icon = ICONS[n.type];
        const unread = !n.readAt;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => void open(n)}
              disabled={pending === n.id}
              className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-md px-2 py-4 text-left transition-colors duration-150 hover:bg-surface-subtle"
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${unread ? "bg-tonal text-tonal-fg" : "bg-surface-subtle text-fg-muted"}`}
              >
                {pending === n.id ? (
                  <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />
                ) : (
                  <Icon aria-hidden size={18} strokeWidth={1.5} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-body ${unread ? "font-semibold text-fg" : "text-fg"}`}>
                  {unread && <span className="sr-only">Não lida: </span>}
                  {n.title}
                </span>
                {n.body && <span className="mt-0.5 block text-body-sm text-fg-muted">{n.body}</span>}
                <span className="mt-1 block text-caption text-fg-muted">{ago(n.createdAt, now)}</span>
              </span>
              {unread && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MarkAllReadButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await markAllNotificationsRead({});
        setBusy(false);
      }}
      className={button("ghost", "sm")}
    >
      {busy ? (
        <LoaderCircle aria-hidden size={16} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <CheckCheck aria-hidden size={16} strokeWidth={1.5} />
      )}
      Marcar todas como lidas
    </button>
  );
}
