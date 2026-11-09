import { toDbDate, type DateOnly } from "@/shared/domain/date-only";
import type { Tx } from "@/shared/infrastructure/db";

import { materializeSubscription } from "./subscriptions";

/** Job diário: converte testes encerrados e materializa ocorrências vencidas (RN-11, RF-026). */
export async function materializeDueSubscriptions(
  tx: Tx,
  users: ReadonlyArray<{ id: string; today: DateOnly }>,
) {
  const stats = { chargesMaterialized: 0, trialsConverted: 0 };
  if (users.length === 0) return stats;
  const todayById = new Map(users.map((u) => [u.id, u.today]));
  const maxToday = toDbDate(users.reduce((m, u) => (u.today > m ? u.today : m), users[0]!.today));
  const due = await tx.subscription.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      OR: [
        { status: "ACTIVE", nextChargeDate: { lte: maxToday } },
        { status: "TRIAL", trialEndsOn: { lte: maxToday } },
        // Cancelada só enquanto tem ocorrência antes da data efetiva (isBillable); depois, sai do job.
        { status: "CANCELED", nextChargeDate: { lte: maxToday, lt: tx.subscription.fields.canceledOn } },
      ],
    },
    select: { id: true, userId: true, status: true },
    orderBy: [{ userId: "asc" }, { nextChargeDate: "asc" }],
  });
  for (const s of due) {
    const today = todayById.get(s.userId)!;
    stats.chargesMaterialized += await materializeSubscription(tx, s.id, today);
    if (s.status === "TRIAL") {
      const after = await tx.subscription.findUniqueOrThrow({
        where: { id: s.id },
        select: { status: true },
      });
      if (after.status === "ACTIVE") stats.trialsConverted++;
    }
  }
  return stats;
}
