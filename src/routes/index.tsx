import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import {
  MessageCircle,
  Vote,
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
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CONDOZAP — Gestão de condomínio pelo WhatsApp" },
      {
        name: "description",
        content:
          "Cobranças automáticas, reservas, encomendas e prestação de contas pelo WhatsApp. Sistema profissional para pequenos condomínios. R$ 29/mês.",
      },
      { property: "og:title", content: "CONDOZAP — Condomínio na palma da sua mão" },
      {
        property: "og:description",
        content:
          "O sistema de gestão para pequenos condomínios feito para o WhatsApp.",
      },
    ],
  }),
  component: HomePage,
});

const features = [
  { icon: MessageCircle, title: "Cobrança automática via WhatsApp", desc: "Lembretes, vencimentos e cobranças de atraso enviados no momento certo, com cálculo de multa e juros." },
  { icon: Vote, title: "Assembleias virtuais", desc: "Crie votações, envie para todos e gere ata digital automática ao final do prazo. Um voto por unidade." },
  { icon: PieChart, title: "Prestação de contas mensal", desc: "Relatório de receitas, despesas e inadimplência enviado todo dia 5 para todos os moradores." },
  { icon: CheckCircle2, title: "Confirmação de pagamentos", desc: "Morador envia o comprovante via WhatsApp e o síndico aprova com um clique no painel." },
  { icon: Calendar, title: "Reserva de áreas comuns", desc: "Salão, churrasqueira e quadra com calendário e regras configuráveis. Reserva direto no WhatsApp." },
  { icon: Package, title: "Encomendas e visitantes", desc: "Portaria registra, morador é notificado na hora e libera visitas com QR Code temporário." },
  { icon: Wrench, title: "Ocorrências e chamados", desc: "Manutenção, barulho ou reclamações com foto, status e atribuição a prestadores." },
  { icon: LayoutDashboard, title: "Painel web completo", desc: "Dashboard com inadimplência, histórico, despesas e configurações. Funciona no celular e no PC." },
  { icon: ShieldCheck, title: "Conforme com a LGPD", desc: "Backup diário, logs de auditoria, controle de acesso por perfil e exportação de dados quando quiser." },
];

