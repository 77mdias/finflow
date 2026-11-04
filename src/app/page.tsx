import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ChartColumnIncreasing,
  Check,
  ChevronDown,
  Clock,
  CodeXml,
  FileText,
  Hourglass,
  Layers,
  Repeat,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PLAN_LIMITS } from "@/shared/application/plan-limits";
import { button } from "@/shared/ui/button";
import { MoneyDisplay } from "@/shared/ui/money-display";

import { CardStage } from "./_landing/card-stage";
import { Reveal } from "./_landing/reveal";

const REPO = "https://github.com/77mdias/finflow";
// Largura total com as margens laterais do DESIGN §4.1; só blocos de texto limitam a largura (legibilidade).
const CONTAINER = "w-full px-4 sm:px-6 lg:px-10";

export default function HomePage() {
  return (
    <>
      <a
        href="#conteudo"
        className={`${button("neutral", "md")} sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50`}
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo">
        <Hero />
        <Stats />
        <Features />
        <OpenSource />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function Wordmark() {
  return (
    <span className="font-display text-heading">
      fin<span className="text-primary">flow</span>
    </span>
  );
}

function SiteHeader() {
  const nav = [
    ["#funcionalidades", "Funcionalidades"],
    ["#codigo-aberto", "Código aberto"],
    ["#planos", "Planos"],
    ["#perguntas", "Perguntas"],
  ] as const;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-4`}>
        <Link href="/" aria-label="FinFlow, página inicial" className="rounded-md">
          <Wordmark />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {nav.map(([href, label]) => (
            <a key={href} href={href} className={button("ghost", "sm")}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={REPO} className={`${button("ghost", "md")} max-sm:hidden`}>
            <CodeXml aria-hidden size={18} strokeWidth={1.5} />
            GitHub
          </a>
          <Link href="/entrar" className={button("neutral", "md")}>
            Entrar
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className={`${CONTAINER} pt-14 text-center lg:pt-24`}>
      <div className="mx-auto max-w-[880px] animate-hero-in">
        <p className="inline-flex h-7 items-center gap-1.5 rounded-full bg-tonal px-3 text-caption text-tonal-fg">
          <CodeXml aria-hidden size={14} strokeWidth={1.5} />
          Código aberto · AGPL-3.0
        </p>
        <h1
          id="hero-titulo"
          className="mt-6 font-display text-display-sm text-balance sm:text-display lg:text-display-xl"
        >
          Veja suas faturas antes de elas chegarem.
        </h1>
        <p className="mx-auto mt-6 max-w-[620px] text-body-lg text-pretty text-fg-muted">
          Monte seus cartões, cadastre assinaturas e parcelas, e o FinFlow calcula cada fatura, avisa antes do
          vencimento e mostra os próximos 12 meses. Sem conectar nenhum cartão real.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/entrar" className={button("primary", "lg")}>
            Começar grátis
            <ArrowRight aria-hidden size={20} strokeWidth={1.5} />
          </Link>
          <a href={REPO} className={button("tonal", "lg")}>
            Ver o código no GitHub
          </a>
        </div>
      </div>

      <div className="relative mt-14 animate-hero-in [animation-delay:150ms]">
        <div
          role="img"
          aria-label="Quatro cartões de crédito em 3D abertos em leque, ao lado de um resumo de fatura do FinFlow"
          className="relative h-[300px] overflow-hidden rounded-2xl bg-surface-subtle shadow-hairline sm:h-[440px] lg:h-[560px] 2xl:h-[640px]"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(55%_60%_at_50%_45%,var(--tonal),transparent)]"
          />
          <CardStage />
        </div>
        <InvoicePreview />
        <ReminderPreview />
      </div>
    </section>
  );
}

/** Mockup do produto sobre o palco 3D (valores fictícios). */
function InvoicePreview() {
  return (
    <div
      aria-hidden
      className="mt-4 rounded-xl bg-surface p-5 text-left shadow-lg sm:absolute sm:bottom-6 sm:left-6 sm:mt-0 sm:w-[300px]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-fg-muted">Fatura de dezembro</p>
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-50 px-2.5 text-caption text-warning-700">
          <FileText size={14} strokeWidth={1.5} />
          Fechada
        </span>
      </div>
      <div className="mt-2">
        <MoneyDisplay cents={128460} size="heading-lg" />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full w-[26%] rounded-full bg-iris-500" />
      </div>
      <p className="mt-2 text-body-sm text-fg-muted">Vence em 3 dias · 26% do limite</p>
    </div>
  );
}

function ReminderPreview() {
  return (
    <div
      aria-hidden
      className="absolute top-6 right-6 hidden items-center gap-3 rounded-full bg-surface py-2 pr-4 pl-2 text-left shadow-md md:flex"
    >
      <span className="grid size-8 place-items-center rounded-full bg-tonal text-tonal-fg">
        <BellRing size={16} strokeWidth={1.5} />
      </span>
      <span className="text-body-sm">
        O teste do streaming acaba <strong className="font-semibold">amanhã</strong>
      </span>
    </div>
  );
}

function Stats() {
  const stats: [LucideIcon, string, string][] = [
    [ChartColumnIncreasing, "12 meses", "de projeção por cartão, com parcelas e assinaturas"],
    [BellRing, "3 dias antes", "do vencimento, o lembrete da fatura chega no seu e-mail"],
    [ShieldCheck, "0 dados bancários", "nenhum número de cartão, CVV ou senha do banco"],
  ];
  return (
    <section aria-label="FinFlow em números" className={`${CONTAINER} mt-20 lg:mt-32`}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([Icon, value, text], i) => (
          <li key={value}>
            <Reveal index={i} className="h-full rounded-xl bg-surface p-6 shadow-hairline">
              <Icon aria-hidden size={24} strokeWidth={1.5} className="text-iris-500" />
              <p className="mt-4 font-display text-[28px] leading-8 font-semibold tracking-[-0.025em]">
                {value}
              </p>
              <p className="mt-1 text-body-sm text-fg-muted">{text}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Reveal className="mx-auto max-w-[720px] text-center">
      <h2 id={id} className="font-display text-display-sm text-balance lg:text-display">
        {title}
      </h2>
      <p className="mt-4 text-body-lg text-pretty text-fg-muted">{children}</p>
    </Reveal>
  );
}

function Features() {
  const features: [LucideIcon, string, string][] = [
    [
      CalendarClock,
      "Faturas como as do banco",
      "Cada cartão tem seu dia de fechamento e vencimento: uma compra no dia 28 num cartão que fecha no dia 25 entra na fatura seguinte. Registre pagamentos totais ou parciais.",
    ],
    [
      Repeat,
      "Assinaturas sob controle",
      "Semanais, mensais ou anuais. Pause, cancele, troque de cartão e registre reajustes, com o histórico de preços guardado.",
    ],
    [
      Hourglass,
      "Testes grátis com prazo",
      "Marque até quando vai o teste e receba um aviso antes de ele virar cobrança.",
    ],
    [
      Layers,
      "Parcelas sem surpresa",
      "Lance uma compra em 6x e veja cada parcela na fatura certa dos próximos meses.",
    ],
    [
      ChartColumnIncreasing,
      "Os próximos 12 meses",
      "Projeção por cartão e de todos juntos. O que é previsto aparece separado do que já foi lançado.",
    ],
    [
      BellRing,
      "Lembretes que chegam antes",
      "Avisos por e-mail e no app antes do vencimento da fatura e da cobrança de cada assinatura, com resumo diário.",
    ],
  ];
  return (
    <section aria-labelledby="funcionalidades" className={`${CONTAINER} mt-20 lg:mt-32`}>
      <SectionHeading id="funcionalidades" title="Tudo o que sai dos seus cartões, num lugar só.">
        Quanto você vai pagar, quando e em qual cartão — respondido antes de a fatura chegar.
      </SectionHeading>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
        {features.map(([Icon, title, text], i) => (
          <li key={title}>
            <Reveal index={i} className="h-full rounded-xl bg-surface p-6 shadow-hairline">
              <Icon aria-hidden size={24} strokeWidth={1.5} className="text-iris-500" />
              <h3 className="mt-4 text-heading-sm">{title}</h3>
              <p className="mt-2 text-body text-fg-muted">{text}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OpenSource() {
  const points = [
    "Self-host grátis, sem limite de cartões ou assinaturas",
    "Código auditável: veja como cada fatura é calculada",
    "Seus dados no seu próprio PostgreSQL",
    "Quem oferece o FinFlow como serviço publica as mudanças (AGPL)",
  ];
  const steps = [
    `git clone ${REPO}`,
    "cd finflow && cp .env.example .env",
    "docker compose up -d",
    "pnpm install && pnpm db:deploy",
    "pnpm dev",
  ];
  return (
    <section aria-labelledby="codigo-aberto" className={`${CONTAINER} theme-dark mt-20 lg:mt-32`}>
      <Reveal className="grid items-center gap-10 rounded-2xl bg-surface p-6 text-fg ring-1 ring-border-strong sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:p-14">
        <div>
          <p className="text-overline text-tonal-fg uppercase">Código aberto</p>
          <h2 id="codigo-aberto" className="mt-3 font-display text-display-sm text-balance">
            Seu dinheiro, seu servidor, suas regras.
          </h2>
          <p className="mt-4 text-body-lg text-fg-muted">
            O FinFlow é código aberto sob a licença AGPL-3.0. Hospede onde quiser ou use a nossa nuvem e deixe
            a infraestrutura com a gente.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-body">
                <Check aria-hidden size={20} strokeWidth={1.5} className="mt-px shrink-0 text-tonal-fg" />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={REPO} className={button("neutral", "lg")}>
              <CodeXml aria-hidden size={20} strokeWidth={1.5} />
              Ver no GitHub
            </a>
            <a href={`${REPO}#rodando-localmente`} className={button("ghost", "lg")}>
              Guia de instalação
            </a>
          </div>
        </div>
        <figure className="min-w-0 rounded-xl bg-surface-subtle ring-1 ring-border">
          <figcaption className="flex items-center gap-2 border-b border-border px-5 py-3 text-caption text-fg-muted">
            <Terminal aria-hidden size={16} strokeWidth={1.5} />
            Rodando na sua máquina
          </figcaption>
          <pre className="overflow-x-auto px-5 py-4 font-mono text-body-sm leading-7">
            <code>
              {steps.map((s) => (
                <span key={s} className="block">
                  <span aria-hidden className="text-fg-subtle select-none">
                    ${" "}
                  </span>
                  {s}
                </span>
              ))}
            </code>
          </pre>
        </figure>
      </Reveal>
    </section>
  );
}

const limitLabel = (n: number, noun: string, unlimited: string) =>
  Number.isFinite(n) ? `Até ${n} ${noun}` : unlimited;

function SoonBadge() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2.5 text-caption text-fg-muted">
      <Clock aria-hidden size={14} strokeWidth={1.5} />
      Em breve
    </span>
  );
}

