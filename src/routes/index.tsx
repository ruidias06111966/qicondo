import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/track";
import { toast } from "sonner";
import {
  MessageCircle,
  PieChart,
  CheckCircle2,
  LayoutDashboard,
  ShieldCheck,
  Calendar,
  Package,
  Wrench,
  ArrowRight,
  Star,
  Smartphone,
  Zap,
  Lock,
  Send,
  Bot,
  Receipt,
  Users,
  Clock,
  TrendingDown,
  Building2,
  HeartHandshake,
  FileText,
  X,
  Sparkles,
  PartyPopper,
  CalendarClock,
  Loader2,
} from "lucide-react";

const SITE_URL = "https://qicond.lovable.app";
// Número oficial do QiCond para o botão flutuante e captura de leads.
// (Trocar para o número real assim que disponível.)
const WHATSAPP_NUMBER = "5511999999999";
const WHATSAPP_DEFAULT_MSG =
  "Olá! Vim pelo site do QiCond e quero saber mais sobre a gestão de condomínio pelo WhatsApp.";

// Monta uma mensagem personalizada quando temos dados do visitante.
function buildPersonalMsg(lead: { nome?: string; condominio?: string } | null, base: string) {
  if (!lead?.nome) return base;
  const cond = lead.condominio ? ` (condomínio ${lead.condominio})` : "";
  return `Olá! Aqui é ${lead.nome}${cond}. ${base}`;
}

function waLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Lê o último lead salvo em localStorage (preenche WA personalizado).
function readSavedLead(): { nome?: string; condominio?: string; telefone?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("qd_last_lead");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QiCond — Gestão de condomínio pelo WhatsApp" },
      {
        name: "description",
        content:
          "Cobranças, reservas, encomendas, ocorrências e prestação de contas — tudo pelo WhatsApp que seus moradores já usam. Planos sob consulta.",
      },
      { property: "og:title", content: "QiCond — Gestão de condomínio pelo WhatsApp" },
      {
        property: "og:description",
        content:
          "O sistema de gestão pensado para pequenos condomínios. Sem app para instalar: tudo acontece no WhatsApp.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "QiCond",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description:
            "Sistema de gestão de condomínios via WhatsApp: cobranças, reservas, encomendas, ocorrências e prestação de contas.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL", description: "Sob consulta" },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            reviewCount: "200",
          },
        }),
      },
    ],
  }),
  component: HomePage,
});

const features = [
  { icon: Receipt, title: "Cobrança automática via WhatsApp", desc: "Lembretes antes do vencimento, cobranças no atraso e cálculo automático de multa e juros. PIX e boleto direto na conversa." },
  { icon: PieChart, title: "Prestação de contas mensal", desc: "Relatório de receitas, despesas e inadimplência enviado todo dia 5 para todos os moradores. Transparência sem esforço." },
  { icon: CheckCircle2, title: "Confirmação de pagamentos", desc: "O morador envia o comprovante pelo WhatsApp e o síndico aprova com um clique. Conciliação automática por PIX." },
  { icon: Calendar, title: "Reserva de áreas comuns", desc: "Salão, churrasqueira e quadra com calendário, regras e taxas. Reserva e confirmação no próprio WhatsApp." },
  { icon: Package, title: "Encomendas e visitantes", desc: "Portaria registra, morador recebe foto na hora e libera visitas com QR Code temporário." },
  { icon: Wrench, title: "Ocorrências e chamados", desc: "Manutenção, barulho ou reclamações com foto, status e atribuição. O síndico nunca mais perde um pedido." },
  { icon: LayoutDashboard, title: "Painel web completo", desc: "Dashboard com inadimplência, fluxo de caixa, documentos e configurações. Funciona no celular e no computador." },
  { icon: ShieldCheck, title: "Conforme com a LGPD", desc: "Backup diário, logs de auditoria, controle por perfil e exportação a qualquer momento." },
  { icon: FileText, title: "Documentos do condomínio", desc: "Atas, convenção, regimento e atas de assembleia em um só lugar, acessíveis ao morador via WhatsApp." },
];

