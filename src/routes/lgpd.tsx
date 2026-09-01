import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Shield, Lock, Database, FileCheck, UserCheck, Mail } from "lucide-react";

export const Route = createFileRoute("/lgpd")({
  head: () => ({ meta: [{ title: "LGPD — QiCond" }, { name: "description", content: "Compromisso do QiCond com a Lei Geral de Proteção de Dados." }] }),
  component: LgpdPage,
});

function LgpdPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft text-primary px-4 py-1.5 text-xs font-semibold mb-4">
          <Shield size={14} /> Conformidade LGPD
        </div>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">
          Privacidade dos dados <span className="text-gradient-brand">é levada a sério</span>
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          Conformidade total com a Lei 13.709/2018. O síndico continua sendo o controlador
          dos dados do condomínio — nós somos apenas o operador.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 md:px-8 pb-16 grid md:grid-cols-2 gap-5">
        {[
          { icon: Lock, title: "Criptografia ponta a ponta", desc: "TLS 1.3 em trânsito e AES-256 em repouso para todos os dados." },
          { icon: Database, title: "Isolamento por condomínio", desc: "Cada condomínio tem seus dados isolados via Row-Level Security no banco." },
          { icon: FileCheck, title: "Logs de auditoria", desc: "Cada ação registrada com usuário, data, hora e IP. Exportável quando preciso." },
          { icon: UserCheck, title: "Controle de acesso por perfil", desc: "Síndico, morador e contador veem apenas o que devem ver." },
          { icon: Shield, title: "Opt-in WhatsApp registrado", desc: "Consentimento de cada morador armazenado conforme exige a Meta e a LGPD." },
          { icon: Mail, title: "DPO acessível", desc: "Encarregado de dados disponível em qidomino@gmail.com para qualquer solicitação." },
        ].map((b) => (
          <div key={b.title} className="rounded-2xl border border-border bg-surface p-6">
            <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
              <b.icon size={20} />
            </div>
            <h3 className="font-display font-extrabold text-lg mb-2">{b.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 md:px-8 pb-20">
        <div className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="font-display font-extrabold text-2xl mb-4">Direitos garantidos</h2>
          <ul className="space-y-3 text-sm text-foreground">
            <li>✓ <strong>Acesso aos dados:</strong> baixe um relatório com tudo que armazenamos sobre você.</li>
            <li>✓ <strong>Correção:</strong> peça correção de dados incorretos.</li>
            <li>✓ <strong>Exclusão:</strong> solicite a exclusão dos seus dados a qualquer momento.</li>
            <li>✓ <strong>Portabilidade:</strong> receba seus dados em formato aberto (CSV, JSON).</li>
            <li>✓ <strong>Revogação de consentimento:</strong> retire o opt-in do WhatsApp quando quiser.</li>
          </ul>
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">Para exercer qualquer direito, escreva para:</p>
            <a href="mailto:qidomino@gmail.com" className="text-primary font-bold text-lg hover:underline">qidomino@gmail.com</a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
