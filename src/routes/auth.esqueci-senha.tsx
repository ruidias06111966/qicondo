import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema } from "@/auth/validators";
import { Logo } from "@/components/site/Logo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/esqueci-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — CONDOZAP" }] }),
  component: EsqueciPage,
});

function EsqueciPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error("E-mail inválido"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: window.location.origin + "/auth/redefinir-senha",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo /></div>
        <h1 className="font-display text-3xl font-extrabold">Recuperar senha</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Enviamos um link para <b>{email}</b>. Abra o e-mail e clique para definir uma nova senha.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-primary-deep)] disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                Enviar link
              </button>
            </form>
          </>
        )}
        <p className="mt-8 text-center text-sm">
          <Link to="/auth/login" className="text-primary hover:underline">← Voltar para entrar</Link>
        </p>
      </div>
    </div>
  );
}
