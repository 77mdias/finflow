/**
 * Dinheiro como inteiro em centavos (bigint). Nunca usar float. SRS R-02 · ADR-003
 */
export type Cents = bigint;
export type Currency = "BRL";

const PT_BR_MONEY = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/**
 * Converte texto no formato pt-BR em centavos.
 * Aceita "55,90", "1.234,56", "1234", "-10,5". Rejeita "55.90" (ambíguo) e valores vazios.
 */
export function parseMoney(input: string): Cents {
  const m = PT_BR_MONEY.exec(input.trim());
  if (!m) throw new RangeError(`Valor monetário inválido: "${input}"`);
  const negative = m[1] === "-";
  const integer = (m[2] ?? "0").replaceAll(".", "");
  const fraction = (m[3] ?? "").padEnd(2, "0");
  const cents = BigInt(integer) * 100n + BigInt(fraction || "0");
  return negative ? -cents : cents;
}

export function formatMoney(cents: Cents | number, currency: Currency = "BRL", locale = "pt-BR"): string {
  const value = typeof cents === "bigint" ? cents : BigInt(cents);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  // Formata a parte inteira com Intl e a fração manualmente, sem passar por float.
  const intPart = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(abs / 100n);
  const frac = String(abs % 100n).padStart(2, "0");
  const symbol = currency === "BRL" ? "R$" : currency;
  return `${negative ? "-" : ""}${symbol} ${intPart},${frac}`;
}

/** Converte para `number` em DTOs (seguro até 2^53 centavos). */
export function centsToNumber(cents: Cents): number {
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("Valor monetário fora do intervalo seguro");
  }
  return Number(cents);
}

export const sumCents = (values: Iterable<Cents>): Cents => {
  let total = 0n;
  for (const v of values) total += v;
  return total;
};

/** Divisão inteira com arredondamento "half up" (para valores ≥ 0). */
export const divRound = (value: bigint, divisor: bigint): bigint => (value * 2n + divisor) / (divisor * 2n);