const testimonials = [
  { name: "Carlos M.", role: "Síndico · Ed. Recanto Verde", text: "Reduzi a inadimplência de 27% para 8% em 3 meses só pela facilidade do WhatsApp.", avatar: "CM" },
  { name: "Patricia R.", role: "Síndica · Cond. Vila Nova", text: "Antes eu gastava 6h por mês fazendo prestação de contas. Agora é automático.", avatar: "PR" },
  { name: "Roberto L.", role: "Síndico · Ed. Aurora", text: "Os moradores adoraram. Tudo no WhatsApp, sem instalar app nenhum.", avatar: "RL" },
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
            Condomínio na palma da sua mão — iOS, Android e PC
          </div>

          <h1 className="mt-6 font-display text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto">
            Gerencie seu condomínio pelo{" "}
            <span className="text-gradient-brand">WhatsApp</span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Cobranças automáticas, reservas de áreas comuns, encomendas, ocorrências
            e prestação de contas — tudo onde seus moradores já estão. Para
            condomínios de até 30 unidades por <strong className="text-foreground">R$ 29/mês</strong>.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/contato"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-[var(--color-primary-deep)] transition-all hover:scale-[1.02]"
            >
              Começar grátis por 30 dias
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/recursos"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Ver demonstração
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> Cancele quando quiser</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" /> Suporte em português</span>
          </div>

          {/* Mock dashboard preview */}
          <div className="mt-14 mx-auto max-w-5xl rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
            <div className="h-9 border-b border-border bg-surface-2 flex items-center gap-1.5 px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-3 text-[11px] text-muted-foreground">condozap.app — Painel do Síndico</span>
            </div>
            <div className="grid grid-cols-12 min-h-[360px]">
              <aside className="hidden md:flex md:col-span-3 bg-sidebar text-sidebar-foreground p-4 flex-col gap-1 text-xs">
                <div className="font-display font-extrabold text-white text-sm mb-3">CONDOZAP</div>
                {["Dashboard", "Unidades", "Pagamentos", "Reservas", "Assembleias", "Ocorrências", "Configurações"].map((it, i) => (
                  <div key={it} className={`px-2.5 py-2 rounded-md flex items-center gap-2 ${i === 0 ? "bg-sidebar-accent text-white" : "text-white/60 hover:bg-sidebar-accent/40"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> {it}
                  </div>
                ))}
              </aside>
              <div className="col-span-12 md:col-span-9 p-5 text-left">
                <div className="text-sm font-semibold text-foreground mb-4">Maio de 2026 · Ed. Recanto Verde</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: "Unidades", value: "15", color: "text-foreground" },
                    { label: "Pagaram", value: "11", color: "text-success" },
                    { label: "Atraso", value: "3", color: "text-destructive" },
                    { label: "Arrecadado", value: "R$ 3.080", color: "text-success" },
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
                    ["101","João Silva","R$ 280","10/05","pago"],
                    ["102","Maria Costa","R$ 280","10/05","atraso"],
                    ["103","Pedro Nunes","R$ 280","10/05","pago"],
                    ["201","Ana Ferreira","R$ 280","10/05","pendente"],
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

      {/* SOCIAL PROOF */}
      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "+200", l: "Condomínios" },
            { v: "8.500", l: "Moradores ativos" },
            { v: "R$ 2.4M", l: "Arrecadados/mês" },
            { v: "4.9/5", l: "Avaliação dos síndicos" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display font-extrabold text-2xl md:text-3xl text-primary">{s.v}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-20">
        <div className="text-center mb-12">
          <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Recursos</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl">Tudo que o síndico precisa</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Um sistema completo que funciona onde seus moradores já estão — no WhatsApp.
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

      {/* HOW IT WORKS */}
      <section className="bg-surface-2 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-20">
          <div className="text-center mb-12">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Como funciona</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl">Comece em 5 minutos</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Cadastre o condomínio", desc: "Informe o nome, número de unidades e o valor da taxa. Importe moradores via planilha." },
              { n: "2", title: "Conecte o WhatsApp", desc: "Verificamos seu número e ativamos as mensagens automáticas em poucos minutos." },
              { n: "3", title: "Comece a usar", desc: "Cobranças, avisos e reservas começam a fluir automaticamente. Você acompanha pelo painel." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-surface border border-border p-6 relative">
                <div className="absolute -top-4 left-6 h-9 w-9 rounded-full bg-primary text-primary-foreground font-display font-extrabold flex items-center justify-center shadow-[var(--shadow-soft)]">
                  {s.n}
                </div>
                <h3 className="font-display font-extrabold text-lg mt-4 mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-20">
        <div className="text-center mb-12">
          <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Depoimentos</div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl">Síndicos que dormem melhor</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex gap-0.5 mb-3 text-warning">
                {[1,2,3,4,5].map((i) => <Star key={i} size={14} fill="currentColor" />)}
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
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-20">
        <div className="rounded-3xl bg-gradient-brand text-primary-foreground p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-soft opacity-10" />
          <div className="relative">
            <Zap size={28} className="mx-auto mb-4 text-warning" />
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white">
              Condomínio na palma da sua mão
            </h2>
            <p className="mt-4 text-white/85 max-w-xl mx-auto">
              Cadastre seu condomínio em 5 minutos. Funciona no celular e no computador.
              Sem contrato, sem taxa de setup.
            </p>
            <Link
              to="/contato"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-warning px-7 py-3.5 text-sm font-bold text-[var(--color-warning-foreground)] hover:bg-warning/90 transition-colors shadow-lg"
            >
              Criar conta grátis — é rápido
              <ArrowRight size={16} />
            </Link>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/75">
              <span className="flex items-center gap-1.5"><Lock size={12} /> Dados seguros</span>
              <span>·</span>
              <span>30 dias grátis</span>
              <span>·</span>
              <span>Suporte humano</span>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
