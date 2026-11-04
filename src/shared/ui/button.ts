/** Classes do botão do design system (DESIGN §6.1), para <button> ou <Link>. */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none " +
  "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] " +
  "disabled:pointer-events-none disabled:opacity-45";

const VARIANTS = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  neutral:
    "bg-neutral-btn text-neutral-btn-fg shadow-sm hover:bg-[color-mix(in_oklab,var(--neutral-btn),var(--neutral-btn-fg)_14%)]",
  tonal: "bg-tonal text-tonal-fg hover:bg-[color-mix(in_oklab,var(--tonal),var(--tonal-fg)_12%)]",
  ghost: "text-fg hover:bg-surface-subtle",
} as const;

const SIZES = {
  sm: "h-8 px-3.5 text-[13px] leading-5",
  md: "h-10 px-[18px] text-label",
  lg: "h-[52px] px-6 text-base",
} as const;

export function button(variant: keyof typeof VARIANTS = "primary", size: keyof typeof SIZES = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
