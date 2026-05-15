import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
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
} from "lucide-react";

const SITE_URL = "https://qidominio.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QiDomínio — Gestão de condomínio pelo WhatsApp" },
      {
        name: "description",
        content:
          "Cobranças, reservas, encomendas, ocorrências e prestação de contas — tudo pelo WhatsApp que seus moradores já usam. Para pequenos condomínios, a partir de R$ 29/mês.",
      },
      { property: "og:title", content: "QiDomínio — Gestão de condomínio pelo WhatsApp" },
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
          name: "QiDomínio",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description:
            "Sistema de gestão de condomínios via WhatsApp: cobranças, reservas, encomendas, ocorrências e prestação de contas.",
          offers: {
            "@type": "Offer",
            price: "29",
            priceCurrency: "BRL",
          },
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
  {
    icon: Receipt,
    title: "Cobrança automática via WhatsApp",
    desc: "Lembretes antes do vencimento, cobranças no atraso e cálculo automático de multa e juros. PIX e boleto direto na conversa.",
  },
  {
    icon: PieChart,
    title: "Prestação de contas mensal",
    desc: "Relatório de receitas, despesas e inadimplência enviado todo dia 5 para todos os moradores. Transparência sem esforço.",
  },
  {
    icon: CheckCircle2,
    title: "Confirmação de pagamentos",
    desc: "O morador envia o comprovante pelo WhatsApp e o síndico aprova com um clique. Conciliação automática por PIX.",
  },
  {
    icon: Calendar,
    title: "Reserva de áreas comuns",
    desc: "Salão, churrasqueira e quadra com calendário, regras e taxas. Reserva e confirmação no próprio WhatsApp.",
  },
  {
    icon: Package,
    title: "Encomendas e visitantes",
    desc: "Portaria registra, morador recebe foto na hora e libera visitas com QR Code temporário.",
  },
  {
    icon: Wrench,
    title: "Ocorrências e chamados",
    desc: "Manutenção, barulho ou reclamações com foto, status e atribuição. O síndico nunca mais perde um pedido.",
  },
  {
    icon: LayoutDashboard,
    title: "Painel web completo",
    desc: "Dashboard com inadimplência, fluxo de caixa, documentos e configurações. Funciona no celular e no computador.",
  },
  {
    icon: ShieldCheck,
    title: "Conforme com a LGPD",
    desc: "Backup diário, logs de auditoria, controle por perfil (síndico, morador, contador, porteiro) e exportação a qualquer momento.",
  },
  {
    icon: FileText,
    title: "Documentos do condomínio",
    desc: "Atas, convenção, regimento e atas de assembleia em um só lugar, acessíveis ao morador via WhatsApp.",
  },
];

const audiences = [
  {
    icon: Building2,
    title: "Síndicos moradores",
    desc: "Você não é gestor profissional, mas precisa cobrar, prestar contas e organizar o condomínio sem virar refém de planilhas.",
  },
  {
    icon: Users,
    title: "Pequenos condomínios",
    desc: "De 6 a 50 unidades, em autogestão. O QiDomínio foi desenhado para essa realidade — não é um sistema corporativo caro e complicado.",
  },
  {
    icon: HeartHandshake,
    title: "Administradoras enxutas",
    desc: "Quer atender mais condomínios sem aumentar a equipe? Centralize a comunicação e automatize o financeiro de cada cliente.",
  },
];

const benefits = [
  { icon: TrendingDown, value: "−70%", label: "de inadimplência média no 3º mês" },
  { icon: Clock, value: "6h", label: "economizadas por mês na prestação de contas" },
  { icon: Smartphone, value: "0", label: "apps que o morador precisa instalar" },
  { icon: MessageCircle, value: "100%", label: "da comunicação no WhatsApp oficial" },
];

const whatsappFlow = [
  {
    icon: Send,
    title: "1. O sistema envia",
    desc: "QiDomínio dispara mensagens automáticas no WhatsApp do morador: boleto, lembrete de vencimento, aviso da assembleia, recibo de pagamento.",
  },
  {
    icon: Bot,
    title: "2. O morador responde por palavras-chave",
    desc: "BOLETO pede a 2ª via. PAGUEI envia o comprovante. RESERVAR agenda o salão. PROBLEMA abre uma ocorrência. AJUDA mostra o que ele pode fazer.",
  },
  {
    icon: LayoutDashboard,
    title: "3. Tudo cai no painel do síndico",
    desc: "Cada interação vira um registro: cobrança paga, reserva confirmada, ocorrência aberta. Você só aprova quando precisa.",
  },
];

