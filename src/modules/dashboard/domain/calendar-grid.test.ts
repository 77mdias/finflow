import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { yearMonth } from "@/shared/domain/date-only";

import { monthGrid, weekday } from "./calendar-grid";

describe("monthGrid", () => {
  it("nov/2026 começa no domingo 01/11 e termina no sábado 05/12", () => {
    const g = monthGrid(yearMonth(2026, 11));
    expect(g[0]).toBe("2026-11-01");
    expect(g.at(-1)).toBe("2026-12-05");
    expect(g).toHaveLength(35);
  });

  it("fev/2026 (começa no domingo, 28 dias) cabe em 4 semanas", () => {
    const g = monthGrid(yearMonth(2026, 2));
    expect([g[0], g.at(-1), g.length]).toEqual(["2026-02-01", "2026-02-28", 28]);
  });

  it("ago/2026 precisa de 6 semanas", () => {
    const g = monthGrid(yearMonth(2026, 8));
    expect([g[0], g.at(-1), g.length]).toEqual(["2026-07-26", "2026-09-05", 42]);
  });

  it("propriedades: semanas completas de domingo a sábado contendo o mês inteiro", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1990, max: 2100 }), fc.integer({ min: 1, max: 12 }), (y, m) => {
        const ym = yearMonth(y, m);
        const g = monthGrid(ym);
        expect(g.length % 7).toBe(0);
        expect(g.length).toBeGreaterThanOrEqual(28);
        expect(g.length).toBeLessThanOrEqual(42);
        expect(weekday(g[0]!)).toBe(0);
        expect(weekday(g.at(-1)!)).toBe(6);
        expect(g.includes(`${ym}-01` as never)).toBe(true);
        expect(g.filter((d) => d.startsWith(ym))).toHaveLength(new Date(Date.UTC(y, m, 0)).getUTCDate());
      }),
    );
  });
});
