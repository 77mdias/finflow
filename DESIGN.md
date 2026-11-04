# FinFlow — Design System

> Fonte de verdade da linguagem visual do FinFlow. Vale para quem desenha e para quem codifica (inclusive agentes de IA): **use os tokens daqui, nunca valores soltos**.
> Contexto, referência e telas prioritárias: [`docs/VISUAL_BRIEF.md`](docs/VISUAL_BRIEF.md).

| Campo  | Valor                                                                           |
| ------ | ------------------------------------------------------------------------------- |
| Versão | 1.0                                                                             |
| Data   | 2026-11-04                                                                      |
| Stack  | Next.js 16 · Tailwind CSS v4 · shadcn/ui (Radix) · Recharts                     |
| Fontes | **Manrope** (display e números) · **Inter** (interface e texto) — ambas SIL OFL |

---

## 1. Princípios

1. **Calma antes de alarme.** Dinheiro gera ansiedade; a interface não. Muito espaço em branco, poucos elementos por tela, cor forte só onde há decisão ou risco.
2. **O número é o herói.** Cada tela tem um valor principal (saldo da fatura, total do mês) em destaque tipográfico. Todo o resto o apoia.
3. **Previsto ≠ confirmado.** O usuário sempre distingue o que já foi lançado do que é projeção (opacidade, hachura, rótulo "previsto").
4. **Uma ação primária por contexto.** No máximo um botão preenchido por área visível.
5. **Acessível por padrão.** Todo texto com contraste AA medido (§9), estado nunca só por cor, alvos de toque ≥ 44 px.

---

## 2. Cor

### 2.1 Paleta base

**Ink** (texto e superfícies escuras — grafite levemente violáceo)

| Token     | Hex       | Uso                                             |
| --------- | --------- | ----------------------------------------------- |
| `ink-950` | `#0E0D12` | Fundo do modo escuro, seções de contraste       |
| `ink-900` | `#16141B` | Superfície no modo escuro                       |
| `ink-850` | `#1E1B24` | Superfície elevada no modo escuro               |
| `ink-800` | `#211D26` | **Texto principal** (modo claro), botão escuro  |
| `ink-600` | `#67636D` | Texto secundário (modo claro)                   |
| `ink-400` | `#A9A5AF` | Texto secundário (modo escuro), ícones inativos |
| `ink-200` | `#E4E2E8` | Divisores fortes                                |
| `ink-100` | `#EFEDF2` | Superfície "muted", trilhas de progresso        |
| `ink-50`  | `#F6F5F8` | Superfície "subtle", fundo de inputs            |

**Iris** (marca — violeta)

| Token      | Hex       | Uso                                              |
| ---------- | --------- | ------------------------------------------------ |
| `iris-50`  | `#F2F0FF` | Fundo de botão tonal, seleção, destaque suave    |
| `iris-100` | `#E6E2FF` | Hover do tonal, chips                            |
| `iris-200` | `#CEC6FF` | Barras "previsto", ilustrações                   |
| `iris-300` | `#B3A8FF` | Links e foco no modo escuro                      |
| `iris-400` | `#9B8CFF` | Gráficos, botão primário no modo escuro          |
| `iris-500` | `#8571FF` | Gráficos, gradientes (não usar com texto branco) |
| `iris-600` | `#6A4DF5` | **Botão primário, links, foco** (modo claro)     |
| `iris-700` | `#5B3FE0` | Hover do primário, texto sobre `iris-50`         |
| `iris-800` | `#4630B0` | Pressionado                                      |

**Semânticas**

| Papel      | Fundo (`-50`) | Decorativo (`-500`) | Texto (`-700`)               | Modo escuro (texto/ícone) | Uso                                     |
| ---------- | ------------- | ------------------- | ---------------------------- | ------------------------- | --------------------------------------- |
| `positive` | `#E8F7EF`     | `#12B76A`           | `#087A45`                    | `#34D399`                 | Paga, rendimento, economia              |
| `warning`  | `#FEF6E7`     | `#F5A524`           | `#B45309`                    | `#FBBF24`                 | Fechada, vence em breve, teste acabando |
| `danger`   | `#FEF0EE`     | `#F04438`           | `#B42318` (botão: `#D92D20`) | `#F97066`                 | Vencida, ação destrutiva, erro          |
| `info`     | `iris-50`     | `iris-500`          | `iris-700`                   | `iris-300`                | Aberta, dicas                           |