const testimonials = [
  { name: "Carlos M.", role: "Síndico · Ed. Recanto Verde, 18 unidades", text: "Reduzi a inadimplência de 27% para 8% em 3 meses só pela facilidade do WhatsApp.", avatar: "CM" },
  { name: "Patricia R.", role: "Síndica · Cond. Vila Nova, 24 unidades", text: "Antes eu gastava 6h por mês fazendo prestação de contas. Agora é automático e ninguém mais reclama de falta de transparência.", avatar: "PR" },
  { name: "Roberto L.", role: "Síndico · Ed. Aurora, 12 unidades", text: "Os moradores adoraram. Tudo no WhatsApp, sem instalar app nenhum. Até quem tem 70 anos consegue usar.", avatar: "RL" },
];

const faqs = [
  {
    q: "O QiDomínio funciona no WhatsApp pessoal do síndico?",
    a: "Não. Usamos o WhatsApp Business API oficial da Meta, com número verificado, para garantir entregabilidade, conformidade com a LGPD e que o seu número pessoal não fique exposto.",
  },
  {
    q: "Os moradores precisam instalar algum aplicativo?",
    a: "Não. O morador conversa com o número do condomínio dentro do WhatsApp que ele já usa todos os dias. Para acompanhar histórico e documentos, existe também uma área web — opcional.",
  },
  {
    q: "Como funcionam os pagamentos?",
    a: "Geramos cobranças com PIX (e boleto registrado no plano Profissional). O morador paga, o sistema concilia automaticamente e atualiza o status. Multa e juros calculados conforme a convenção.",
  },
  {
    q: "Para qual tamanho de condomínio o QiDomínio serve?",
    a: "É feito para pequenos condomínios em autogestão, normalmente de 6 a 50 unidades. Acima disso continua funcionando, mas o foco do produto é resolver bem essa faixa que costuma ser mal atendida.",
  },
];

