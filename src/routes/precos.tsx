import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { CheckCircle2, ChevronDown, X, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "5561982750884";
const waLink = (msg: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Planos — QiCond" },
      { name: "description", content: "Planos sob consulta para empresas de qualquer dimensão. Contrate por empresa, gerencie utilizadores com perfis dedicados, sem fidelidade." },
      { property: "og:title", content: "Planos QiCond — Sob consulta" },
    ],
  }),
  component: PrecosPage,
});

type Plan = {
  name: string;
  desc: string;
  highlight: boolean;
  badge?: string;
  limites: { empresas: string; utilizadores: string };
  features: { has: boolean; label: string }[];
};

const plans: Plan[] = [
  {
    name: "Básico",
    desc: "Para empresas que estão a começar e querem profissionalizar a operação.",
    highlight: false,
    limites: { empresas: "1 empresa", utilizadores: "Utilizadores ilimitados" },
    features: [
      { has: true,  label: "Cobranças e pagamentos" },
      { has: true,  label: "WhatsApp Bot (lembretes e confirmações)" },
      { has: true,  label: "Encomendas e ocorrências" },
      { has: true,  label: "Reserva de áreas comuns" },
      { has: true,  label: "Painel web do administrador" },
      { has: true,  label: "Perfis: Administrador, Financeiro, Consulta" },
      { has: false, label: "Painel do contador" },
      { has: false, label: "Suporte prioritário" },
    ],
  },
  {
    name: "Profissional",
    desc: "Recomendado para a maioria das empresas. Tudo desbloqueado + suporte prioritário.",
    highlight: true,
    badge: "Mais escolhido",
    limites: { empresas: "1 empresa", utilizadores: "Utilizadores ilimitados" },
    features: [
      { has: true, label: "Tudo do plano Básico" },
      { has: true, label: "Todos os 7 perfis com permissões dedicadas" },
      { has: true, label: "Painel do contador e exportação CNAB / OFX / PDF / CSV" },
      { has: true, label: "Assembleias virtuais com ata digital" },
      { has: true, label: "Visitantes com QR Code" },
      { has: true, label: "Documentos com aprovação e versionamento" },
      { has: true, label: "Número WhatsApp dedicado" },
      { has: true, label: "Suporte prioritário" },
    ],
  },
  {
    name: "Enterprise",
    desc: "Para empresas grandes ou administradoras com múltiplas operações.",
    highlight: false,
    limites: { empresas: "Multi-empresa", utilizadores: "Utilizadores ilimitados" },
    features: [
      { has: true, label: "Tudo do plano Profissional" },
      { has: true, label: "Utilizadores ilimitados" },
      { has: true, label: "Múltiplas empresas geridas centralmente" },
      { has: true, label: "API para integrações" },
      { has: true, label: "Onboarding assistido e formação da equipa" },
      { has: true, label: "SLA dedicado e gestor de conta" },
      { has: true, label: "Contrato e faturação personalizados" },
    ],
  },
];

const faqs = [
  { q: "Quanto custa?", a: "Os planos são sob consulta. Os valores variam conforme o número de utilizadores e os módulos contratados. Fale connosco e enviamos uma proposta no mesmo dia." },
  { q: "Como funciona a contratação?", a: "O contrato é com a empresa, não com cada utilizador. Você contrata um plano, define o administrador, e ele convida a equipa (Financeiro, Gestor, Vendedor, Comercial, Contador, Consulta)." },
  { q: "Tem período de avaliação?", a: "Sim. Damos 30 dias para experimentar o sistema com a sua equipa, sem cartão. No fim escolhe o plano que faz mais sentido." },
  { q: "Os dados de uma empresa misturam-se com os de outra?", a: "Nunca. Cada empresa é um tenant isolado. Um utilizador da Empresa A nunca consegue ver dados da Empresa B, mesmo que use o mesmo e-mail noutra empresa." },
  { q: "Quem emite os boletos? E o PIX?", a: "Cada empresa recebe boletos e PIX direto na própria conta bancária. O QiCond gera o instrutivo e envia ao destinatário pelo WhatsApp; não somos intermediários financeiros — o dinheiro nunca passa pela plataforma." },
  { q: "Como faço a migração de outro sistema?", a: "Fornecemos planilha modelo e a nossa equipa ajuda com a importação de utilizadores, unidades e histórico. Sem custo adicional em qualquer plano." },
  { q: "É compatível com a LGPD?", a: "Sim. Política de privacidade clara, consentimento registado, controlo de acesso por perfil, logs de auditoria e exportação dos dados a qualquer momento." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade, sem multa de saída. Cancela direto pelo painel ou falando connosco." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl bg-surface overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <ChevronDown size={18} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</div>}
    </div>
  );
}

function PrecosPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Planos</div>
        <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight">
          Planos <span className="text-gradient-brand">sob consulta</span>
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          Contratação por empresa, com utilizadores ilimitados nos planos superiores. Sem fidelidade, sem taxa de setup, 30 dias para experimentar.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-16 grid md:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl p-7 flex flex-col ${
              p.highlight
                ? "bg-gradient-brand text-white shadow-[var(--shadow-glow)] md:scale-[1.03] border border-primary"
                : "bg-surface border border-border"
            }`}
          >
            {p.badge && (
              <div className="inline-block self-start text-[10px] font-bold uppercase tracking-wider bg-warning text-[var(--color-warning-foreground)] px-2 py-0.5 rounded-full mb-3">
                {p.badge}
              </div>
            )}
            <div className={`text-sm font-semibold mb-2 ${p.highlight ? "text-white/80" : "text-muted-foreground"}`}>{p.name}</div>

            <div className="mb-1">
              <span className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">Sob consulta</span>
            </div>
            <div className={`text-xs mb-5 ${p.highlight ? "text-white/75" : "text-muted-foreground"}`}>
              Faturação por empresa
            </div>

            <p className={`text-sm mb-5 ${p.highlight ? "text-white/85" : "text-foreground"}`}>{p.desc}</p>

            <div className={`rounded-lg px-3 py-2.5 mb-5 text-xs font-medium ${p.highlight ? "bg-white/10 text-white" : "bg-muted/60 text-foreground"}`}>
              <div>{p.limites.empresas}</div>
              <div className={p.highlight ? "text-white/80" : "text-muted-foreground"}>{p.limites.utilizadores}</div>
            </div>

            <ul className="space-y-2.5 mb-7 flex-1">
              {p.features.map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-sm">
                  {f.has
                    ? <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${p.highlight ? "text-white" : "text-success"}`} />
                    : <X size={16} className={`shrink-0 mt-0.5 ${p.highlight ? "text-white/50" : "text-muted-foreground/40"}`} />}
                  <span className={f.has ? "" : (p.highlight ? "text-white/55 line-through" : "text-muted-foreground/70 line-through")}>
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>

            <a
              href={waLink(`Olá! Tenho interesse no plano ${p.name} do QiCond. Pode enviar uma proposta?`)}
              target="_blank"
              rel="noopener noreferrer"
              className={`block text-center rounded-lg py-3 text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${
                p.highlight
                  ? "bg-white text-primary hover:scale-[1.02]"
                  : "bg-primary text-primary-foreground hover:bg-[var(--color-primary-deep)]"
              }`}
            >
              <MessageCircle size={14} /> Falar no WhatsApp
            </a>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 md:px-8 pb-20">
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-center mb-10">Perguntas frequentes</h2>
        <div className="space-y-3">
          {faqs.map((f) => <FaqItem key={f.q} {...f} />)}
        </div>
        <div className="mt-10 text-center text-sm text-muted-foreground">
          Ainda com dúvidas? <Link to="/contato" className="text-primary font-semibold hover:underline">Fale connosco</Link>.
        </div>
      </section>
    </SiteLayout>
  );
}
