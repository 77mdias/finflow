import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonthsTo,
  addYearMonths,
  daysBetween,
  fromDbDate,
  hourIn,
  isValidTimeZone,
  parseDateOnly,
  parseYearMonth,
  toDbDate,
  todayIn,
} from "./date-only";
import { centsToNumber, divRound, formatMoney, parseMoney } from "./money";

describe("DateOnly", () => {
  it("valida datas reais", () => {
    expect(parseDateOnly("2028-02-29")).toBe("2028-02-29");
    expect(() => parseDateOnly("2027-02-29")).toThrow(RangeError);
    expect(() => parseDateOnly("2026-13-01")).toThrow(RangeError);
    expect(() => parseDateOnly("05/12/2026")).toThrow(RangeError);
    expect(() => parseYearMonth("2026-00")).toThrow(RangeError);
  });
  it("aritmética", () => {
    expect(addDays(parseDateOnly("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addMonthsTo(parseDateOnly("2027-01-31"), 1)).toBe("2027-02-28");
    expect(addYearMonths(parseYearMonth("2026-12"), 1)).toBe("2027-01");
    expect(daysBetween(parseDateOnly("2026-11-04"), parseDateOnly("2026-12-05"))).toBe(31);
  });
  it("converte de/para o formato do Prisma sem deslocamento de fuso", () => {
    const db = toDbDate(parseDateOnly("2026-12-05"));
    expect(db.toISOString()).toBe("2026-12-05T00:00:00.000Z");
    expect(fromDbDate(db)).toBe("2026-12-05");
  });
  it("'hoje' respeita o fuso do usuário (RN-01)", () => {
    const now = new Date("2026-11-05T01:30:00Z"); // 22:30 de 04/11 em São Paulo
    expect(todayIn("America/Sao_Paulo", now)).toBe("2026-11-04");
    expect(todayIn("UTC", now)).toBe("2026-11-05");
    expect(hourIn("America/Sao_Paulo", now)).toBe(22);
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("Money", () => {
  it.each([
    ["55,90", 5_590n],
    ["1.234,56", 123_456n],
    ["1234", 123_400n],
    ["0,5", 50n],
    ["-10,25", -1_025n],
    [" 12.345.678,90 ", 1_234_567_890n],
  ])("parseMoney(%s)", (input, cents) => expect(parseMoney(input)).toBe(cents));

  it.each(["", "55.90", "1,234.56", "12,345", "abc", "1.23,45"])("rejeita %s", (input) => {
    expect(() => parseMoney(input)).toThrow(RangeError);
  });

  it("formata em pt-BR sem float", () => {
    expect(formatMoney(123_456n)).toBe("R$ 1.234,56");
    expect(formatMoney(-50n)).toBe("-R$ 0,50");
    expect(formatMoney(9_007_199_254_740_993n)).toBe("R$ 90.071.992.547.409,93");
  });

  it("centsToNumber e divRound", () => {
    expect(centsToNumber(5_590n)).toBe(5_590);
    expect(() => centsToNumber(2n ** 60n)).toThrow(RangeError);
    expect(divRound(52_000n, 12n)).toBe(4_333n);
    expect(divRound(5n, 2n)).toBe(3n);
  });
});