const audiences = [
  { icon: Building2, title: "Síndicos moradores", desc: "Você não é gestor profissional, mas precisa cobrar, prestar contas e organizar o condomínio sem virar refém de planilhas." },
  { icon: Users, title: "Pequenos condomínios", desc: "De 6 a 50 unidades, em autogestão. O QiCond foi desenhado para essa realidade — não é um sistema corporativo caro e complicado." },
  { icon: HeartHandshake, title: "Administradoras enxutas", desc: "Quer atender mais condomínios sem aumentar a equipe? Centralize a comunicação e automatize o financeiro de cada cliente." },
];

const benefits = [
  { icon: TrendingDown, value: "−70%", label: "de inadimplência média no 3º mês" },
  { icon: Clock, value: "6h", label: "economizadas por mês na prestação de contas" },
  { icon: Smartphone, value: "0", label: "apps que o morador precisa instalar" },
  { icon: MessageCircle, value: "100%", label: "da comunicação no WhatsApp oficial" },
];

// Fluxo WhatsApp em 4 etapas (visual)
const whatsappFlow = [
  {
    icon: Send,
    badge: "Etapa 1",
    title: "Mensagem enviada",
    desc: "O QiCond dispara automaticamente o boleto, lembrete ou aviso no WhatsApp do morador — sempre pelo número oficial verificado.",
    example: "Olá, Maria! Sua taxa de maio (R$ 280) vence em 3 dias. Pague pelo PIX qicond@cond.com",
    side: "left" as const,
  },
  {
    icon: Bot,
    badge: "Etapa 2",
    title: "Resposta por palavra-chave",
    desc: "O morador responde com palavras simples — PAGUEI, BOLETO, RESERVAR, PROBLEMA, AJUDA — e o bot entende imediatamente.",
    example: "PAGUEI [comprovante.jpg]",
    side: "right" as const,
  },
  {
    icon: LayoutDashboard,
    badge: "Etapa 3",
    title: "Registro no painel",
    desc: "Cada interação vira automaticamente um registro no painel do síndico: cobrança, reserva, encomenda ou ocorrência.",
    example: "Painel · Cobrança #128 → Comprovante recebido · aguardando aprovação",
    side: "left" as const,
  },
  {
    icon: CheckCircle2,
    badge: "Etapa 4",
    title: "Confirmação automática",
    desc: "O sistema responde o morador com recibo, status atualizado ou próximos passos. Tudo dentro da mesma conversa.",
    example: "Recebemos seu pagamento ✅ Recibo #128 anexado.",
    side: "right" as const,
  },
];

// Planos — Starter e Profissional + comparação
const plans = [
  {
    name: "Starter",
    price: "29",
    tagline: "Para condomínios de até 30 unidades em autogestão.",
    highlight: false,
    cta: "Começar grátis",
    features: [
      "Até 30 unidades",
      "Cobranças automáticas via WhatsApp",
      "Confirmação de pagamentos PIX",
      "Prestação de contas mensal",
      "Reserva de 1 área comum",
      "Encomendas e ocorrências",
      "Painel web do síndico",
      "Suporte por e-mail",
    ],
  },
  {
    name: "Profissional",
    price: "59",
    tagline: "Para condomínios maiores e administradoras enxutas.",
    highlight: true,
    cta: "Quero o Profissional",
    features: [
      "Até 80 unidades",
      "Tudo do Starter, mais:",
      "Assembleias virtuais com ata digital",
      "Reserva ilimitada de áreas comuns",
      "Visitantes com QR Code",
      "Boleto registrado + PIX",
      "Painel do contador (export OFX/CSV)",
      "Número WhatsApp dedicado",
      "Suporte prioritário em até 4h",
    ],
  },
];

const compareRows = [
  { label: "Unidades incluídas", starter: "até 30", pro: "até 80" },
  { label: "Cobrança via WhatsApp", starter: true, pro: true },
  { label: "Prestação de contas mensal", starter: true, pro: true },
  { label: "Reserva de áreas comuns", starter: "1 área", pro: "ilimitado" },
  { label: "Visitantes com QR Code", starter: false, pro: true },
  { label: "Boleto registrado", starter: false, pro: true },
  { label: "Assembleias virtuais", starter: false, pro: true },
  { label: "Painel do contador", starter: false, pro: true },
  { label: "Número WhatsApp dedicado", starter: false, pro: true },
  { label: "Suporte prioritário", starter: false, pro: true },
];

