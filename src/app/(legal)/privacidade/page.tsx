import type { Metadata } from "next";

import { LegalPage, Section } from "../legal";

export const metadata: Metadata = { title: "Política de privacidade — FinFlow" };

/** Suboperadores de docs/INTEGRATIONS.md §11 (LGPD art. 33). */
const PROCESSORS = [
  ["Vercel", "Hospedagem e registros de acesso", "Brasil (São Paulo) e rede global"],
  ["Neon", "Banco de dados com todos os dados da conta", "Brasil (São Paulo)"],
  ["Resend", "Envio de e-mails: endereço, nome e conteúdo dos lembretes", "EUA"],
  ["Google", "Login com Google, se você escolher", "Global"],
  ["Discord", "Login com Discord, se você escolher", "EUA"],
  ["Upstash", "Contadores temporários contra abuso (IP em hash)", "Brasil (São Paulo)"],
  ["Sentry", "Registros de erro, sem e-mail nem dados pessoais", "EUA ou UE"],
  ["Cloudflare", "Cópias de segurança cifradas", "Conforme o armazenamento"],
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade">
      <Section title="1. Resumo">
        <p>
          O FinFlow guarda só o necessário para organizar suas assinaturas e faturas.{" "}
          <strong>
            Não pedimos nem guardamos número completo de cartão, CVV, senhas ou acesso a bancos.
          </strong>{" "}
          Não vendemos seus dados e não usamos cookies de publicidade.
        </p>
      </Section>

      <Section title="2. Dados que tratamos">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Conta:</strong> e-mail, nome, foto (quando vem do Google ou do Discord), fuso horário e
            moeda.
          </li>
          <li>
            <strong>O que você cadastra:</strong> cartões (apelido, cor, limite, dias de fechamento e
            vencimento e, se quiser, os 4 últimos dígitos), assinaturas, despesas, parcelas, pagamentos e
            categorias.
          </li>
          <li>
            <strong>Técnicos:</strong> cookies de sessão, o IP transformado em hash (só para limitar
            tentativas de acesso, em contadores temporários) e registros de erro.
          </li>
        </ul>
      </Section>

      <Section title="3. Para que usamos">
        <p>
          Para prestar o serviço (calcular faturas e projeções, enviar lembretes que você ativou e os links de
          acesso), para proteger as contas contra abuso e para corrigir erros. As bases legais são a execução
          do contrato com você e o legítimo interesse em manter o serviço seguro (LGPD, art. 7º, V e IX).
          E-mails que não sejam do serviço só com o seu consentimento.
        </p>
      </Section>

      <Section title="4. Com quem compartilhamos">
        <p>
          Só com os fornecedores que fazem o FinFlow funcionar, cada um limitado à sua parte. Alguns ficam
          fora do Brasil, com as garantias do art. 33 da LGPD.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-body-sm">
            <thead className="text-fg">
              <tr className="border-b border-border-strong">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Fornecedor
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Para quê
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Onde
                </th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map(([name, use, where]) => (
                <tr key={name} className="border-b border-border">
                  <td className="py-2 pr-4 text-fg">{name}</td>
                  <td className="py-2 pr-4">{use}</td>
                  <td className="py-2">{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="5. Por quanto tempo">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Enquanto a conta existir.</li>
          <li>
            Ao excluir a conta, ela fica 30 dias em período de exclusão (pode ser reativada) e depois é
            apagada. Cópias de segurança cifradas expiram em até mais 30 dias.
          </li>
          <li>Notificações são apagadas depois de 180 dias; sessões expiradas, diariamente.</li>
        </ul>
      </Section>

      <Section title="6. Seus direitos">
        <p>
          Pela LGPD (art. 18) você pode confirmar e acessar seus dados, corrigi-los, exportá-los, excluí-los e
          revogar consentimentos. No FinFlow, você corrige dados direto no app, exporta tudo em JSON e exclui
          a conta pelas configurações. Cada e-mail de lembrete tem um link para deixar de recebê-lo.
        </p>
        <p>O canal de contato do encarregado de dados será publicado aqui antes do lançamento.</p>
      </Section>

      <Section title="7. Cookies e segurança">
        <p>
          Usamos só cookies necessários para o login e para manter você conectado (HttpOnly, sem acesso por
          scripts). Nenhum cookie de publicidade ou rastreamento. Toda a comunicação é cifrada (HTTPS), e as
          cópias de segurança são cifradas antes de sair do banco.
        </p>
      </Section>

      <Section title="8. Mudanças nesta política">
        <p>Se esta política mudar, avisaremos quem tem conta antes de a nova versão valer.</p>
      </Section>
    </LegalPage>
  );
}
