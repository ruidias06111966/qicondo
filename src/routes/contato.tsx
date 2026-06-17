import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Mail, MessageCircle, MapPin, Send, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — WHATSCOND" },
      { name: "description", content: "Fale com a equipe WHATSCOND. Responda em até 1 dia útil. WhatsApp e email." },
    ],
  }),
  component: ContatoPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  condominio: z.string().trim().min(2, "Informe o nome do condomínio").max(120),
  unidades: z.string().trim().max(10).optional(),
  mensagem: z.string().trim().min(10, "Mensagem muito curta").max(1000),
});

function ContatoPage() {
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = schema.safeParse(Object.fromEntries(fd));
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    // Persistência real entra na Fase 2 (Lovable Cloud).
    setSent(true);
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 md:px-8 pt-16 pb-12 text-center">
        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-3">Contato</div>
        <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight">
          Vamos <span className="text-gradient-brand">conversar</span>
        </h1>
        <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
          Conte sobre seu condomínio. Em até 1 dia útil entramos em contato com uma demonstração personalizada.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 md:px-8 pb-20 grid md:grid-cols-5 gap-8">
        <aside className="md:col-span-2 space-y-4">
          {[
            { icon: MessageCircle, title: "WhatsApp", value: "+55 61 98275-0884", href: "https://wa.me/5561982750884" },
            { icon: Mail, title: "Email", value: "qidomino@gmail.com", href: "mailto:qidomino@gmail.com" },
            { icon: MapPin, title: "Onde estamos", value: "100% remoto · time no Brasil", href: null },
          ].map((c) => (
            <a
              key={c.title}
              href={c.href ?? undefined}
              target={c.href?.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="block rounded-2xl border border-border bg-surface p-5 hover:border-primary transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <c.icon size={18} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{c.title}</div>
                  <div className="text-sm font-semibold mt-0.5">{c.value}</div>
                </div>
              </div>
            </a>
          ))}

          <div className="rounded-2xl bg-gradient-brand text-white p-5">
            <div className="font-display font-extrabold text-lg mb-1">Demonstração ao vivo</div>
            <p className="text-sm text-white/85">Agende 20 minutos com nossa equipe e veja o sistema na prática.</p>
          </div>
        </aside>

        <form onSubmit={onSubmit} className="md:col-span-3 rounded-2xl border border-border bg-surface p-6 md:p-8">
          {sent ? (
            <div className="text-center py-12">
              <div className="mx-auto h-14 w-14 rounded-full bg-success/15 text-success flex items-center justify-center mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="font-display font-extrabold text-2xl mb-2">Recebemos!</h3>
              <p className="text-sm text-muted-foreground">
                Em até 1 dia útil entramos em contato pelo email informado.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display font-extrabold text-2xl mb-1">Solicite uma demonstração</h2>
              <p className="text-sm text-muted-foreground mb-6">É grátis, sem compromisso.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field name="nome" label="Seu nome" placeholder="João Silva" error={errors.nome} />
                <Field name="email" label="Email" type="email" placeholder="voce@email.com" error={errors.email} />
                <Field name="condominio" label="Nome do condomínio" placeholder="Ed. Recanto Verde" error={errors.condominio} />
                <Field name="unidades" label="Nº de unidades" placeholder="15" error={errors.unidades} />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold mb-1.5">Mensagem</label>
                <textarea
                  name="mensagem"
                  rows={4}
                  maxLength={1000}
                  placeholder="Conte um pouco sobre seu condomínio e o que você precisa..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {errors.mensagem && <p className="mt-1 text-xs text-destructive">{errors.mensagem}</p>}
              </div>
              <button
                type="submit"
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground hover:bg-[var(--color-primary-deep)] transition-colors"
              >
                <Send size={15} /> Enviar mensagem
              </button>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Ao enviar você concorda com nossa{" "}
                <a href="/privacidade" className="text-primary hover:underline">política de privacidade</a>.
              </p>
            </>
          )}
        </form>
      </section>
    </SiteLayout>
  );
}

function Field({ name, label, type = "text", placeholder, error }: {
  name: string; label: string; type?: string; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        maxLength={255}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