> **Regra:** `-500` é só para preenchimentos sem texto (pontos, barras, ícones grandes). Texto colorido usa sempre `-700` (claro) ou a coluna "modo escuro".

### 2.2 Tokens semânticos (o que os componentes usam)

| Token                                     | Claro                  | Escuro                                |
| ----------------------------------------- | ---------------------- | ------------------------------------- |
| `--bg` (página)                           | `#FFFFFF`              | `ink-950`                             |
| `--surface` (cards)                       | `#FFFFFF`              | `ink-900`                             |
| `--surface-subtle`                        | `ink-50`               | `ink-850`                             |
| `--surface-muted`                         | `ink-100`              | `#2A2631`                             |
| `--surface-inverse` (seção de contraste)  | `ink-950`              | `#FFFFFF`                             |
| `--fg`                                    | `ink-800`              | `#F4F2F7`                             |
| `--fg-muted`                              | `ink-600`              | `ink-400`                             |
| `--fg-subtle` (placeholder, desabilitado) | `rgba(33,29,38,0.45)`  | `rgba(244,242,247,0.40)`              |
| `--border` (hairline)                     | `rgba(33,29,38,0.06)`  | `rgba(255,255,255,0.08)`              |
| `--border-strong`                         | `rgba(33,29,38,0.12)`  | `rgba(255,255,255,0.14)`              |
| `--primary` / `--primary-fg`              | `iris-600` / `#FFFFFF` | `iris-400` / `ink-950`                |
| `--primary-hover`                         | `iris-700`             | `iris-300`                            |
| `--tonal` / `--tonal-fg`                  | `iris-50` / `iris-700` | `rgba(155,140,255,0.14)` / `iris-300` |
| `--neutral-btn` / `--neutral-btn-fg`      | `ink-800` / `#FFFFFF`  | `#FFFFFF` / `ink-950`                 |
| `--ring` (foco)                           | `iris-600`             | `iris-300`                            |

### 2.3 Cores dos cartões virtuais

O enum `CARD_COLORS` do backend mapeia para gradientes (ângulo 135°). Texto sobre o cartão é sempre branco com sombra suave, exceto `lime` e `amber` (texto `ink-800`).

| `color`   | Gradiente           | Texto     |
| --------- | ------------------- | --------- |
| `violet`  | `#8571FF → #5B3FE0` | branco    |
| `blue`    | `#4F8BFF → #2457D6` | branco    |
| `sky`     | `#38BDF8 → #0B83C4` | branco    |
| `emerald` | `#34D399 → #0B8A5E` | branco    |
| `lime`    | `#D9F99D → #A3E635` | `ink-800` |
| `amber`   | `#FCD34D → #F59E0B` | `ink-800` |
| `orange`  | `#FB923C → #EA580C` | branco    |
| `red`     | `#F87171 → #DC2626` | branco    |
| `pink`    | `#F9A8D4 → #DB2777` | branco    |
| `slate`   | `#64748B → #334155` | branco    |
| `black`   | `#2A2631 → #0E0D12` | branco    |

### 2.4 Visualização de dados

- **Série principal:** gradiente vertical `iris-500 → iris-200` (topo → base), como barras de "ganho" — leitura imediata de crescimento.
- **Previsto:** mesma cor com 45% de opacidade **e** hachura diagonal de 1 px (`iris-300`) — nunca só a opacidade.
- **Por cartão:** usar a cor de início do gradiente do cartão (§2.3), na ordem dos cartões.
- **Categorias:** sequência `iris-500, #4F8BFF, #12B76A, #F5A524, #F04438, #DB2777, #0B83C4, #64748B`, máximo 7 + "Outros" (`ink-200`).
- Grade horizontal tracejada `--border-strong`, sem grade vertical; eixos em `--fg-muted` 12 px; valores em `tabular-nums`.

---

### 2.5 Instituições (selo do cartão)

Cada cartão pode indicar a **instituição** que o emite. No MVP o FinFlow **não embute logotipos**: o selo usa a **cor de referência** abaixo com as **iniciais**, ou um **ícone enviado pelo próprio usuário** (§6.7). As cores são aproximações para reconhecimento rápido — não reproduções oficiais — e o contraste das iniciais foi medido (AA ≥ 4,5:1).