// FAQ direcionado por plano
const faqsByPlan: Record<"Starter" | "Profissional", { q: string; a: string }[]> = {
  Starter: [
    { q: "O Starter cobre todas as cobranças automáticas?", a: "Sim. Lembretes, cobranças e confirmação de pagamento por PIX já vêm inclusos — sem limite de mensagens." },
    { q: "Posso usar com mais de 30 unidades?", a: "Tecnicamente sim, mas o plano é dimensionado para até 30. Acima disso recomendamos o Profissional, que tem melhor performance e mais recursos." },
    { q: "Preciso ter número WhatsApp próprio?", a: "Não. No Starter, seu condomínio compartilha o número oficial do QiCond com identidade personalizada nas mensagens." },
  ],
  Profissional: [
    { q: "Como funciona o número dedicado?", a: "Você recebe um número WhatsApp Business API exclusivo do condomínio, com nome verificado pela Meta. Ideal para administradoras." },
    { q: "O que entra no painel do contador?", a: "Acesso somente-leitura para o contador, exportações em CSV/OFX, conciliação bancária e relatórios fiscais prontos." },
    { q: "Quanto tempo leva o suporte prioritário?", a: "Resposta em até 4h úteis, com canal direto via WhatsApp e e-mail. Para administradoras incluímos onboarding assistido." },
  ],
};

// Depoimentos com números concretos
const testimonials = [
  { name: "Carlos M.", role: "Síndico · Ed. Recanto Verde", units: "18 unidades", text: "Reduzi a inadimplência de 27% para 8% em 3 meses só pela facilidade do WhatsApp.", metric: "−70% inadimplência", avatar: "CM" },
  { name: "Patricia R.", role: "Síndica · Cond. Vila Nova", units: "24 unidades", text: "Antes eu gastava 6h por mês fazendo prestação de contas. Agora é automático e ninguém mais reclama de transparência.", metric: "6h economizadas/mês", avatar: "PR" },
  { name: "Roberto L.", role: "Síndico · Ed. Aurora", units: "12 unidades", text: "Os moradores adoraram. Tudo no WhatsApp, sem instalar app. Até quem tem 70 anos consegue usar.", metric: "100% adesão", avatar: "RL" },
  { name: "Fernanda S.", role: "Síndica · Res. Bosque", units: "36 unidades", text: "A primeira assembleia virtual teve 89% de presença. Antes a gente não passava de 40%.", metric: "+49 p.p. presença", avatar: "FS" },
  { name: "Marcos T.", role: "Administradora Conviva", units: "9 condomínios", text: "Conseguimos absorver 3 novos condomínios sem contratar ninguém. O WhatsApp resolveu 80% do atendimento.", metric: "+33% portfólio", avatar: "MT" },
  { name: "Beatriz A.", role: "Síndica · Cond. Mirante", units: "22 unidades", text: "Acabou aquela história de 'não recebi o boleto'. Cai no WhatsApp, é entregue, é lido. Fim.", metric: "0 boletos perdidos", avatar: "BA" },
];

