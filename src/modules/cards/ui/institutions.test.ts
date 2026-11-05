import { describe, expect, it } from "vitest";

import { institutionBadge } from "./institutions";

describe("institutionBadge", () => {
  it("usa a cor de referência, sem diferenciar acento nem caixa", () => {
    expect(institutionBadge("itau")).toEqual({ initials: "IT", color: "#EC7000", dark: true });
    expect(institutionBadge(" NUBANK ")).toEqual({ initials: "NU", color: "#820AD1", dark: false });
  });

  it("emissor livre: iniciais das duas primeiras palavras ou duas letras, em ink-600", () => {
    expect(institutionBadge("Banco Pan")).toMatchObject({ initials: "BP", color: "var(--color-ink-600)" });
    expect(institutionBadge("sicredi")).toMatchObject({ initials: "SI", dark: false });
  });
});
