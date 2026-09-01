import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import {
  MessageCircle, Vote, PieChart, CheckCircle2, Calendar, Package,
  Wrench, LayoutDashboard, ShieldCheck, FileText, Users, Building2, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Recursos — QiCond" },
      { name: "description", content: "Conheça todos os módulos do QiCond: cobrança, assembleias, reservas, encomendas, ocorrências e mais." },
      { property: "og:title", content: "Recursos do QiCond" },
    ],
  }),
  component: RecursosPage,
});

const blocks = [
  {
    icon: MessageCircle, color: "primary",
    title: "Comunicação 100% WhatsApp",
    desc: "Avisos, cobranças, reservas e ocorrências fluem direto no WhatsApp oficial. Morador não precisa instalar nada.",
    items: ["Mural de avisos com confirmação de leitura", "Mensagens em massa segmentadas", "Templates aprovados pela Meta", "Bot conversacional com comandos"],
  },
  {
    icon: PieChart, color: "primary",
    title: "Financeiro completo",
    desc: "Cobrança automática via PIX, conciliação bancária e prestação de contas mensal sem dor de cabeça.",
    items: ["Geração de PIX e boleto registrado", "Cálculo de multa, juros e correção", "Acordo de parcelamento", "Fundo de reserva separado", "Exportação OFX para o contador"],
  },
  {
    icon: Calendar, color: "warning",
    title: "Reserva de áreas comuns",
    desc: "Salão, churrasqueira, quadra ou piscina — calendário visual e regras configuráveis por área.",
    items: ["Reserva direto no WhatsApp", "Taxa, antecedência e horários por área", "Aprovação manual ou automática", "Lembrete na véspera", "Checklist de devolução"],
  },
  {
    icon: Package, color: "primary",
    title: "Encomendas e visitantes",
    desc: "Portaria registra, morador recebe na hora e libera visitas com QR Code temporário.",
    items: ["Foto e remetente da encomenda", "Notificação WhatsApp instantânea", "QR Code para visitantes", "Lista de visitantes recorrentes", "Log completo de acessos"],
  },
  {
    icon: Wrench, color: "warning",
    title: "Ocorrências e chamados",
    desc: "Manutenção, barulho, segurança ou reclamações com foto, status e atribuição a prestadores.",
    items: ["Categorias e prioridade", "Status: aberto, andamento, resolvido", "Atribuição a zelador ou terceirizado", "Nota de satisfação ao fechar", "Relatório mensal para assembleia"],
  },
  {
    icon: Vote, color: "primary",
    title: "Assembleias virtuais",
    desc: "Crie pautas, colete votos no WhatsApp e gere ata digital automática ao final do prazo.",
    items: ["Um voto por unidade (anti-fraude)", "Quórum configurável", "Ata em PDF assinado eletronicamente", "Histórico de deliberações"],
  },
  {
    icon: FileText, color: "primary",
    title: "Documentos do condomínio",
    desc: "Convenção, regimento, atas e contratos em um lugar só, acessível a todos os moradores.",
    items: ["Repositório com versionamento", "Acesso por perfil de usuário", "Busca em texto completo", "Compartilhamento via WhatsApp"],
  },
  {
    icon: Users, color: "primary",
    title: "Cadastro de moradores",
    desc: "Importação por planilha, vínculo a unidades e papéis (proprietário, inquilino, dependente).",
    items: ["Importação CSV/Excel", "Múltiplos contatos por unidade", "Histórico do morador", "LGPD: opt-in registrado"],
  },
  {
    icon: LayoutDashboard, color: "primary",
    title: "Painel web profissional",
    desc: "Dashboard responsivo com tudo o que o síndico precisa em um relance.",
    items: ["Indicadores em tempo real", "Funciona no celular e no PC", "Painel separado para o contador", "Acesso multi-síndico"],
  },
  {
    icon: ShieldCheck, color: "primary",
    title: "Segurança e conformidade",
    desc: "LGPD, backup diário, logs de auditoria e isolamento de dados por condomínio.",
    items: ["Backup diário automatizado", "Logs de auditoria completos", "Autenticação em duas etapas (2FA)", "Exportação de dados a qualquer momento"],
  },
  {
    icon: Building2, color: "primary",
    title: "Multi-condomínio",
    desc: "Administradoras gerenciam vários condomínios em uma conta só.",
    items: ["Troca rápida entre condomínios", "Permissões por condomínio", "Faturamento centralizado"],
  },
];

function RecursosPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Recursos</div>
        <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight">
          Tudo que um <span className="text-gradient-brand">condomínio profissional</span> precisa
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          Cada módulo foi desenhado para tirar trabalho do síndico e dar transparência ao morador.
          Tudo integrado ao WhatsApp.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {blocks.map((b) => (
          <article key={b.title} className="rounded-2xl border border-border bg-surface p-6 hover:shadow-[var(--shadow-card)] transition-all">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${
              b.color === "warning" ? "bg-warning/15 text-[var(--color-warning-foreground)]" : "bg-primary-soft text-primary"
            }`}>
              <b.icon size={22} />
            </div>
            <h3 className="font-display font-extrabold text-xl mb-2">{b.title}</h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{b.desc}</p>
            <ul className="space-y-2">
              {b.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-4 md:px-8 pb-20">
        <div className="rounded-3xl bg-gradient-brand text-white p-10 md:p-12 text-center">
          <h2 className="font-display font-extrabold text-3xl md:text-4xl">Pronto para começar?</h2>
          <p className="mt-3 text-white/80">30 dias grátis. Sem cartão de crédito.</p>
          <Link to="/contato" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white text-primary px-6 py-3 text-sm font-bold hover:scale-[1.02] transition-transform">
            Falar com a gente <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