| Instituição         | Iniciais                      | Cor de referência | Texto das iniciais | Contraste |
| ------------------- | ----------------------------- | ----------------- | ------------------ | --------- |
| Nubank              | NU                            | `#820AD1`         | branco             | 7,21      |
| PicPay              | PP                            | `#11A84E`         | `ink-800`          | 5,31      |
| Itaú                | IT                            | `#EC7000`         | `ink-800`          | 5,43      |
| Inter               | IN                            | `#FF7A00`         | `ink-800`          | 6,34      |
| C6 Bank             | C6                            | `#242424`         | branco             | 15,52     |
| Bradesco            | BR                            | `#CC092F`         | branco             | 5,76      |
| Santander           | SA                            | `#EC0000`         | branco             | 4,60      |
| Banco do Brasil     | BB                            | `#FCE300`         | `ink-800`          | 12,71     |
| Caixa               | CX                            | `#005CA9`         | branco             | 6,77      |
| Mercado Pago        | MP                            | `#00A3E0`         | `ink-800`          | 5,77      |
| BTG Pactual         | BT                            | `#0B2B5B`         | branco             | 13,90     |
| Neon                | NE                            | `#0BA5E9`         | `ink-800`          | 5,97      |
| PagBank             | PB                            | `#1FA85A`         | `ink-800`          | 5,37      |
| XP                  | XP                            | `#1A1A1A`         | branco             | 17,40     |
| Outra (texto livre) | 2 primeiras letras do emissor | `ink-600`         | branco             | 5,86      |

- A lista é editável (configuração do produto, não código espalhado); novas instituições entram com cor + iniciais + contraste verificado.
- A **cor do cartão** (§2.3) continua sendo escolha do usuário e é independente da instituição; o formulário sugere a cor mais próxima da instituição como padrão.

## 3. Tipografia

| Família                        | Papel                                                    | Configuração                                                                                      |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Manrope** (variável 200–800) | Títulos, valores monetários grandes, números de destaque | `next/font/google`, `display: swap`, `font-feature-settings: "tnum" 1` nos números                |
| **Inter** (variável 100–900)   | Interface, texto, tabelas, formulários                   | `next/font/google`, `font-feature-settings: "cv11", "ss01"`; `tabular-nums` em colunas de valores |

### 3.1 Escala

| Token        | Família | Tamanho / altura | Peso | Tracking           | Uso                                          |
| ------------ | ------- | ---------------- | ---- | ------------------ | -------------------------------------------- |
| `display-xl` | Manrope | 72 / 76          | 600  | −0.045em           | Landing (hero)                               |
| `display`    | Manrope | 56 / 60          | 600  | −0.04em            | Valor principal no desktop (saldo da fatura) |
| `display-sm` | Manrope | 40 / 46          | 600  | −0.035em           | Valor principal no mobile, título de landing |
| `heading-lg` | Manrope | 32 / 38          | 600  | −0.03em            | Título de página                             |
| `heading`    | Manrope | 24 / 31          | 600  | −0.025em           | Título de seção / card grande                |
| `heading-sm` | Inter   | 18 / 26          | 600  | −0.01em            | Título de card, diálogo                      |
| `body-lg`    | Inter   | 18 / 27          | 400  | −0.01em            | Subtítulo, texto de destaque                 |
| `body`       | Inter   | 15 / 22          | 400  | −0.005em           | Texto padrão do app                          |
| `body-sm`    | Inter   | 14 / 20          | 400  | 0                  | Linhas de tabela, metadados                  |
| `label`      | Inter   | 14 / 20          | 500  | 0                  | Botões, labels de campo                      |
| `caption`    | Inter   | 12 / 16          | 500  | 0.01em             | Eixos, badges, legendas                      |
| `overline`   | Inter   | 12 / 16          | 600  | 0.06em, CAIXA ALTA | Rótulo acima de seção (uso raro)             |

### 3.2 Valores monetários (`MoneyDisplay`)

Assinatura visual do produto: reais grandes, **centavos menores** e alinhados ao topo.

```
R$ 9.847,31   →   "R$" em heading-sm/fg-muted · "9.847" em display · ",31" em 55% do tamanho, mesmo peso
```

- Sempre `tabular-nums`; separadores pt-BR (`Intl.NumberFormat`), nunca formatação manual.
- Negativo: sinal "−" (U+2212) + cor `danger` só se for débito inesperado; estornos usam `positive`.
- Variação: chip com seta `▲/▼` + valor + período (`▲ R$ 120,00 vs. mês passado`) — cor e seta juntas.

