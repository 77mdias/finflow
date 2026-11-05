import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { Id } from "@/shared/application/schemas";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";

import { invoiceFor } from "@/modules/invoices";

/** `/cards/[id]` abre a fatura atual do cartão (a navegação ◀ ▶ e o histórico ficam nela). */
export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  if (!Id.safeParse(id).success) notFound();
  const card = await prisma().card.findFirst({
    where: { id, userId: user.id },
    select: { closingDay: true, dueDay: true },
  });
  if (!card) notFound();
  const ref = invoiceFor(todayOf({ user, clock: systemClock }), card).referenceMonth;
  redirect(`/cards/${id}/invoices/${ref}` as Route);
}