type Plan = {
  name: string;
  cents: number;
  pitch: string;
  features: string[];
  soon?: string[];
  cta?: { label: string; variant: "primary" | "tonal" };
  featured?: boolean;
};

function Pricing() {
  const { FREE, PRO } = PLAN_LIMITS;
  const plans: Plan[] = [
    {
      name: "Free",
      cents: 0,
      pitch: "Para organizar os cartões e as assinaturas do dia a dia.",
      features: [
        limitLabel(FREE.cards, "cartões", "Cartões ilimitados"),
        limitLabel(FREE.subscriptions, "assinaturas", "Assinaturas ilimitadas"),
        "Faturas automáticas, parcelas e pagamentos",
        "Projeção dos próximos 12 meses",
        "Lembretes por e-mail e no app",
        "Exportar e excluir seus dados",
      ],
      cta: { label: "Começar grátis", variant: "tonal" },
    },
    {
      name: "Pro",
      cents: 990,
      pitch: "Para quem tem muitos cartões ou separa o pessoal do trabalho.",
      features: [
        limitLabel(PRO.cards, "cartões", "Cartões ilimitados"),
        limitLabel(PRO.subscriptions, "assinaturas", "Assinaturas ilimitadas"),
        "Tudo do plano Free",
      ],
      soon: ["Exportação em CSV e PDF", "Notificações push", "Insights para economizar"],
      cta: { label: "Assinar Pro", variant: "primary" },
      featured: true,
    },
    {
      name: "Família",
      cents: 1990,
      pitch: "O Pro para a casa toda, num espaço compartilhado.",
      features: ["Tudo do plano Pro", "Até 5 pessoas no mesmo espaço", "Papéis para cada pessoa"],
    },
  ];

  return (
    <section aria-labelledby="planos" className={`${CONTAINER} mt-20 lg:mt-32`}>
      <SectionHeading id="planos" title="Comece grátis. Assine quando precisar de mais.">
        O código é aberto e o self-host não tem limites. Na nuvem, o plano Free cobre o essencial.
      </SectionHeading>
      <ul className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <li key={plan.name}>
            <Reveal
              index={i}
              className={`flex h-full flex-col rounded-xl p-6 sm:p-8 ${
                plan.featured
                  ? "bg-surface ring-2 ring-primary"
                  : plan.cta
                    ? "bg-surface shadow-hairline"
                    : "bg-surface-subtle"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-heading-sm">{plan.name}</h3>
                {plan.featured && (
                  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-tonal px-2.5 text-caption text-tonal-fg">
                    <Check aria-hidden size={14} strokeWidth={1.5} />
                    Mais completo
                  </span>
                )}
                {!plan.cta && <SoonBadge />}
              </div>
              <p className="mt-4 flex items-end gap-1">
                <MoneyDisplay cents={plan.cents} size="heading-lg" />
                <span className="mb-1 text-body-sm text-fg-muted">/mês</span>
              </p>
              <p className="mt-3 text-body text-fg-muted">{plan.pitch}</p>
              <div className="mt-6 flex-1">
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-body">
                      <Check
                        aria-hidden
                        size={20}
                        strokeWidth={1.5}
                        className="mt-px shrink-0 text-iris-500"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.soon && (
                  <>
                    <p className="mt-6 flex items-center gap-3 text-caption text-fg-muted">
                      Em breve
                      <span aria-hidden className="h-px flex-1 bg-border-strong" />
                    </p>
                    <ul className="mt-3 space-y-3">
                      {plan.soon.map((f) => (
                        <li key={f} className="flex items-start gap-3 text-body text-fg-muted">
                          <Clock aria-hidden size={20} strokeWidth={1.5} className="mt-px shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              {plan.cta ? (
                <Link href="/entrar" className={`${button(plan.cta.variant, "lg")} mt-8 w-full`}>
                  {plan.cta.label}
                </Link>
              ) : (
                <p className="mt-8 flex h-[52px] items-center justify-center text-label text-fg-muted">
                  Disponível em breve
                </p>
              )}
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-body text-fg-muted">
        Prefere hospedar? O self-host é grátis e sem limites.{" "}
        <a href="#codigo-aberto" className="font-medium text-primary underline-offset-4 hover:underline">
          Veja como
        </a>
      </p>
    </section>
  );
}

function Faq() {
  const items: [string, string][] = [
    [
      "Preciso informar o número do meu cartão?",
      "Não. Os cartões do FinFlow são representações que você monta: apelido, cor, limite e os dias de fechamento e vencimento. Nunca pedimos número do cartão, CVV, validade ou senha do banco.",
    ],
    [
      "O FinFlow se conecta ao meu banco?",
      "Não. Você cadastra assinaturas, compras e parcelas, e o FinFlow calcula as faturas com as regras de cada cartão. Nada de Open Finance ou leitura de extrato.",
    ],
    [
      "O que acontece se eu passar do limite do plano Free?",
      "Tudo o que você já cadastrou continua visível e funcionando. Para criar mais cartões ou assinaturas, arquive um cartão, cancele uma assinatura, assine o Pro ou hospede o FinFlow você mesmo, sem limites.",
    ],
    [
      "Posso hospedar o FinFlow no meu servidor?",
      "Pode. O código está no GitHub sob a licença AGPL-3.0. Você precisa de Node.js, PostgreSQL e um serviço de e-mail para os lembretes. No self-host não há limite de cartões nem de assinaturas.",
    ],
    [
      "Posso exportar ou apagar meus dados?",
      "Sim, em qualquer plano. Você baixa todos os seus dados quando quiser e pode excluir a conta: tudo é apagado em até 30 dias.",
    ],
  ];
  return (
    <section aria-labelledby="perguntas" className={`${CONTAINER} mt-20 lg:mt-32`}>
      <SectionHeading id="perguntas" title="Perguntas frequentes">
        Se a sua dúvida não estiver aqui, abra uma issue no GitHub.
      </SectionHeading>
      <Reveal className="mt-12 divide-y divide-border rounded-xl bg-surface shadow-hairline">
        {items.map(([q, a]) => (
          <details key={q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-6 py-4 text-heading-sm transition-colors duration-150 hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown
                aria-hidden
                size={20}
                strokeWidth={1.5}
                className="shrink-0 text-fg-muted transition-transform duration-200 ease-out group-open:rotate-180"
              />
            </summary>
            <p className="max-w-[72ch] px-6 pb-5 text-body text-fg-muted">{a}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-final" className={`${CONTAINER} my-20 lg:my-32`}>
      <Reveal className="mx-auto max-w-[720px] text-center">
        <h2 id="cta-final" className="font-display text-display-sm text-balance lg:text-display">
          Comece pelo seu primeiro cartão.
        </h2>
        <p className="mt-4 text-body-lg text-fg-muted">
          Leva menos de um minuto e não pede nenhum dado bancário.
        </p>
        <Link href="/entrar" className={`${button("primary", "lg")} mt-8`}>
          Começar grátis
          <ArrowRight aria-hidden size={20} strokeWidth={1.5} />
        </Link>
      </Reveal>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className={`${CONTAINER} flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between`}>
        <div className="max-w-[460px]">
          <Wordmark />
          <p className="mt-3 text-body-sm text-fg-muted">
            Código aberto sob a licença AGPL-3.0. As marcas exibidas nos cartões pertencem aos seus titulares;
            o FinFlow não é afiliado a nenhuma instituição financeira.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
          <a href={REPO} className="text-fg-muted transition-colors duration-150 hover:text-fg">
            GitHub
          </a>
          <a
            href={`${REPO}/blob/master/LICENSE`}
            className="text-fg-muted transition-colors duration-150 hover:text-fg"
          >
            Licença
          </a>
          <Link href="/entrar" className="text-fg-muted transition-colors duration-150 hover:text-fg">
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