---

## 4. Espaço, forma e profundidade

### 4.1 Espaçamento (base 4 px)

`0 · 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128`

| Contexto                    | Valor                              |
| --------------------------- | ---------------------------------- |
| Padding de card             | 24 (mobile 20)                     |
| Padding de card de destaque | 32–48                              |
| Gap entre cards             | 16 (mobile 12)                     |
| Entre seções de página      | 48 (mobile 32)                     |
| Entre seções de landing     | 128 (mobile 80)                    |
| Margem lateral da página    | 16 mobile · 24 tablet · 40 desktop |

### 4.2 Raios

| Token         | Valor | Uso                                                 |
| ------------- | ----- | --------------------------------------------------- |
| `radius-sm`   | 8     | Badges retangulares, tooltips                       |
| `radius-md`   | 12    | Campos de formulário, itens de menu                 |
| `radius-lg`   | 16    | Cartão virtual (proporção 1.586:1), imagens         |
| `radius-xl`   | 24    | **Cards padrão**, diálogos                          |
| `radius-2xl`  | 32    | Painéis grandes, seções-bloco da landing            |
| `radius-full` | 9999  | **Botões**, chips, segmented control, busca, avatar |

### 4.3 Elevação

Superfícies se separam por **borda hairline**, não por sombra. Sombra só para o que flutua.

| Token             | Valor                                                      | Uso                           |
| ----------------- | ---------------------------------------------------------- | ----------------------------- |
| `shadow-hairline` | `0 0 0 1px var(--border)`                                  | Cards em repouso              |
| `shadow-sm`       | `0 1px 2px rgba(33,29,38,0.06)`                            | Botão neutro, segmented ativo |
| `shadow-md`       | `0 8px 20px rgba(33,29,38,0.06), 0 0 6px rgba(0,0,0,0.06)` | Popovers, menus, toasts       |
| `shadow-lg`       | `0 24px 48px rgba(33,29,38,0.12), 0 0 0 1px var(--border)` | Diálogos, sheets              |
| `shadow-card`     | `0 12px 28px rgba(33,29,38,0.18)`                          | Cartão virtual                |

No modo escuro, sombras perdem efeito: usar `--surface` mais claro + `--border-strong`.

### 4.4 Movimento

| Token           | Valor                            | Uso                                   |
| --------------- | -------------------------------- | ------------------------------------- |
| `duration-fast` | 120 ms                           | Hover, pressionado                    |
| `duration-base` | 200 ms                           | Abrir menus, trocar abas              |
| `duration-slow` | 320 ms                           | Sheets, diálogos, entrada de gráficos |
| `ease-out`      | `cubic-bezier(0.22, 1, 0.36, 1)` | Entradas                              |
| `ease-in-out`   | `cubic-bezier(0.65, 0, 0.35, 1)` | Transições de layout                  |

Números animam por contagem (≤ 600 ms) só na primeira renderização. Com `prefers-reduced-motion`, tudo vira troca instantânea.

### 4.5 Breakpoints e largura

| Nome   | Min  | Layout do app                                                      |
| ------ | ---- | ------------------------------------------------------------------ |
| `base` | 0    | 1 coluna, bottom nav + FAB                                         |
| `sm`   | 640  | 1 coluna, cards em 2 colunas quando curtos                         |
| `md`   | 768  | 2 colunas                                                          |
| `lg`   | 1024 | Sidebar fixa (248 px) + conteúdo                                   |
| `xl`   | 1280 | Conteúdo máx. **1120 px**; landing máx. **1040 px** de texto/cards |

---