function HomePage() {
  const [savedLead, setSavedLead] = useState<{ nome?: string; condominio?: string; telefone?: string } | null>(null);

  useEffect(() => {
    setSavedLead(readSavedLead());
    function onLeadSaved() {
      setSavedLead(readSavedLead());
    }
    window.addEventListener("qd:lead-saved", onLeadSaved);
    return () => window.removeEventListener("qd:lead-saved", onLeadSaved);
  }, []);

  const heroWaMsg = useMemo(
    () => buildPersonalMsg(savedLead, WHATSAPP_DEFAULT_MSG),
    [savedLead],
  );

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-soft opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-8 pt-16 md:pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-soft)]">
            <Smartphone size={14} className="text-primary" />
            Sem app. Sem treino. No WhatsApp que seus moradores já usam.
          </div>

          <h1 className="mt-6 font-display text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto">
            Gestão completa do seu condomínio,{" "}
            <span className="text-gradient-brand">pelo WhatsApp</span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            QiCond cuida das cobranças, reservas, encomendas, ocorrências e
            prestação de contas. Você acompanha tudo num painel simples — e o
            morador resolve o dia a dia direto na conversa. Planos{" "}
            <strong className="text-foreground">sob consulta</strong>.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-md sm:max-w-none mx-auto">
            <Link
              to="/auth/cadastro"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-[var(--color-primary-deep)] transition-all hover:scale-[1.02] w-full sm:w-auto"
              onClick={() => track("plan_cta_click", { location: "hero" })}
            >
              Começar grátis por 30 dias
              <ArrowRight size={16} />
            </Link>
            <a
              href={waLink(heroWaMsg)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("wa_click_hero", { personalized: !!savedLead?.nome })}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground hover:border-success hover:text-success transition-colors w-full sm:w-auto"
            >
              <MessageCircle size={16} /> Falar no WhatsApp
              {savedLead?.nome && <span className="hidden sm:inline text-[10px] text-muted-foreground">· como {savedLead.nome.split(" ")[0]}</span>}
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> Cancele quando quiser</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> WhatsApp Business oficial</span>
          </div>
        </div>
      </section>

      {/* BENEFITS STRIP */}
      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {benefits.map((b) => (
            <div key={b.label} className="flex flex-col items-center">
              <b.icon size={20} className="text-primary mb-2" />
              <div className="font-display font-extrabold text-2xl md:text-3xl text-foreground">{b.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{b.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW WHATSAPP WORKS — Visual flow */}
      <section className="mx-auto max-w-6xl px-4 md:px-8 py-20">
        <div className="text-center mb-14">
          <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Como funciona o WhatsApp</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl">A conversa vira gestão em 4 passos</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Exemplos reais do QiCond — sem app, sem treino, dentro do WhatsApp Business API oficial da Meta.
          </p>
        </div>

        <ol className="relative space-y-6 md:space-y-10 before:hidden md:before:block before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-px before:bg-border">
          {whatsappFlow.map((s) => (
            <li
              key={s.title}
              className={`relative md:grid md:grid-cols-2 md:gap-10 items-center ${s.side === "right" ? "md:[&>div:first-child]:order-2" : ""}`}
            >
              {/* Card de descrição */}
              <div className={`rounded-2xl border border-border bg-surface p-6 ${s.side === "left" ? "md:text-right md:pr-10" : "md:pl-10"}`}>
                <div className={`flex items-center gap-2 mb-2 ${s.side === "left" ? "md:justify-end" : ""}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-soft px-2 py-0.5 rounded-full">{s.badge}</span>
                </div>
                <h3 className="font-display font-extrabold text-xl mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>

              {/* Bolinha central (desktop) */}
              <span className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-primary text-primary-foreground items-center justify-center shadow-[var(--shadow-glow)] ring-4 ring-background z-10">
                <s.icon size={18} />
              </span>

              {/* Mock exemplo */}
              <div className={`mt-4 md:mt-0 ${s.side === "left" ? "md:pl-10" : "md:pr-10"}`}>
                {s.badge === "Etapa 3" ? (
                  <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
                    <div className="h-8 border-b border-border bg-surface-2 flex items-center gap-1.5 px-3">
                      <span className="h-2 w-2 rounded-full bg-destructive/70" />
                      <span className="h-2 w-2 rounded-full bg-warning/70" />
                      <span className="h-2 w-2 rounded-full bg-success/70" />
                      <span className="ml-2 text-[10px] text-muted-foreground">Painel do síndico</span>
                    </div>
                    <div className="p-4 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Cobrança #128 · Unid. 102</span>
                        <span className="px-2 py-0.5 rounded-full bg-warning/20 text-[var(--color-warning-foreground)] text-[10px] font-semibold">aguardando</span>
                      </div>
                      <div className="text-muted-foreground mb-1">Maria Costa · R$ 280,00</div>
                      <div className="text-muted-foreground">Comprovante recebido às 14:32 · PIX</div>
                      <button className="mt-3 w-full rounded-md bg-primary text-primary-foreground py-1.5 text-[11px] font-semibold">Aprovar pagamento</button>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-2xl border border-border bg-[#075E54] p-2 shadow-[var(--shadow-card)] w-full max-w-full sm:max-w-sm ${s.side === "left" ? "md:ml-0" : "md:ml-auto"}`}>
                    <div className="rounded-xl bg-[#ECE5DD] p-3 text-[12px] flex">
                      {s.badge === "Etapa 2" ? (
                        <div className="self-end ml-auto max-w-[90%] rounded-lg bg-[#DCF8C6] px-3 py-2 shadow-sm">
                          {s.example}
                        </div>
                      ) : (
                        <div className="max-w-[90%] rounded-lg bg-white px-3 py-2 shadow-sm">
                          <div className="text-[10px] font-bold text-primary mb-0.5">QiCond</div>
                          {s.example}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* AUDIENCES */}
      <section className="bg-surface-2 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-20">
          <div className="text-center mb-12">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Para quem é</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl">Feito para quem cuida do prédio no dia a dia</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {audiences.map((a) => (
              <div key={a.title} className="rounded-2xl border border-border bg-surface p-6">
                <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                  <a.icon size={20} />
                </div>
                <h3 className="font-display font-extrabold text-lg mb-2">{a.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-20">
        <div className="text-center mb-12">
          <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Recursos</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl">Tudo que o síndico precisa</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Um sistema completo onde o WhatsApp é a porta de entrada — e o painel é o controle.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-surface p-6 hover:border-primary hover:shadow-[var(--shadow-card)] transition-all">
              <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <f.icon size={20} />
              </div>
              <h3 className="font-display font-extrabold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <PricingSection />

      {/* TESTIMONIALS */}
      <section className="bg-surface-2 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-20">
          <div className="text-center mb-12">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Casos reais</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl">Síndicos que dormem melhor</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Mais de 200 condomínios brasileiros — números reais de quem usa o QiCond no dia a dia.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-surface p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-0.5 text-warning">
                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill="currentColor" />)}
                  </div>
                  <span className="text-[11px] font-bold text-success bg-success/10 px-2 py-1 rounded-full">{t.metric}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-5 flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <div className="h-10 w-10 rounded-full bg-primary-soft text-primary font-display font-extrabold flex items-center justify-center text-sm">{t.avatar}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.role} · {t.units}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEAD FORM + CTA */}
      <LeadFormSection />

      {/* Espaço extra no fim para o botão flutuante não cobrir conteúdo no mobile */}
      <div aria-hidden className="h-20 md:h-0" />

      {/* Floating WhatsApp button */}
      <FloatingWhatsApp />
    </SiteLayout>
  );
}

/* -------------------- PRICING SECTION -------------------- */
function PricingSection() {
  const [activePlan, setActivePlan] = useState<"Starter" | "Profissional">("Profissional");
  const planFaqs = faqsByPlan[activePlan];
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref.current || typeof window === "undefined") return;
    if (sessionStorage.getItem("qd_pricing_viewed")) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            track("pricing_view");
            sessionStorage.setItem("qd_pricing_viewed", "1");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="precos" ref={ref} className="mx-auto max-w-7xl px-4 md:px-8 py-20">
      <div className="text-center mb-12">
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Preços</div>
        <h2 className="font-display font-extrabold text-3xl md:text-4xl">Planos simples e transparentes</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Primeiro mês grátis. Sem taxa de setup, sem contrato, sem fidelidade.
        </p>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
        {plans.map((p) => {
          const isPro = p.highlight;
          return (
            <div
              key={p.name}
              className={`rounded-2xl p-7 flex flex-col ${
                isPro
                  ? "bg-gradient-brand text-white shadow-[var(--shadow-glow)] md:scale-[1.02] border border-primary"
                  : "bg-surface border border-border"
              }`}
            >
              {isPro && (
                <div className="inline-block self-start text-[10px] font-bold uppercase tracking-wider bg-warning text-[var(--color-warning-foreground)] px-2 py-0.5 rounded-full mb-3">
                  Mais popular
                </div>
              )}
              <div className={`text-sm font-semibold mb-2 ${isPro ? "text-white/80" : "text-muted-foreground"}`}>{p.name}</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className={`text-sm ${isPro ? "text-white/80" : "text-muted-foreground"}`}>R$</span>
                <span className="font-display font-extrabold text-5xl">{p.price}</span>
                <span className={`text-sm ${isPro ? "text-white/80" : "text-muted-foreground"}`}>/mês</span>
              </div>
              <p className={`text-sm mb-5 ${isPro ? "text-white/85" : "text-foreground"}`}>{p.tagline}</p>

              <ul className="space-y-2.5 mb-7 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${isPro ? "text-white" : "text-success"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/auth/cadastro"
                onClick={() => track("plan_cta_click", { plan: p.name })}
                className={`block text-center rounded-lg py-3 text-sm font-bold transition-all ${
                  isPro
                    ? "bg-white text-primary hover:scale-[1.02]"
                    : "bg-primary text-primary-foreground hover:bg-[var(--color-primary-deep)]"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="mt-14 max-w-4xl mx-auto">
        <h3 className="text-center font-display font-extrabold text-2xl mb-6">Compare recurso a recurso</h3>
        <div className="rounded-2xl border border-border overflow-x-auto bg-surface">
          <div className="min-w-[480px]">
            <div className="grid grid-cols-3 bg-surface-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <div className="px-3 sm:px-4 py-3">Recurso</div>
              <div className="px-3 sm:px-4 py-3 text-center">Starter</div>
              <div className="px-3 sm:px-4 py-3 text-center text-primary">Profissional</div>
            </div>
            {compareRows.map((r, i) => (
              <div key={r.label} className={`grid grid-cols-3 text-xs sm:text-sm items-center ${i % 2 === 1 ? "bg-surface-2/40" : ""}`}>
                <div className="px-3 sm:px-4 py-3 text-foreground">{r.label}</div>
                <div className="px-3 sm:px-4 py-3 text-center text-muted-foreground">
                  {typeof r.starter === "boolean"
                    ? r.starter ? <CheckCircle2 size={16} className="inline text-success" /> : <X size={16} className="inline text-muted-foreground/40" />
                    : r.starter}
                </div>
                <div className="px-3 sm:px-4 py-3 text-center font-semibold text-foreground">
                  {typeof r.pro === "boolean"
                    ? r.pro ? <CheckCircle2 size={16} className="inline text-success" /> : <X size={16} className="inline text-muted-foreground/40" />
                    : r.pro}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-plan FAQ */}
      <div className="mt-14 max-w-3xl mx-auto">
        <h3 className="text-center font-display font-extrabold text-2xl mb-6">Dúvidas sobre cada plano</h3>
        <div className="flex justify-center gap-2 mb-6">
          {(["Starter", "Profissional"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setActivePlan(p)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activePlan === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface border border-border text-foreground hover:border-primary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {planFaqs.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-surface p-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-foreground">
                {f.q}
                <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- LEAD FORM + FINAL CTA -------------------- */
function LeadFormSection() {
  const [nome, setNome] = useState("");
  const [condominio, setCondominio] = useState("");
  const [telefone, setTelefone] = useState("");
  const [consent, setConsent] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [querDemo, setQuerDemo] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  const waLeadLink = useMemo(() => {
    const msg = `Olá! Sou ${nome || "[seu nome]"}, do condomínio ${condominio || "[nome do condomínio]"}. Meu WhatsApp: ${telefone || "[seu telefone]"}. Quero conhecer o QiCond.`;
    return waLink(msg);
  }, [nome, condominio, telefone]);

  const waDemoLink = useMemo(() => {
    const msg = `Olá! Sou ${nome}, do condomínio ${condominio}. Gostaria de agendar uma demonstração de 15 minutos do QiCond. Meu WhatsApp: ${telefone}.`;
    return waLink(msg);
  }, [nome, condominio, telefone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !condominio.trim() || !telefone.trim()) return;
    if (!consent) {
      toast.error("Você precisa aceitar os termos da LGPD para continuar.");
      return;
    }
    setSalvando(true);
    track("lead_form_submit", { quer_demo: querDemo });

    // Persiste no Lovable Cloud (RLS permite INSERT anônimo desde que consent_lgpd=true)
    const { data, error } = await supabase
      .from("leads")
      .insert({
        nome: nome.trim(),
        condominio: condominio.trim(),
        telefone: telefone.trim(),
        origem: "landing_form",
        consent_lgpd: true,
        quer_demo: querDemo,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null,
      })
      .select("id")
      .single();

    setSalvando(false);

    if (error) {
      console.error("[lead]", error);
      toast.error("Não conseguimos salvar agora. Tente abrir direto no WhatsApp.");
    } else {
      setLeadId(data?.id ?? null);
      track("lead_form_success", { lead_id: data?.id, quer_demo: querDemo });
    }

    // Persiste localmente para personalizar futuras CTAs
    try {
      localStorage.setItem("qd_last_lead", JSON.stringify({ nome, condominio, telefone }));
      window.dispatchEvent(new CustomEvent("qd:lead-saved"));
    } catch {
      /* noop */
    }

    setEnviado(true);
    // Abre conversa no WhatsApp (com mensagem de demo se aplicável)
    window.open(querDemo ? waDemoLink : waLeadLink, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="comecar" className="mx-auto max-w-7xl px-4 md:px-8 py-20">
      <div className="rounded-3xl bg-gradient-brand text-primary-foreground p-8 md:p-14 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-soft opacity-10" />
        <div className="relative grid md:grid-cols-2 gap-10 items-center">
          {/* Pitch */}
          <div>
            <Sparkles size={28} className="mb-4 text-warning" />
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white leading-tight">
              Vamos conversar sobre o seu condomínio?
            </h2>
            <p className="mt-4 text-white/85 max-w-md">
              Preencha 3 campos e abrimos uma conversa no WhatsApp com você em menos de 1 minuto.
              Sem compromisso, sem cartão.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/85">
              <li className="flex items-center gap-2"><CheckCircle2 size={16} /> Atendimento humano em português</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} /> 30 dias grátis · cancele quando quiser</li>
              <li className="flex items-center gap-2"><Lock size={16} /> Seus dados protegidos pela LGPD</li>
            </ul>
          </div>

          {/* Form / Confirmação */}
          <div className="bg-background rounded-2xl p-6 md:p-7 text-foreground shadow-2xl">
            {enviado ? (
              <div className="text-center py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-success/15 text-success flex items-center justify-center mb-4">
                  <PartyPopper size={28} />
                </div>
                <h3 className="font-display font-extrabold text-2xl mb-2">Pronto, {nome.split(" ")[0]}!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Abrimos uma conversa no WhatsApp com a nossa equipe.
                  Em até <strong className="text-foreground">10 minutos</strong> em horário comercial alguém te responde.
                  {leadId && <span className="block mt-1 text-[11px] text-muted-foreground/80">Protocolo #{leadId.slice(0, 8)}</span>}
                </p>

                {/* Próximo passo: agendar demonstração */}
                <div className="rounded-xl border border-primary/30 bg-primary-soft p-4 text-left mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <CalendarClock size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-foreground">Quer pular a fila?</div>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                        Agende uma demo guiada de <strong>15 minutos</strong> direto no WhatsApp.
                      </p>
                      <a
                        href={waDemoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => track("demo_schedule_click", { lead_id: leadId })}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-bold hover:bg-[var(--color-primary-deep)] transition-colors"
                      >
                        <CalendarClock size={14} /> Agendar demo de 15min
                      </a>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-2 border border-border p-4 text-left text-xs space-y-1.5">
                  <div className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] mb-1">Próximos passos</div>
                  <div className="flex gap-2"><span className="text-primary font-bold">1.</span> Confirme seus dados na conversa do WhatsApp</div>
                  <div className="flex gap-2"><span className="text-primary font-bold">2.</span> Escolha um horário para a demo (opcional)</div>
                  <div className="flex gap-2"><span className="text-primary font-bold">3.</span> Importamos seus moradores junto com você</div>
                </div>
                <div className="mt-5 flex flex-col sm:flex-row gap-2">
                  <a
                    href={waLeadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track("wa_click_reabrir", { lead_id: leadId })}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-success text-white px-4 py-3 text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle size={16} /> Reabrir WhatsApp
                  </a>
                  <Link
                    to="/auth/cadastro"
                    onClick={() => track("plan_cta_click", { location: "lead_success" })}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-bold hover:border-primary hover:text-primary transition-colors"
                  >
                    Criar conta agora <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center mb-2">
                  <h3 className="font-display font-extrabold text-2xl">Comece em 1 minuto</h3>
                  <p className="text-xs text-muted-foreground mt-1">3 campos. Sem cartão. Sem enrolação.</p>
                </div>

                <div>
                  <label htmlFor="lead-nome" className="text-xs font-semibold text-foreground mb-1.5 block">Seu nome</label>
                  <input
                    id="lead-nome" type="text" required minLength={2} maxLength={100} value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Carlos Mendes"
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="lead-cond" className="text-xs font-semibold text-foreground mb-1.5 block">Nome do condomínio</label>
                  <input
                    id="lead-cond" type="text" required minLength={2} maxLength={120} value={condominio}
                    onChange={(e) => setCondominio(e.target.value)}
                    placeholder="Ex: Ed. Recanto Verde"
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="lead-tel" className="text-xs font-semibold text-foreground mb-1.5 block">WhatsApp</label>
                  <input
                    id="lead-tel" type="tel" required minLength={8} maxLength={20} value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Opção de demo */}
                <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-border bg-surface-2 p-3 hover:border-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={querDemo}
                    onChange={(e) => setQuerDemo(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input accent-[var(--color-primary)]"
                  />
                  <span className="text-xs text-foreground leading-relaxed">
                    <strong>Quero uma demo guiada de 15 minutos</strong> — alguém do time abre o sistema comigo e mostra tudo direto pelo WhatsApp.
                  </span>
                </label>

                {/* Consentimento LGPD */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input accent-[var(--color-primary)]"
                  />
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    Concordo em receber contato do QiCond pelo WhatsApp e que meus dados sejam tratados conforme a{" "}
                    <Link to="/privacidade" target="_blank" className="text-primary font-semibold underline-offset-2 hover:underline">Política de Privacidade</Link>
                    {" "}e os{" "}
                    <Link to="/termos" target="_blank" className="text-primary font-semibold underline-offset-2 hover:underline">Termos de uso</Link>.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={salvando || !consent}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground hover:bg-[var(--color-primary-deep)] transition-colors shadow-[var(--shadow-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : <>Falar com o QiCond <ArrowRight size={16} /></>}
                </button>
                <p className="text-[11px] text-center text-muted-foreground">
                  Ao enviar, abrimos automaticamente uma conversa no WhatsApp.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- FLOATING WHATSAPP BUTTON -------------------- */
function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const [savedLead, setSavedLead] = useState<{ nome?: string; condominio?: string } | null>(null);
  const [message, setMessage] = useState(WHATSAPP_DEFAULT_MSG);

  useEffect(() => {
    function syncLead() {
      const l = readSavedLead();
      setSavedLead(l);
      setMessage(buildPersonalMsg(l, WHATSAPP_DEFAULT_MSG));
    }
    syncLead();
    window.addEventListener("qd:lead-saved", syncLead);
    return () => window.removeEventListener("qd:lead-saved", syncLead);
  }, []);

  return (
    <>
      {/* Painel */}
      {open && (
        <div
          className="fixed right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
          role="dialog"
          aria-label="Conversar com QiCond"
        >
          <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <MessageCircle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">QiCond</div>
              <div className="text-[11px] text-white/80 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                <span className="truncate">Online · resposta em ~10 min</span>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="text-white/80 hover:text-white -mr-1 h-9 w-9 inline-flex items-center justify-center shrink-0"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-4">
            <div className="rounded-lg bg-surface-2 border border-border p-3 text-xs text-foreground mb-3">
              {savedLead?.nome
                ? <>Olá, {savedLead.nome.split(" ")[0]}! 👋 Continue a conversa de onde paramos.</>
                : <>Olá! 👋 Sou do time QiCond. Conta um pouco do seu condomínio que a gente te ajuda.</>}
            </div>
            <label htmlFor="fab-wa-msg" className="text-[11px] font-semibold text-muted-foreground mb-1 block">Sua mensagem</label>
            <textarea
              id="fab-wa-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-input bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <a
              href={waLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                track("wa_click_floating", { personalized: !!savedLead?.nome });
                setOpen(false);
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-success text-white px-4 py-3 text-sm font-bold hover:opacity-90 transition-opacity min-h-[44px]"
            >
              <MessageCircle size={18} /> Abrir WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Botão flutuante — FAB redondo no mobile, pill no desktop */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={savedLead?.nome ? `Falar no WhatsApp como ${savedLead.nome.split(" ")[0]}` : "Falar no WhatsApp"}
        aria-expanded={open}
        className="fixed right-4 sm:right-6 z-50 inline-flex items-center justify-center sm:justify-start gap-2 rounded-full bg-success text-white h-14 w-14 sm:h-auto sm:w-auto sm:pl-4 sm:pr-5 sm:py-3.5 text-sm font-bold shadow-2xl hover:scale-105 active:scale-95 transition-transform max-w-[calc(100vw-2rem)]"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
          boxShadow: "0 10px 30px -5px rgba(37, 211, 102, 0.5)",
        }}
      >
        <span className="relative flex h-6 w-6 sm:h-5 sm:w-5 items-center justify-center shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-white/40 animate-ping" />
          <MessageCircle size={22} className="sm:hidden" />
          <MessageCircle size={18} className="hidden sm:block" />
        </span>
        <span className="hidden sm:inline truncate max-w-[200px]">
          {savedLead?.nome ? `Continuar como ${savedLead.nome.split(" ")[0]}` : "Falar no WhatsApp"}
        </span>
      </button>
    </>
  );
}
