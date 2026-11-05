import { BellOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/session";
import { Id } from "@/shared/application/schemas";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { button } from "@/shared/ui/button";

import { listNotifications, unreadCount } from "@/modules/notifications";
import { MarkAllReadButton, NotificationList } from "@/modules/notifications/ui/components/notification-list";

export const metadata: Metadata = { title: "Notificações — FinFlow" };

const PAGE = 30;

/** Central de notificações (RF-065, FLOW_MAP §12): lembretes gerados pelo job diário. */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ depois?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const ctx = { db: prisma(), user, clock: systemClock };
  const { depois } = await searchParams;
  const cursor = depois && Id.safeParse(depois).success ? depois : undefined;
  const [page, unread] = await Promise.all([
    listNotifications(ctx, { cursor, limit: PAGE }),
    unreadCount(ctx),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-heading-lg">Notificações</h1>
          <p className="mt-1 text-body text-fg-muted">
            {unread === 0 ? "Tudo lido." : unread === 1 ? "1 não lida" : `${unread} não lidas`}
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </header>

      {page.items.length === 0 ? (
        <section className="rounded-xl bg-surface p-8 text-center shadow-hairline">
          <BellOff aria-hidden size={28} strokeWidth={1.5} className="mx-auto text-fg-muted" />
          <h2 className="mt-3 font-display text-heading-sm">
            {cursor ? "Não há mais notificações" : "Nenhuma notificação ainda"}
          </h2>
          <p className="mt-2 text-body text-fg-muted">
            Os lembretes de vencimento, cobrança e fim de teste aparecem aqui, conforme as suas preferências.
          </p>
          <Link href="/settings#lembretes" className={`${button("tonal", "md")} mt-6`}>
            Ajustar lembretes
          </Link>
        </section>
      ) : (
        <section
          aria-label="Lista de notificações"
          className="rounded-xl bg-surface px-5 shadow-hairline sm:px-6"
        >
          <NotificationList items={page.items} now={ctx.clock.now().getTime()} />
        </section>
      )}

      {(cursor || page.nextCursor) && (
        <nav aria-label="Paginação" className="flex justify-between gap-3">
          {cursor ? (
            <Link href="/notifications" className={button("ghost", "md")}>
              Mais recentes
            </Link>
          ) : (
            <span />
          )}
          {page.nextCursor && (
            <Link
              href={{ pathname: "/notifications", query: { depois: page.nextCursor } }}
              className={button("ghost", "md")}
            >
              Mais antigas
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
