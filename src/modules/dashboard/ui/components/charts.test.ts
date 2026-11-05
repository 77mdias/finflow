import { describe, expect, it } from "vitest";

import { groupCategories } from "./category-breakdown";
import { niceCeil } from "./projection-chart";

describe("niceCeil", () => {
  it("arredonda o topo do eixo para 1, 2, 2,5 ou 5 × 10ⁿ", () => {
    expect(niceCeil(84_217)).toBe(100_000);
    expect(niceCeil(12_000)).toBe(20_000);
    expect(niceCeil(25_000)).toBe(25_000);
    expect(niceCeil(26_000)).toBe(50_000);
  });

  it("sem valores, usa um topo mínimo (o gráfico não divide por zero)", () => {
    expect(niceCeil(0)).toBe(100);
  });
});

describe("groupCategories", () => {
  const item = (name: string | null, totalCents: number) => ({
    category: name ? { name } : null,
    totalCents,
  });

  it("mostra até 7 categorias e soma o resto em Outros", () => {
    const rows = groupCategories(
      [900, 800, 700, 600, 500, 400, 300, 200, 100].map((v, i) => item(`C${i}`, v)),
    );
    expect(rows).toHaveLength(8);
    expect(rows.at(-1)).toEqual({ name: "Outros", totalCents: 300, color: "var(--chart-cat-other)" });
    expect(rows[0]!.color).toBe("var(--chart-cat-1)");
  });

  it("ignora valores zerados e nomeia gasto sem categoria", () => {
    expect(groupCategories([item(null, 500), item("Música", 0)])).toEqual([
      { name: "Sem categoria", totalCents: 500, color: "var(--chart-cat-1)" },
    ]);
  });
});
