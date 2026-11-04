import { AppError } from "@/shared/domain/errors";

/** Concorrência otimista (DATABASE.md §10): a edição deve partir da versão atual. */
export function assertNotStale(current: Date, expectedUpdatedAt: string | undefined): void {
  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== current.getTime()) {
    throw new AppError("CONFLICT", "Este item foi alterado em outra aba. Atualize a página.");
  }
}
