import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Heart, Target, Lightbulb, Users } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — WHATSCOND" },
      { name: "description", content: "Conheça a história, a missão e o time por trás do WHATSCOND." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Sobre nós</div>
        <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight">
          Tornando a vida do síndico <span className="text-gradient-brand">mais leve</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          Nascemos da frustração de ser síndico em um condomínio pequeno: planilhas perdidas,
          moradores que esquecem de pagar, grupo de WhatsApp uma bagunça e nenhum sistema do
          mercado que valesse o preço cobrado. Decidimos construir o que faltava.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 md:px-8 pb-16 grid md:grid-cols-2 gap-5">
        {[
          { icon: Target, title: "Nossa missão", desc: "Levar gestão profissional para condomínios de qualquer tamanho, com preço justo e sem complicação." },
          { icon: Heart,  title: "Nosso jeito", desc: "Construímos com simplicidade. Se o síndico precisa de manual, falhamos no design." },
          { icon: Lightbulb, title: "Nossa visão", desc: "Que todo morador resolva sua vida no condomínio direto pelo WhatsApp, sem instalar nada." },
          { icon: Users, title: "Nosso time", desc: "Engenheiros, designers e ex-síndicos espalhados pelo Brasil. 100% remoto." },
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
          <h2 className="font-display font-extrabold text-2xl mb-4">Princípios</h2>
          <ul className="space-y-4 text-sm text-foreground leading-relaxed">
            <li><strong>Transparência radical.</strong> Preço, dados e regras sempre visíveis. Sem letra miúda.</li>
            <li><strong>Privacidade primeiro.</strong> Os dados do condomínio são do condomínio. Exportáveis a qualquer momento.</li>
            <li><strong>WhatsApp oficial.</strong> Usamos a API homologada da Meta. Nada de gambiarra que pode banir o número.</li>
            <li><strong>Suporte humano.</strong> Quando você precisar de gente, vai falar com gente — em português.</li>
          </ul>
        </div>
      </section>
    </SiteLayout>
  );
}
