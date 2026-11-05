import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { Logo } from "@/shared/ui/logo";

import { listCardOptions } from "@/modules/cards";
import { listCategories } from "@/modules/categories";
import { getNotificationPreferences } from "@/modules/notifications";
import { listSubscriptions } from "@/modules/subscriptions";

import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Primeiros passos — FinFlow" };

/**
 * Onboarding (RF-080, FLOW_MAP §2, VISUAL_BRIEF §6 tela 7): cartão → assinaturas → lembretes, cada
 * passo pulável, sem a navegação do app. Quem já concluiu vai ao painel.
 */
export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (user.onboardingCompletedAt) redirect("/dashboard");

  const ctx = { db: prisma(), user, clock: systemClock };
  const [cards, categories, subscriptions, prefs] = await Promise.all([
    listCardOptions(ctx),
    listCategories(ctx.db, user.id),
    listSubscriptions(ctx),
    getNotificationPreferences(ctx),
  ]);

  return (
    <main className="mx-auto w-full max-w-[520px] px-4 py-8 sm:py-12">
      <Logo priority />
      <Wizard
        cards={cards}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        subscriptions={subscriptions.map((s) => ({
          id: s.id,
          name: s.name,
          monthlyCents: s.monthlyEquivalentCents,
        }))}
        prefs={prefs}
        today={todayOf(ctx)}
      />
    </main>
  );
}