function HomePage() {
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
            QiDomínio cuida das cobranças, reservas, encomendas, ocorrências e
            prestação de contas. Você acompanha tudo num painel simples — e o
            morador resolve o dia a dia direto na conversa. A partir de{" "}
            <strong className="text-foreground">R$ 29/mês</strong>.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth/cadastro"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-[var(--color-primary-deep)] transition-all hover:scale-[1.02]"
            >
              Começar grátis por 30 dias
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/recursos"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Ver recursos em detalhe
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> Cancele quando quiser</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> WhatsApp Business oficial</span>
          </div>

          {/* Mock conversa WhatsApp + painel */}
          <div className="mt-14 mx-auto max-w-5xl grid md:grid-cols-5 gap-4 text-left">
            {/* Conversa WhatsApp */}
            <div className="md:col-span-2 rounded-2xl border border-border bg-[#075E54] p-3 shadow-[var(--shadow-card)]">
              <div className="rounded-xl bg-[#ECE5DD] p-3 min-h-[360px] flex flex-col gap-2 text-[12px]">
                <div className="self-start max-w-[85%] rounded-lg bg-white px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-bold text-primary mb-0.5">QiDomínio</div>
                  Olá, Maria! Sua taxa de maio (R$ 280) vence em 3 dias.
                  <div className="mt-1 text-[10px] text-muted-foreground">PIX: qidominio@cond.com</div>
                </div>
                <div className="self-end max-w-[85%] rounded-lg bg-[#DCF8C6] px-3 py-2 shadow-sm">PAGUEI</div>
                <div className="self-end max-w-[85%] rounded-lg bg-[#DCF8C6] px-3 py-2 shadow-sm">[foto do comprovante]</div>
                <div className="self-start max-w-[85%] rounded-lg bg-white px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-bold text-primary mb-0.5">QiDomínio</div>
                  Recebido! O síndico vai confirmar e você recebe o recibo aqui mesmo. ✅
                </div>
                <div className="self-end max-w-[85%] rounded-lg bg-[#DCF8C6] px-3 py-2 shadow-sm">RESERVAR SALÃO 15/06</div>
                <div className="self-start max-w-[85%] rounded-lg bg-white px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-bold text-primary mb-0.5">QiDomínio</div>
                  Salão disponível em 15/06. Taxa R$ 80. Confirmar reserva? Responda SIM.
                </div>
              </div>
            </div>

            {/* Painel */}
            <div className="md:col-span-3 rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
              <div className="h-9 border-b border-border bg-surface-2 flex items-center gap-1.5 px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-3 text-[11px] text-muted-foreground">qidominio.app — Painel do síndico</span>
              </div>
              <div className="p-5">
                <div className="text-sm font-semibold text-foreground mb-4">Maio de 2026 · Ed. Recanto Verde</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: "Unidades", value: "18", color: "text-foreground" },
                    { label: "Pagaram", value: "15", color: "text-success" },
                    { label: "Atraso", value: "2", color: "text-destructive" },
                    { label: "Caixa", value: "R$ 4.2k", color: "text-success" },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-border bg-background p-3">
                      <div className="text-[11px] text-muted-foreground">{c.label}</div>
                      <div className={`font-display font-extrabold text-lg mt-0.5 ${c.color}`}>{c.value}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border overflow-hidden text-xs">
                  <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-muted text-muted-foreground font-semibold">
                    <span>Unid.</span><span>Morador</span><span>Valor</span><span>Venc.</span><span>Status</span>
                  </div>
                  {[
                    ["101", "João Silva", "R$ 280", "10/05", "pago"],
                    ["102", "Maria Costa", "R$ 280", "10/05", "pago"],
                    ["103", "Pedro Nunes", "R$ 280", "10/05", "atraso"],
                    ["201", "Ana Ferreira", "R$ 280", "10/05", "pendente"],
                  ].map((r) => (
                    <div key={r[0]} className="grid grid-cols-5 gap-2 px-3 py-2 border-t border-border items-center">
                      <span className="font-semibold">{r[0]}</span>
                      <span className="truncate">{r[1]}</span>
                      <span>{r[2]}</span>
                      <span>{r[3]}</span>
                      <span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r[4] === "pago" ? "bg-success/15 text-success" :
                          r[4] === "atraso" ? "bg-destructive/15 text-destructive" :
                          "bg-warning/20 text-[var(--color-warning-foreground)]"
                        }`}>
                          {r[4] === "pago" ? "Pago" : r[4] === "atraso" ? "Atraso" : "Pendente"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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

      {/* HOW WHATSAPP WORKS */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-20">
        <div className="text-center mb-12">
          <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Como funciona o WhatsApp</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl">A conversa vira gestão</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Usamos o WhatsApp Business API oficial — o mesmo que bancos e grandes
            empresas usam — com número verificado, opt-in registrado e tudo
            dentro da LGPD.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {whatsappFlow.map((s) => (
            <div key={s.title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                <s.icon size={20} />
              </div>
              <h3 className="font-display font-extrabold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
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
        <div className="mt-10 text-center">
          <Link to="/recursos" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Ver todos os recursos em detalhes <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-surface-2 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-20">
          <div className="text-center mb-12">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Depoimentos</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl">Síndicos que dormem melhor</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex gap-0.5 mb-3 text-warning">
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <div className="h-10 w-10 rounded-full bg-primary-soft text-primary font-display font-extrabold flex items-center justify-center text-sm">{t.avatar}</div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 md:px-8 py-20">
        <div className="text-center mb-10">
          <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Perguntas frequentes</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl">Dúvidas comuns</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-surface p-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-foreground">
                {f.q}
                <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-20">
        <div className="rounded-3xl bg-gradient-brand text-primary-foreground p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-soft opacity-10" />
          <div className="relative">
            <Zap size={28} className="mx-auto mb-4 text-warning" />
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white">
              Seu condomínio merece mais leveza
            </h2>
            <p className="mt-4 text-white/85 max-w-xl mx-auto">
              Cadastre o seu condomínio em 5 minutos. Funciona no celular e no
              computador. Sem contrato, sem taxa de setup.
            </p>
            <Link
              to="/auth/cadastro"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-warning px-7 py-3.5 text-sm font-bold text-[var(--color-warning-foreground)] hover:bg-warning/90 transition-colors shadow-lg"
            >
              Criar conta grátis — é rápido
              <ArrowRight size={16} />
            </Link>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/75">
              <span className="flex items-center gap-1.5"><Lock size={12} /> Dados seguros · LGPD</span>
              <span>·</span>
              <span>30 dias grátis</span>
              <span>·</span>
              <span>Suporte humano em português</span>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
