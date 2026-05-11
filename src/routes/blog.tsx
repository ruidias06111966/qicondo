import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ArrowRight, Calendar } from "lucide-react";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — WHATSCOND" },
      { name: "description", content: "Conteúdo prático para síndicos: gestão de condomínio, LGPD, finanças, assembleias e mais." },
    ],
  }),
  component: BlogPage,
});

const posts = [
  { slug: "como-ser-um-bom-sindico", title: "Como ser um bom síndico em 2026", excerpt: "10 hábitos que separam síndicos amadores dos profissionais.", date: "12 mai 2026", tag: "Gestão" },
  { slug: "lgpd-em-condominio", title: "LGPD em condomínio: o guia completo", excerpt: "O que você precisa fazer para não levar multa.", date: "5 mai 2026", tag: "Jurídico" },
  { slug: "convencao-condominio", title: "Convenção de condomínio: o que mudar e o que manter", excerpt: "Cláusulas essenciais e armadilhas comuns.", date: "28 abr 2026", tag: "Jurídico" },
  { slug: "reduzir-inadimplencia", title: "Como reduzir a inadimplência em 60 dias", excerpt: "Estratégias testadas em 200+ condomínios.", date: "20 abr 2026", tag: "Financeiro" },
  { slug: "assembleia-virtual", title: "Assembleia virtual tem validade jurídica?", excerpt: "Sim, e a gente explica como.", date: "10 abr 2026", tag: "Jurídico" },
  { slug: "fundo-reserva", title: "Fundo de reserva: quanto guardar?", excerpt: "Cálculo e melhores práticas.", date: "2 abr 2026", tag: "Financeiro" },
];

function BlogPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Blog</div>
        <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight">
          Síndico mais <span className="text-gradient-brand">preparado</span>
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          Conteúdo prático sobre gestão de condomínios, finanças, jurídico e LGPD.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-20 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts.map((p) => (
          <article key={p.slug} className="group rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-[var(--shadow-card)] transition-all">
            <div className="h-40 bg-gradient-brand relative overflow-hidden">
              <div className="absolute inset-0 bg-grid-soft opacity-20" />
              <div className="absolute bottom-3 left-4 text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur text-white px-2 py-0.5 rounded-full">
                {p.tag}
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Calendar size={12} /> {p.date}
              </div>
              <h3 className="font-display font-extrabold text-lg mb-2 group-hover:text-primary transition-colors">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.excerpt}</p>
              <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
                Ler artigo <ArrowRight size={14} />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </SiteLayout>
  );
}