## 5. Tailwind v4 (`src/app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-manrope), var(--font-inter), ui-sans-serif, sans-serif;

  --color-ink-950: #0e0d12;
  --color-ink-900: #16141b;
  --color-ink-850: #1e1b24;
  --color-ink-800: #211d26;
  --color-ink-600: #67636d;
  --color-ink-400: #a9a5af;
  --color-ink-200: #e4e2e8;
  --color-ink-100: #efedf2;
  --color-ink-50: #f6f5f8;

  --color-iris-50: #f2f0ff;
  --color-iris-100: #e6e2ff;
  --color-iris-200: #cec6ff;
  --color-iris-300: #b3a8ff;
  --color-iris-400: #9b8cff;
  --color-iris-500: #8571ff;
  --color-iris-600: #6a4df5;
  --color-iris-700: #5b3fe0;
  --color-iris-800: #4630b0;

  --color-positive-50: #e8f7ef;
  --color-positive-500: #12b76a;
  --color-positive-700: #087a45;
  --color-warning-50: #fef6e7;
  --color-warning-500: #f5a524;
  --color-warning-700: #b45309;
  --color-danger-50: #fef0ee;
  --color-danger-500: #f04438;
  --color-danger-600: #d92d20;
  --color-danger-700: #b42318;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-2xl: 32px;

  --shadow-hairline: 0 0 0 1px var(--border);
  --shadow-md: 0 8px 20px rgb(33 29 38 / 0.06), 0 0 6px rgb(0 0 0 / 0.06);
  --shadow-lg: 0 24px 48px rgb(33 29 38 / 0.12), 0 0 0 1px var(--border);

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}

:root {
  --bg: #ffffff;
  --surface: #ffffff;
  --surface-subtle: var(--color-ink-50);
  --surface-muted: var(--color-ink-100);
  --fg: var(--color-ink-800);
  --fg-muted: var(--color-ink-600);
  --fg-subtle: rgb(33 29 38 / 0.45);
  --border: rgb(33 29 38 / 0.06);
  --border-strong: rgb(33 29 38 / 0.12);
  --primary: var(--color-iris-600);
  --primary-fg: #ffffff;
  --primary-hover: var(--color-iris-700);
  --tonal: var(--color-iris-50);
  --tonal-fg: var(--color-iris-700);
  --ring: var(--color-iris-600);
  color-scheme: light;
}

