/**
 * Gradientes dos cartões virtuais (DESIGN §2.3), ângulo 135°. `from` também é a cor do cartão nos
 * gráficos (DESIGN §2.4); `dark` indica texto `ink-800` em vez de branco.
 */
export const CARD_GRADIENTS: Record<string, { from: string; to: string; dark?: true }> = {
  violet: { from: "#8571FF", to: "#5B3FE0" },
  blue: { from: "#4F8BFF", to: "#2457D6" },
  sky: { from: "#38BDF8", to: "#0B83C4" },
  emerald: { from: "#34D399", to: "#0B8A5E" },
  lime: { from: "#D9F99D", to: "#A3E635", dark: true },
  amber: { from: "#FCD34D", to: "#F59E0B", dark: true },
  orange: { from: "#FB923C", to: "#EA580C" },
  red: { from: "#F87171", to: "#DC2626" },
  pink: { from: "#F9A8D4", to: "#DB2777" },
  slate: { from: "#64748B", to: "#334155" },
  black: { from: "#2A2631", to: "#0E0D12" },
};

export const cardGradient = (color: string) => CARD_GRADIENTS[color] ?? CARD_GRADIENTS.violet!;
