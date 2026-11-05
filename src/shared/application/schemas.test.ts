import { describe, expect, it } from "vitest";

import { MoneyInput, NonNegativeMoneyInput } from "./schemas";

describe("schemas de dinheiro", () => {
  it("MoneyInput exige valor positivo", () => {
    expect(MoneyInput.parse("1.234,56")).toBe(123_456n);
    expect(MoneyInput.safeParse("0").success).toBe(false);
  });

  it("NonNegativeMoneyInput aceita zero e recusa negativo ou texto", () => {
    expect(NonNegativeMoneyInput.parse("0")).toBe(0n);
    expect(NonNegativeMoneyInput.parse("20,00")).toBe(2_000n);
    expect(NonNegativeMoneyInput.safeParse("-5,00").success).toBe(false);
    expect(NonNegativeMoneyInput.safeParse("abc").success).toBe(false);
  });
});
