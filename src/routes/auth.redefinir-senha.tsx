import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { senhaSchema } from "@/auth/validators";
import { Logo } from "@/components/site/Logo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/redefinir-senha")({
  head: () => ({ meta: [{ title: "Nova senha — WHATSCOND" }] }),
  component: RedefinirPage,
});

function RedefinirPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase já processa o token de recovery via URL hash
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) setReady(true);
    else {
      // ainda assim deixa renderizar caso o usuário esteja logado
      supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = senhaSchema.safeParse(senha);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha redefinida!");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo /></div>
        <h1 className="font-display text-3xl font-extrabold">Nova senha</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">Verificando link…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Nova senha (mín. 8)" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-primary-deep)] disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
