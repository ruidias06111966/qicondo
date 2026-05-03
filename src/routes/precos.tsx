import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { CheckCircle2, ChevronDown, X } from "lucide-react";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — CONDOZAP" },
      { name: "description", content: "Planos a partir de R$ 29/mês para condomínios de até 30 unidades. Sem taxa de setup, sem contrato, primeiro mês grátis." },
      { property: "og:title", content: "Preços do CONDOZAP" },
    ],
  }),
  component: PrecosPage,
});

const plans = [
  {
    name: "Básico", price: "29", desc: "Ideal para condomínios pequenos com até 30 unidades.",
    cta: "Começar grátis", highlight: false,
    features: [
      { has: true,  label: "Cobrança automática via WhatsApp" },
      { has: true,  label: "Confirmação de pagamentos" },
      { has: true,  label: "Prestação de contas mensal" },
      { has: true,  label: "Painel web do síndico" },
      { has: true,  label: "Reserva de áreas comuns (1 área)" },
      { has: true,  label: "Encomendas" },
      { has: true,  label: "Até 30 unidades" },
      { has: false, label: "Assembleias virtuais" },
      { has: false, label: "Visitantes com QR Code" },
      { has: false, label: "Número WhatsApp dedicado" },
      { has: false, label: "Suporte prioritário" },
    ],
  },
  {
    name: "Profissional", price: "59", desc: "Tudo do Básico + módulos avançados e suporte prioritário.",
    cta: "Começar grátis", highlight: true,
    features: [
      { has: true, label: "Tudo do plano Básico" },
      { has: true, label: "Assembleias virtuais com ata digital" },
      { has: true, label: "Reserva de áreas comuns (ilimitado)" },
      { has: true, label: "Visitantes com QR Code" },
      { has: true, label: "Ocorrências e chamados" },
      { has: true, label: "Painel do contador" },
      { has: true, label: "Exportação PDF / CSV / OFX" },
      { has: true, label: "Número WhatsApp dedicado" },
      { has: true, label: "Suporte prioritário" },
      { has: true, label: "Até 80 unidades" },
    ],
  },
  {
    name: "Administradora", price: "Sob consulta", desc: "Para gestoras de múltiplos condomínios.",
    cta: "Falar com vendas", highlight: false,
    features: [
      { has: true, label: "Tudo do Profissional" },
      { has: true, label: "Múltiplos condomínios" },
      { has: true, label: "Faturamento centralizado" },
      { has: true, label: "API para integrações" },
      { has: true, label: "Onboarding assistido" },
      { has: true, label: "SLA dedicado" },
    ],
  },
];

const faqs = [
  { q: "Tem fidelidade ou multa por cancelamento?", a: "Não. Você pode cancelar a qualquer momento direto pelo painel. Não cobramos multa nem taxa de saída." },
  { q: "Como funciona o teste grátis?", a: "Você usa o plano completo por 30 dias sem informar cartão. Depois desse período, escolhe o plano que faz mais sentido." },
  { q: "Os moradores precisam instalar algum app?", a: "Não. Toda a comunicação acontece no WhatsApp que eles já usam. Apenas o síndico acessa o painel web." },
  { q: "Quem emite os boletos? E o PIX?", a: "Geramos PIX direto integrado ao banco do condomínio. Boleto registrado está disponível no plano Profissional via gateway parceiro (Asaas/Iugu/Cora)." },
  { q: "Como faço a migração de outro sistema?", a: "Fornecemos planilha modelo e nossa equipe ajuda com a importação de moradores, unidades e histórico. Sem custo adicional." },
  { q: "É compatível com a LGPD?", a: "Sim. Temos política de privacidade clara, opt-in de moradores registrado, controle de acesso por perfil, logs de auditoria e exportação dos dados a qualquer momento." },
  { q: "Posso usar no celular?", a: "Sim. O painel é totalmente responsivo. E como toda a comunicação é via WhatsApp, na prática o síndico resolve tudo do celular." },
  { q: "Vocês emitem nota fiscal da mensalidade?", a: "Sim, NF-e de serviço emitida automaticamente todo mês." },
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
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Preços</div>
        <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight">
          Simples e <span className="text-gradient-brand">transparente</span>
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          Primeiro mês grátis. Sem taxa de setup. Cancele quando quiser.
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
            {p.highlight && (
              <div className="inline-block self-start text-[10px] font-bold uppercase tracking-wider bg-warning text-[var(--color-warning-foreground)] px-2 py-0.5 rounded-full mb-3">
                Mais popular
              </div>
            )}
            <div className={`text-sm font-semibold mb-2 ${p.highlight ? "text-white/80" : "text-muted-foreground"}`}>{p.name}</div>
            <div className="flex items-baseline gap-1 mb-1">
              {p.price !== "Sob consulta" && <span className={`text-sm ${p.highlight ? "text-white/80" : "text-muted-foreground"}`}>R$</span>}
              <span className="font-display font-extrabold text-5xl">{p.price}</span>
            </div>
            <div className={`text-xs mb-5 ${p.highlight ? "text-white/75" : "text-muted-foreground"}`}>
              {p.price !== "Sob consulta" ? "/mês por condomínio" : "Plano personalizado"}
            </div>
            <p className={`text-sm mb-5 ${p.highlight ? "text-white/85" : "text-foreground"}`}>{p.desc}</p>
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
            <Link
              to="/contato"
              className={`block text-center rounded-lg py-3 text-sm font-bold transition-all ${
                p.highlight
                  ? "bg-white text-primary hover:scale-[1.02]"
                  : "bg-primary text-primary-foreground hover:bg-[var(--color-primary-deep)]"
              }`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 md:px-8 pb-20">
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-center mb-10">Perguntas frequentes</h2>
        <div className="space-y-3">
          {faqs.map((f) => <FaqItem key={f.q} {...f} />)}
        </div>
        <div className="mt-10 text-center text-sm text-muted-foreground">
          Ainda com dúvidas? <Link to="/contato" className="text-primary font-semibold hover:underline">Fale com a gente</Link>.
        </div>
      </section>
    </SiteLayout>
  );
}
