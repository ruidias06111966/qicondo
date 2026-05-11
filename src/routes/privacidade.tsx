import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de privacidade — WHATSCOND" }, { name: "description", content: "Como o WHATSCOND coleta, usa e protege seus dados." }] }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 md:px-8 py-16">
        <header className="mb-10">
          <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Política de privacidade</h1>
          <p className="mt-3 text-sm text-muted-foreground">Última atualização: 03 de maio de 2026</p>
        </header>

        <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
          <p>O WHATSCOND respeita a sua privacidade e segue rigorosamente a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

          <h2 className="font-display font-extrabold text-2xl text-foreground mt-10">1. Quais dados coletamos</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-foreground">Síndicos:</strong> nome, email, telefone, CPF, dados do condomínio.</li>
            <li><strong className="text-foreground">Moradores:</strong> nome, unidade, telefone (com opt-in para WhatsApp), email opcional.</li>
            <li><strong className="text-foreground">Financeiros:</strong> taxas, pagamentos, despesas, comprovantes.</li>
            <li><strong className="text-foreground">Técnicos:</strong> IP, navegador, logs de acesso.</li>
          </ul>

          <h2 className="font-display font-extrabold text-2xl text-foreground mt-10">2. Como usamos</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Operar a plataforma e enviar comunicações solicitadas.</li>
            <li>Enviar mensagens via WhatsApp apenas para moradores com opt-in registrado.</li>
            <li>Cumprir obrigações legais e fiscais.</li>
            <li>Melhorar o produto (dados sempre agregados e anonimizados).</li>
          </ul>

          <h2 className="font-display font-extrabold text-2xl text-foreground mt-10">3. Com quem compartilhamos</h2>
          <p>Não vendemos dados. Compartilhamos apenas com:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Provedores de infraestrutura (AWS, Supabase) — sob contrato de confidencialidade.</li>
            <li>Gateways de pagamento (Asaas, Iugu) — apenas dados necessários para a transação.</li>
            <li>Meta (WhatsApp Business API) — números de telefone com opt-in registrado.</li>
            <li>Autoridades, quando exigido por lei.</li>
          </ul>

          <h2 className="font-display font-extrabold text-2xl text-foreground mt-10">4. Seus direitos (LGPD)</h2>
          <p>Você pode, a qualquer momento:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Acessar, corrigir ou excluir seus dados.</li>
            <li>Exportar todos os dados do condomínio em formato aberto.</li>
            <li>Revogar consentimento de comunicação por WhatsApp.</li>
            <li>Solicitar relatório de uso dos seus dados.</li>
          </ul>

          <h2 className="font-display font-extrabold text-2xl text-foreground mt-10">5. Segurança</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Criptografia em trânsito (TLS 1.3) e em repouso (AES-256).</li>
            <li>Backups diários automáticos.</li>
            <li>Logs de auditoria de todos os acessos.</li>
            <li>Autenticação em duas etapas opcional.</li>
          </ul>

          <h2 className="font-display font-extrabold text-2xl text-foreground mt-10">6. Retenção</h2>
          <p>Mantemos os dados enquanto a conta estiver ativa. Após o encerramento, os dados são excluídos em até 60 dias, exceto quando obrigados por lei a manter.</p>

          <h2 className="font-display font-extrabold text-2xl text-foreground mt-10">7. Encarregado de dados (DPO)</h2>
          <p>Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com nosso DPO:</p>
          <p><a href="mailto:dpo@whatscond.app" className="text-primary font-semibold">dpo@whatscond.app</a></p>
        </div>
      </article>
    </SiteLayout>
  );
}
