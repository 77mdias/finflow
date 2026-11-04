import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MoneyDisplay } from "./money-display";

const render = (cents: number) => renderToStaticMarkup(createElement(MoneyDisplay, { cents }));

describe("MoneyDisplay", () => {
  it("separa reais e centavos no formato pt-BR", () => {
    const html = render(984731);
    expect(html).toContain(">9.847<");
    expect(html).toContain(">,31<");
  });

  it("mantém o valor completo para leitores de tela", () => {
    expect(render(990)).toMatch(/class="sr-only">R\$\s9,90</);
    expect(render(0)).toMatch(/class="sr-only">R\$\s0,00</);
  });
});
