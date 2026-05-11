import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 md:px-8 py-16">
        <header className="mb-10">
          <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Última atualização: {updated}</p>
        </header>
        <div className="prose prose-sm max-w-none text-foreground space-y-5 [&_h2]:font-display [&_h2]:font-extrabold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-sm [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_li]:text-sm [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          {children}
        </div>
      </article>
    </SiteLayout>
  );
}

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de uso — WHATSCOND" }, { name: "description", content: "Termos e condições de uso do WHATSCOND." }] }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <LegalPage title="Termos de uso" updated="03 de maio de 2026">
      <p>Bem-vindo ao WHATSCOND. Ao usar nossos serviços, você concorda com estes termos. Leia com atenção.</p>

      <h2>1. Aceitação</h2>
      <p>Ao criar uma conta ou utilizar nossos serviços, você concorda integralmente com estes Termos de Uso e com nossa Política de Privacidade.</p>

      <h2>2. Descrição do serviço</h2>
      <p>O WHATSCOND é uma plataforma SaaS de gestão para condomínios residenciais, integrada ao WhatsApp Business API. Oferecemos cobrança, comunicação, reservas, ocorrências e prestação de contas.</p>

      <h2>3. Cadastro e conta</h2>
      <ul>
        <li>Você deve fornecer informações verdadeiras e atualizadas.</li>
        <li>Você é responsável pela segurança da sua senha.</li>
        <li>Apenas síndicos eleitos formalmente podem cadastrar um condomínio.</li>
      </ul>

      <h2>4. Planos e pagamento</h2>
      <p>Os planos vigentes estão descritos na página de Preços. A cobrança é mensal e renovada automaticamente. O cancelamento pode ser feito a qualquer momento, sem multa.</p>

      <h2>5. Uso aceitável</h2>
      <p>É proibido usar a plataforma para:</p>
      <ul>
        <li>Enviar SPAM ou conteúdo não solicitado a terceiros.</li>
        <li>Violar direitos de privacidade de moradores.</li>
        <li>Praticar qualquer atividade ilegal.</li>
      </ul>

      <h2>6. Suspensão e encerramento</h2>
      <p>Reservamos o direito de suspender contas que violem estes termos, com aviso prévio quando possível.</p>

      <h2>7. Limitação de responsabilidade</h2>
      <p>O WHATSCOND é uma ferramenta de apoio à gestão. As decisões e responsabilidades legais permanecem com o síndico e o condomínio.</p>

      <h2>8. Alterações</h2>
      <p>Estes termos podem ser atualizados. Notificaremos por email com pelo menos 30 dias de antecedência sobre mudanças relevantes.</p>

      <h2>9. Foro</h2>
      <p>Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.</p>

      <h2>10. Contato</h2>
      <p>Dúvidas? Escreva para <a href="mailto:juridico@whatscond.app" className="text-primary">juridico@whatscond.app</a>.</p>
    </LegalPage>
  );
}