:root[data-theme="dark"] {
  --bg: var(--color-ink-950);
  --surface: var(--color-ink-900);
  --surface-subtle: var(--color-ink-850);
  --surface-muted: #2a2631;
  --fg: #f4f2f7;
  --fg-muted: var(--color-ink-400);
  --fg-subtle: rgb(244 242 247 / 0.4);
  --border: rgb(255 255 255 / 0.08);
  --border-strong: rgb(255 255 255 / 0.14);
  --primary: var(--color-iris-400);
  --primary-fg: var(--color-ink-950);
  --primary-hover: var(--color-iris-300);
  --tonal: rgb(155 140 255 / 0.14);
  --tonal-fg: var(--color-iris-300);
  --ring: var(--color-iris-300);
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* mesmos valores de [data-theme="dark"] */
  }
}
```

---

## 6. Componentes

Base: shadcn/ui (Radix) com os tokens acima. Componentes de domínio ficam em `src/modules/*/ui/components`.

### 6.1 Botão

| Variante  | Fundo / texto                                   | Uso                                                   |
| --------- | ----------------------------------------------- | ----------------------------------------------------- |
| `primary` | `--primary` / `--primary-fg`                    | A ação principal da área (no máx. 1)                  |
| `neutral` | `--neutral-btn` / `--neutral-btn-fg`            | CTA no cabeçalho, confirmação neutra                  |
| `tonal`   | `--tonal` / `--tonal-fg`                        | Ação secundária ("Saiba mais", "Ver fatura")          |
| `ghost`   | transparente / `--fg`; hover `--surface-subtle` | Ações terciárias, ícones                              |
| `danger`  | `danger-600` / branco                           | Excluir, cancelar assinatura (sempre com confirmação) |

| Tamanho | Altura | Padding horizontal | Texto         |
| ------- | ------ | ------------------ | ------------- |
| `sm`    | 32     | 14                 | `label` 13 px |
| `md`    | 40     | 18                 | `label` 14 px |
| `lg`    | 52     | 24                 | `label` 16 px |

Forma `radius-full`. Ícone 16/18/20 px com gap 8. Estados: hover (`--primary-hover`, 120 ms), pressionado (escala 0.98), foco (`outline: 2px solid var(--ring); outline-offset: 2px`), carregando (spinner substitui o ícone, largura preservada), desabilitado (`opacity .45`, sem sombra). No mobile, CTA principal de formulário ocupa 100% da largura.

### 6.2 Campos de formulário

- Altura 44, `radius-md`, fundo `--surface-subtle`, sem borda em repouso; hover `--surface-muted`; foco: fundo `--surface` + anel `--ring` 2 px.
- Label `label` acima (gap 6), ajuda/erro `body-sm` abaixo; erro em `danger-700` com ícone.
- `MoneyInput`: prefixo "R$" fixo em `--fg-muted`, máscara pt-BR, teclado numérico, alinhamento à direita em tabelas.
- `DateOnlyPicker`: formato `dd/mm/aaaa` exibido, valor `YYYY-MM-DD`.
- Campo único de destaque (busca, e-mail da landing): `radius-full`, altura 48.

### 6.3 Card

Fundo `--surface`, `radius-xl`, `shadow-hairline`, padding 24. Cabeçalho: título `heading-sm` + ação `ghost sm` à direita. Card clicável: hover eleva para `shadow-md` (200 ms) e cursor pointer; o card inteiro é o alvo (link no título + `::after` cobrindo).

### 6.4 Stat tile

Ícone 24 px em `iris-500` (sem caixa) · valor em Manrope 28/32 600 · descrição `body-sm`/`fg-muted`. Em grade de 3 (desktop), 2 (tablet), 1 (mobile), gap 16.

### 6.5 Segmented control

Trilho `--surface-subtle` `radius-full` padding 4; item ativo `--surface` + `shadow-sm`; texto `label` 13 px. Usado para períodos (`1M · 3M · 12M · Tudo · Previsto ✦`) e alternâncias curtas (≤ 5 opções).

### 6.6 Badge de status

`caption`, altura 24, padding 0 10, `radius-full`, **ícone + texto** sempre.

| Status                     | Fundo / texto                                   | Ícone      |
| -------------------------- | ----------------------------------------------- | ---------- |
| Aberta (`OPEN`)            | `iris-50` / `iris-700`                          | relógio    |
| Fechada (`CLOSED`)         | `warning-50` / `warning-700`                    | documento  |
| Parcial (`PARTIALLY_PAID`) | `warning-50` / `warning-700`                    | meia-lua   |
| Paga (`PAID`)              | `positive-50` / `positive-700`                  | check      |
| Vencida (`OVERDUE`)        | `danger-50` / `danger-700`                      | alerta     |
| Futura (`FUTURE`)          | transparente + `--border-strong` / `--fg-muted` | calendário |
| Em teste (`TRIAL`)         | `iris-50` / `iris-700`                          | ampulheta  |
| Pausada / Cancelada        | `--surface-muted` / `--fg-muted`                | pausa / x  |

### 6.7 Cartão virtual (`CardVisual`) e selo da instituição

**Cartão:** proporção 1.586:1 (ISO/IEC 7810), `radius-lg`, gradiente da §2.3, `shadow-card`, textura de ruído a 4% opcional. Conteúdo:

- canto superior esquerdo: **selo da instituição** (28 px) + apelido (`heading-sm`);
- canto superior direito: bandeira **só como texto** (`VISA`, `MASTERCARD`, `ELO`… em `caption` 600, 85% de opacidade) — nunca logotipo de bandeira;
- centro: "•••• 1234" se houver `last4` (fictício);
- rodapé: "Fecha dia 25 · Vence dia 5".

Arquivado: escala de cinza + 60% de opacidade. O cartão é uma **representação**, não uma réplica: nunca imitar a arte/layout de um cartão real (cores e logo da instituição ficam restritos ao selo).

**Selo da instituição (`InstitutionBadge`)** — `radius-md` (ícone quadrado arredondado), tamanhos 20 (listas), 28 (cartão), 40 (detalhe/formulário). Ordem de exibição:

1. **Ícone personalizado** enviado pelo usuário (se existir);
2. **Iniciais** sobre a cor de referência da instituição (§2.5), `label` 600;
3. **Genérico:** ícone de cartão (lucide `credit-card`) sobre `--surface-muted`.

Sobre o cartão (fundo em gradiente), o selo ganha anel `0 0 0 1.5px rgba(255,255,255,.6)` para destacar. O selo também aparece em `ChargeRow`, faturas e no seletor de cartão dos formulários, para reconhecer o cartão de relance.

**Ícone personalizado (upload do usuário)**

| Regra                   | Valor                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Formatos aceitos        | PNG, JPEG, WebP (sem SVG — risco de script embutido)                                                                                     |
| Tamanho máximo do envio | 512 KB                                                                                                                                   |
| Processamento           | Recorte quadrado no cliente; o servidor **re-codifica** para WebP 256×256, remove metadados (EXIF) e rejeita o que não for imagem válida |
| Armazenamento           | Privado (R2), acessível só pelo dono via URL assinada de curta duração; nunca público, nunca compartilhado entre usuários                |
| Escopo                  | Por cartão; substituir ou remover a qualquer momento (remover volta para as iniciais)                                                    |
| Aviso no envio          | "Use apenas imagens que você tem direito de usar. O ícone fica visível só para você."                                                    |
| LGPD                    | Incluído na exportação de dados; apagado no purge da conta                                                                               |

UX do envio: no formulário do cartão, "Ícone do cartão" com pré-visualização ao vivo do `CardVisual`, ações "Enviar imagem", "Usar iniciais" e "Remover". Estados de erro: formato/tamanho inválido com mensagem clara (`body-sm`, `danger-700`).

### 6.8 Linha de cobrança (`ChargeRow`)

Grid `[ícone 32] [descrição + meta] [valor]`, altura mínima 56, divisor hairline. Meta: data · categoria · `2/6` se parcela. Valor à direita em `tabular-nums`. **Previsto**: valor em `--fg-muted`, ícone com borda tracejada e rótulo "previsto". Ajuste negativo: valor em `positive-700` com "−".

### 6.9 Navegação

- **Desktop (≥ lg):** sidebar 248 px, fundo `--bg`, itens `label` com ícone 20, ativo em `--surface-subtle` + texto `--fg`; inativo `--fg-muted`. Rodapé da sidebar: perfil.
- **Mobile:** bottom nav 64 px + safe-area, 4 itens (Início, Cartões, Assinaturas, Calendário) + **FAB** "+" (56 px, `--primary`, `radius-full`) acima à direita, que abre sheet com "Assinatura · Despesa · Cartão".
- Topo: título da página `heading-lg` + sino de notificações com contador (`danger-500`, ponto de 8 px quando > 0).

### 6.10 Sheet, diálogo, toast

- Sheet (mobile e formulários): `radius-2xl` só no topo, alça de 4×36 px, `shadow-lg`, abre com 320 ms `ease-out`.
- Diálogo: largura máx. 480, `radius-xl`, padding 24, título `heading-sm`, ações à direita (mobile: empilhadas, primária em cima).
- Toast: `ink-800` com texto branco (inverso), `radius-full` se 1 linha / `radius-lg` se mais, canto inferior (mobile: acima da bottom nav), 4 s, `aria-live="polite"`.

### 6.11 Estado vazio

Ilustração simples em traço (`iris-300`, 120 px) · título `heading-sm` · 1 frase `body`/`fg-muted` · 1 botão `primary`. Ex.: "Nenhum cartão ainda — Crie seu primeiro cartão para começar a acompanhar suas faturas."

---

## 7. Layout das telas principais

| Tela            | Estrutura                                                                                                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**   | Cabeçalho com mês (segmented ◀ ▶) · **Total do mês** (`MoneyDisplay` display) + variação · faixa de cartões (carrossel horizontal mobile / grade desktop) com fatura atual e barra de limite · gráfico de projeção 12 meses · "Próximos 14 dias" (lista) · gasto por categoria (rosca + lista) |
| **Fatura**      | Cartão visual pequeno + mês com navegação · `MoneyDisplay` do saldo + badge de status · datas (fechamento · vencimento) · CTA "Registrar pagamento" · lista de cobranças agrupada por data · pagamentos                                                                                        |
| **Assinaturas** | Resumo (custo mensal / anual) · filtros em chips · lista de cards com logo (iniciais em avatar quando não houver), valor, ciclo, próxima cobrança e cartão                                                                                                                                     |
| **Landing**     | Hero centrado (`display-xl`, subtítulo `body-lg`, 2 CTAs `lg`) · mockup do app · faixa de estatísticas · bloco escuro de contraste (`--surface-inverse`, `radius-2xl`) · grade de benefícios · FAQ em acordeão · CTA final                                                                     |

---

## 8. Conteúdo e voz

- **pt-BR, segunda pessoa ("você"), frases curtas.** Verbos no imperativo nos botões: "Registrar pagamento", não "Registro de pagamento".
- Números sempre formatados pela localidade: `R$ 1.234,56`, `05/12/2026`, "vence em 3 dias", "há 2 horas".
- Sem jargão de banco quando houver palavra simples ("valor que falta" > "saldo devedor").
- Erros dizem **o que aconteceu e o que fazer**: "O valor passa do saldo de R$ 177,80. Ajuste o valor ou registre um pagamento parcial."
- Nunca culpar o usuário; nunca usar CAIXA ALTA para alarme.

---

## 9. Acessibilidade (medida)

Contrastes calculados pela fórmula WCAG 2.1 (mín. 4,5:1 texto, 3:1 componentes):

| Par                                                                     | Contraste    |
| ----------------------------------------------------------------------- | ------------ |
| `ink-800` sobre branco                                                  | 16,56        |
| `ink-600` (secundário) sobre branco / sobre `ink-50`                    | 5,86 / 5,40  |
| Branco sobre `iris-600` (botão primário) · `iris-600` como link         | 5,26         |
| `iris-700` sobre `iris-50` (tonal, badge "Aberta")                      | 5,78         |
| `positive-700` sobre branco / sobre `positive-50`                       | 5,41 / 4,89  |
| `warning-700` sobre `warning-50`                                        | 4,67         |
| `danger-700` sobre `danger-50` · branco sobre `danger-600`              | 5,92 · 4,83  |
| Escuro: `#F4F2F7` sobre `ink-950` · `ink-400` sobre `ink-900`           | 17,41 · 7,55 |
| Escuro: `iris-300` sobre `ink-900` · `ink-950` sobre `iris-400` (botão) | 8,66 · 6,99  |

Regras: foco sempre visível (`--ring`); status com ícone + texto; alvos ≥ 44×44; gráficos com tabela/lista equivalente (`aria-describedby`); `prefers-reduced-motion` respeitado; tamanho mínimo de texto 12 px (só em `caption`).

---

## 10. Faça / não faça

| ✅ Faça                                                              | ❌ Não faça                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Um valor principal grande por tela                                   | Vários números do mesmo tamanho competindo                |
| `iris-600` em botões e links com texto                               | `iris-400/500` com texto branco (contraste < 4,5)         |
| Bordas hairline para separar cards                                   | Sombras pesadas em todos os cards                         |
| "Previsto" com opacidade **e** hachura/rótulo                        | Distinguir previsto só pela cor                           |
| Pílulas para botões e chips                                          | Misturar botões pílula e retangulares                     |
| Ícones de traço 1,5 px (lucide)                                      | Ícones preenchidos misturados com traço                   |
| Selo com iniciais + cor de referência, ou ícone enviado pelo usuário | Logotipos de bancos/bandeiras embutidos no app (ver §11)  |
| Bandeira do cartão como texto (`VISA`, `ELO`)                        | Imitar a arte de um cartão real ou o logo de uma bandeira |
| Tokens (`bg-[--surface]`, `text-ink-600`)                            | Hex soltos no código                                      |

---

## 11. Futuro: logotipos oficiais das instituições

**Fora do MVP.** Exibir logotipos oficiais embutidos no app (galeria de logos de bancos e apps) fica para uma fase posterior, porque logos são marcas registradas e obras protegidas e o FinFlow é um produto comercial. Quando for adotado, valem **todas** as condições abaixo:

| Condição                | Detalhe                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base legal              | Avaliação jurídica prévia (Lei 9.279/96 — marcas; Lei 9.610/98 — direito autoral) e, idealmente, autorização da instituição ou fornecedor de logos com termos de uso explícitos |
| Uso apenas referencial  | Logo pequeno, no lugar do selo (§6.7), só para identificar a instituição — nunca como arte do cartão nem como destaque visual                                                   |
| Integridade             | Sem alterar cores, proporções ou recortes; seguir o manual de marca de cada instituição                                                                                         |
| Sem afiliação implícita | Aviso visível na tela de personalização: "Marcas pertencem aos seus titulares. O FinFlow não é afiliado a elas."                                                                |
| Fora do marketing       | Logos de terceiros nunca em landing, anúncios, capturas da loja ou materiais de divulgação                                                                                      |
| Bandeiras de cartão     | Visa, Mastercard, Elo, Amex e Hipercard continuam **só como texto** (manuais de marca restringem o uso por não emissores)                                                       |
| Retirada                | Processo para remover um logo prontamente se a instituição solicitar                                                                                                            |
| Fallback                | Ícone personalizado do usuário e iniciais (§2.5) continuam disponíveis                                                                                                          |
