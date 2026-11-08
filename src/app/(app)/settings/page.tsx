import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser } from "@/lib/session";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";

import { DELETION_GRACE_DAYS, getProfile } from "@/modules/accounts";
import { DeleteAccountButton, ExportDataLink } from "@/modules/accounts/ui/components/privacy-section";
import { ProfileForm } from "@/modules/accounts/ui/components/profile-form";
import { listCategories } from "@/modules/categories";
import { CategoryManager } from "@/modules/categories/ui/components/category-manager";
import { getNotificationPreferences } from "@/modules/notifications";
import { PreferencesForm } from "@/modules/notifications/ui/components/preferences-form";

import { SignOutButton } from "../sign-out-button";

export const metadata: Metadata = { title: "Configurações — FinFlow" };

const SECTIONS = [
  { id: "perfil", label: "Perfil" },
  { id: "lembretes", label: "Lembretes" },
  { id: "categorias", label: "Categorias" },
  { id: "privacidade", label: "Privacidade" },
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: (typeof SECTIONS)[number]["id"];
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="scroll-mt-24 rounded-xl bg-surface p-5 shadow-hairline sm:p-8"
    >
      <h2 id={`${id}-titulo`} className="font-display text-heading-sm">
        {title}
      </h2>
      <p className="mt-1 text-body-sm text-fg-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Configurações (FLOW_MAP §1 e §13): perfil, lembretes, categorias e privacidade numa página só. */
export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const ctx = { db: prisma(), user, clock: systemClock };
  const [profile, prefs, categories] = await Promise.all([
    getProfile(ctx),
    getNotificationPreferences(ctx),
    listCategories(ctx.db, user.id),
  ]);
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-heading-lg">Configurações</h1>
        <nav aria-label="Seções" className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex h-8 items-center rounded-full px-3.5 text-label text-fg-muted shadow-[inset_0_0_0_1px_var(--border-strong)] transition-colors duration-150 hover:bg-surface-subtle hover:text-fg"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      {/* Duas colunas a partir de xl, em vez de uma coluna estreita com espaço vazio ao lado. */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Section
            id="perfil"
            title="Perfil"
            description="Como você aparece e em que fuso o FinFlow conta os dias."
          >
            <ProfileForm
              profile={{ name: profile.name, email: profile.email, timezone: profile.timezone }}
              timezones={timezones}
            />
          </Section>

          <Section
            id="lembretes"
            title="Lembretes"
            description="O job diário avisa conforme estas escolhas. Nada é enviado fora delas."
          >
            <PreferencesForm prefs={prefs} />
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section
            id="categorias"
            title="Categorias"
            description="Usadas em assinaturas e despesas, e no gráfico de gastos do painel."
          >
            <CategoryManager categories={categories} />
          </Section>

          <Section
            id="privacidade"
            title="Privacidade"
            description="Seus dados são seus: baixe uma cópia completa ou exclua a conta quando quiser."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ExportDataLink />
              <DeleteAccountButton email={profile.email} graceDays={DELETION_GRACE_DAYS} />
            </div>
            <p className="mt-6 text-body-sm text-fg-muted">
              Leia os{" "}
              <Link href="/termos" className="text-fg underline-offset-4 hover:underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className="text-fg underline-offset-4 hover:underline">
                Política de privacidade
              </Link>
              .
            </p>
          </Section>

          <div className="flex justify-end lg:hidden">
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
