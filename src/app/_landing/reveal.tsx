"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Revelar ao rolar (DESIGN §4.4): sobe e aparece ao entrar na tela, uma vez.
 * `index` escalona em 50 ms (máx. 6). O CSS em globals.css faz a transição.
 */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.revealed = "";
        io.disconnect();
      },
      // Dispara quando o topo passa de 80% da tela; com `threshold` 0.3, blocos altos no celular nunca revelariam.
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      className={className}
      style={{ "--reveal-i": Math.min(index, 6) } as CSSProperties}
    >
      {children}
    </div>
  );
}
