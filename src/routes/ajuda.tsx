import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Search, BookOpen, MessageCircle, CreditCard, Settings } from "lucide-react";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de ajuda — CONDOZAP" },
      { name: "description", content: "Tutoriais, perguntas frequentes e guias para você usar o CONDOZAP." },
    ],
  }),
  component: AjudaPage,
});

const sections = [
  { icon: BookOpen, title: "Primeiros passos", count: 8, articles: ["Como criar minha conta", "Cadastrar o condomínio", "Importar moradores via planilha", "Configurar a primeira cobrança"] },
  { icon: MessageCircle, title: "WhatsApp", count: 12, articles: ["Como conectar meu número", "Templates de mensagem", "Comandos disponíveis para morador", "Limites do WhatsApp Business"] },
  { icon: CreditCard, title: "Financeiro", count: 15, articles: ["Configurar PIX", "Gerar boleto registrado", "Cálculo de multa e juros", "Conciliação bancária via OFX"] },
  { icon: Settings, title: "Configurações", count: 6, articles: ["Trocar de plano", "Adicionar segundo síndico", "Configurar painel do contador", "Exportar todos os dados"] },
];

function AjudaPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Central de ajuda</div>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">
          Como podemos <span className="text-gradient-brand">ajudar?</span>
        </h1>
        <div className="mt-8 relative max-w-xl mx-auto">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Busque tutoriais, dúvidas e termos..."
            className="w-full rounded-xl border border-border bg-surface pl-11 pr-4 py-3.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 md:px-8 pb-16 grid md:grid-cols-2 gap-5">
        {sections.map((s) => (
          <div key={s.title} className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <s.icon size={20} />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg">{s.title}</h3>
                <div className="text-xs text-muted-foreground">{s.count} artigos</div>
              </div>
            </div>
            <ul className="space-y-2">
              {s.articles.map((a) => (
                <li key={a}>
                  <Link to="/ajuda" className="text-sm text-foreground hover:text-primary transition-colors block py-1">
                    → {a}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 md:px-8 pb-20">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <h2 className="font-display font-extrabold text-2xl mb-2">Não achou o que procura?</h2>
          <p className="text-sm text-muted-foreground mb-5">Nossa equipe responde em até 1 dia útil.</p>
          <Link to="/contato" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-primary-deep)] transition-colors">
            Falar com suporte
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
