import Link from "next/link";
import type { ReactNode } from "react";

import { CURRENT_TERMS_VERSION } from "@/modules/accounts";
import { Logo } from "@/shared/ui/logo";

/**
 * Moldura de /termos e /privacidade. A versão exibida é a mesma gravada no consentimento
 * (`consents.version`) quando a conta é criada.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[720px] items-center px-4 sm:px-6">
          <Link href="/" aria-label="FinFlow, página inicial" className="rounded-md">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-heading-lg">{title}</h1>
        <p className="mt-2 text-body-sm text-fg-muted">Versão {CURRENT_TERMS_VERSION}</p>
        {/* shortcut: base do texto; revisar (inclusive juridicamente) e publicar o contato do encarregado antes do lançamento. */}
        <p className="mt-6 rounded-md bg-status-info p-4 text-body-sm text-status-info-fg">
          Versão preliminar. Este texto ainda será revisado antes do lançamento do FinFlow, e qualquer mudança
          será avisada a quem já tem conta.
        </p>
        <div className="mt-10 flex flex-col gap-10">{children}</div>
        <nav
          aria-label="Documentos legais"
          className="mt-16 flex gap-6 border-t border-border pt-6 text-body-sm"
        >
          <Link href="/termos" className="text-fg-muted hover:text-fg">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="text-fg-muted hover:text-fg">
            Política de privacidade
          </Link>
        </nav>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-body text-fg-muted [&_strong]:font-semibold [&_strong]:text-fg">
      <h2 className="font-display text-heading-sm text-fg">{title}</h2>
      {children}
    </section>
  );
}
