import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, Section } from "../legal";

export const metadata: Metadata = { title: "Termos de uso — FinFlow" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso">
      <Section title="1. O que é o FinFlow">
        <p>
          O FinFlow organiza assinaturas, despesas e parcelas por cartão e calcula as faturas que você deve
          receber. Ele <strong>não é um banco</strong>, não processa pagamentos e não se conecta à sua conta
          bancária: os cartões são representações que você mesmo cria.
        </p>
        <p>
          Os valores mostrados são estimativas feitas a partir do que você cadastra. Confira sempre a fatura
          oficial do seu banco antes de pagar.
        </p>
      </Section>

      <Section title="2. Sua conta">
        <p>
          Você entra sem senha: por um link enviado ao seu e-mail ou com uma conta Google ou Discord. Quem
          controla esse e-mail ou essas contas controla o acesso ao FinFlow, então mantenha-os protegidos. A
          sessão expira depois de 30 dias sem uso.
        </p>
      </Section>

      <Section title="3. Uso permitido">
        <p>
          Use o FinFlow para organizar as suas próprias finanças. O FinFlow{" "}
          <strong>
            nunca pede o número completo do cartão, o código de segurança (CVV) ou senhas bancárias
          </strong>
          , e você não deve informá-los em nenhum campo. Não use o serviço para atividades ilegais nem tente
          acessar dados de outras pessoas ou prejudicar o funcionamento do sistema.
        </p>
      </Section>

      <Section title="4. Planos">
        <p>
          O plano Free é gratuito, com limites de cartões e assinaturas. Os planos pagos ampliam esses
          limites. Preço e condições de qualquer plano pago aparecem antes de qualquer cobrança.
        </p>
      </Section>

      <Section title="5. Código aberto">
        <p>
          O código do FinFlow é aberto, sob a licença AGPL-3.0. Estes termos valem para o serviço hospedado
          pelo FinFlow; quem roda a própria cópia segue a licença do código.
        </p>
      </Section>

      <Section title="6. Disponibilidade e responsabilidade">
        <p>
          Trabalhamos para manter o serviço disponível e os cálculos corretos, mas não garantimos que as
          projeções coincidam com as faturas reais nem que o serviço funcione sem interrupções. O FinFlow não
          responde por decisões financeiras tomadas só com base nas estimativas.
        </p>
      </Section>

      <Section title="7. Encerramento">
        <p>
          Você pode exportar seus dados e excluir a conta quando quiser. A conta fica 30 dias em período de
          exclusão, quando ainda pode ser reativada, e depois é apagada. Contas usadas em violação destes
          termos podem ser suspensas.
        </p>
      </Section>

      <Section title="8. Mudanças nestes termos">
        <p>
          Se estes termos mudarem, avisaremos com antecedência e pediremos um novo aceite. O tratamento dos
          seus dados está descrito na{" "}
          <Link href="/privacidade" className="font-medium text-primary underline-offset-4 hover:underline">
            Política de privacidade
          </Link>
          . Estes termos seguem a lei brasileira.
        </p>
      </Section>
    </LegalPage>
  );
}
