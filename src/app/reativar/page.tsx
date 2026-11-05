import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentUser, pendingDeletionUser } from "@/lib/session";
import { todayIn } from "@/shared/domain/date-only";
import { systemClock } from "@/shared/infrastructure/clock";
import { fullDate } from "@/shared/ui/format";
import { DialogActions } from "@/shared/ui/dialog";
import { Logo } from "@/shared/ui/logo";

import { SignOutButton } from "../(app)/sign-out-button";

import { DELETION_GRACE_DAYS, deletionDeadline } from "@/modules/accounts";
import { ReactivateAccount } from "@/modules/accounts/ui/components/reactivate-account";

export const metadata: Metadata = { title: "Reativar conta — FinFlow" };

/**
 * RF-007 / FLOW_MAP §13: quem pediu a exclusão e entra de novo durante a carência de 30 dias cai aqui
 * (a área logada redireciona) e pode reativar a conta ou sair.
 */
export default async function ReactivatePage() {
  if (await currentUser()) redirect("/dashboard");
  const user = await pendingDeletionUser();
  if (!user?.deletedAt) redirect("/entrar");
  const deadline = deletionDeadline(user.deletedAt);
  const purgeAfter = todayIn(user.timezone, deadline);
  const expired = systemClock.now() >= deadline;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <Logo />
      <section className="mt-8 rounded-xl bg-surface p-6 shadow-hairline sm:p-8">
        {expired ? (
          <>
            <h1 className="font-display text-heading">O prazo para reativar terminou</h1>
            <p className="mt-3 text-body text-fg-muted">
              A exclusão de <strong className="font-semibold text-fg">{user.email}</strong> foi pedida há mais
              de {DELETION_GRACE_DAYS} dias, e os dados serão apagados em definitivo. Para voltar a usar o
              FinFlow, crie uma conta nova depois disso.
            </p>
            <DialogActions>
              <SignOutButton />
            </DialogActions>
          </>
        ) : (
          <>
            <h1 className="font-display text-heading">Sua conta está programada para exclusão</h1>
            <p className="mt-3 text-body text-fg-muted">
              Os dados de <strong className="font-semibold text-fg">{user.email}</strong> serão apagados em{" "}
              <strong className="font-semibold text-fg">{fullDate(purgeAfter)}</strong>. Até lá, dá para
              reativar e continuar de onde parou: cartões, assinaturas e faturas estão guardados.
            </p>
            <ReactivateAccount />
          </>
        )}
      </section>
    </main>
  );
}
