import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/auth/AuthProvider";
import { cadastroSchema } from "@/auth/validators";
import { Logo } from "@/components/site/Logo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — WHATSCOND" }] }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ nome_completo: "", email: "", telefone: "+55", senha: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/onboarding" });
  }, [loading, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = cadastroSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.senha,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
        data: {
          nome_completo: parsed.data.nome_completo,
          telefone: parsed.data.telefone,
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    navigate({ to: "/auth/login" });
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth/callback" });
    if (result.error) toast.error("Falha ao entrar com Google");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <Logo inverse />
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            Comece grátis em 5 minutos.
          </h2>
          <ul className="mt-6 space-y-3 text-primary-foreground/90 text-sm">
            <li>✓ Cadastre seu condomínio</li>
            <li>✓ Importe as unidades</li>
            <li>✓ Convide moradores pelo WhatsApp</li>
            <li>✓ 14 dias de avaliação no plano Profissional</li>
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/70">© WHATSCOND</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="font-display text-3xl font-extrabold">Criar conta de síndico</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/auth/login" className="text-primary font-semibold hover:underline">Entrar</Link>
          </p>

          <button
            type="button"
            onClick={onGoogle}
            className="mt-8 w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold hover:bg-muted transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar com Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" /> ou <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="NOME COMPLETO" id="nome">
              <input id="nome" value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} required className="input" autoComplete="name" />
            </Field>
            <Field label="E-MAIL" id="email">
              <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="input" autoComplete="email" />
            </Field>
            <Field label="WHATSAPP (com DDD e DDI)" id="tel">
              <input id="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="+5511999990000" required className="input" autoComplete="tel" />
            </Field>
            <Field label="SENHA (mín. 8 caracteres)" id="senha">
              <input id="senha" type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={8} className="input" autoComplete="new-password" />
            </Field>
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-primary-deep)] disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Criar conta
            </button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Ao criar conta você concorda com nossos{" "}
              <Link to="/termos" className="underline">Termos</Link> e{" "}
              <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
            </p>
          </form>
        </div>
      </div>

      <style>{`.input{margin-top:.25rem;width:100%;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:.625rem .75rem;font-size:.875rem;outline:none;}.input:focus{box-shadow:0 0 0 3px color-mix(in oklab, var(--color-primary) 25%, transparent);}`}</style>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
