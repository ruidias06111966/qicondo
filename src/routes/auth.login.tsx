import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/auth/AuthProvider";
import { loginSchema } from "@/auth/validators";
import { Logo } from "@/components/site/Logo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Entrar — CONDOZAP" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, hasAnyRole } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: hasAnyRole ? "/app" : "/onboarding" });
    }
  }, [loading, user, hasAnyRole, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, senha });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.senha,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
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
            Tudo do seu condomínio.<br />Direto no WhatsApp.
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Entre para ver cobranças, reservas, encomendas e a prestação de contas — sem instalar app.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">© CONDOZAP</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="font-display text-3xl font-extrabold">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/auth/cadastro" className="text-primary font-semibold hover:underline">
              Cadastre seu condomínio
            </Link>
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

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">E-MAIL</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="senha">SENHA</label>
                <Link to="/auth/esqueci-senha" className="text-xs text-primary hover:underline">Esqueci a senha</Link>
              </div>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-primary-deep)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Entrar
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Voltar ao site</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
