import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/auth/convite/$token")({
  head: () => ({ meta: [{ title: "Aceitar convite — WHATSCOND" }] }),
  component: AceitarConvitePage,
});

type Status = "verificando" | "precisa_login" | "aceitando" | "ok" | "erro";

function AceitarConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const [status, setStatus] = useState<Status>("verificando");
  const [erro, setErro] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Guarda o token para retomar após login
      try {
        sessionStorage.setItem("convite_pendente", token);
      } catch {}
      setStatus("precisa_login");
      return;
    }
    aceitar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function aceitar() {
    setStatus("aceitando");
    const { data, error } = await supabase.rpc("aceitar_convite", { _token: token });
    if (error || !data) {
      const msg = error?.message?.includes("expirad")
        ? "Convite expirado."
        : error?.message?.includes("nao_encontrad") || error?.message?.includes("not found")
        ? "Convite inválido ou já utilizado."
        : error?.message || "Não foi possível aceitar o convite.";
      setErro(msg);
      setStatus("erro");
      return;
    }
    try {
      sessionStorage.removeItem("convite_pendente");
    } catch {}
    await refresh();
    toast.success("Convite aceite com sucesso!");
    setStatus("ok");
    setTimeout(() => navigate({ to: "/app" }), 1200);
  }

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <header className="h-16 px-6 flex items-center border-b border-border bg-background">
        <Logo />
      </header>
      <main className="flex-1 grid place-items-center px-6 py-12">
        <div className="max-w-md w-full bg-background border border-border rounded-2xl p-8 text-center">
          {(status === "verificando" || status === "aceitando") && (
            <>
              <Loader2 className="mx-auto animate-spin text-primary" size={32} />
              <h1 className="font-display text-xl font-bold mt-4">
                {status === "verificando" ? "A verificar convite…" : "A processar convite…"}
              </h1>
            </>
          )}

          {status === "precisa_login" && (
            <>
              <h1 className="font-display text-2xl font-extrabold">Você foi convidado!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Para aceitar o convite, primeiro entre ou crie a sua conta. Voltaremos a esta página automaticamente.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to="/auth/login"
                  search={{ next: `/auth/convite/${token}` } as never}
                  className="btn-primary justify-center"
                >
                  Entrar <ArrowRight size={16} />
                </Link>
                <Link
                  to="/auth/cadastro"
                  search={{ next: `/auth/convite/${token}` } as never}
                  className="text-sm text-primary font-semibold mt-2"
                >
                  Não tenho conta — criar conta
                </Link>
              </div>
            </>
          )}

          {status === "ok" && (
            <>
              <CheckCircle2 className="mx-auto text-primary" size={36} />
              <h1 className="font-display text-2xl font-extrabold mt-3">Tudo pronto!</h1>
              <p className="mt-2 text-sm text-muted-foreground">A redirecionar para o painel…</p>
            </>
          )}

          {status === "erro" && (
            <>
              <XCircle className="mx-auto text-destructive" size={36} />
              <h1 className="font-display text-2xl font-extrabold mt-3">Não foi possível aceitar</h1>
              <p className="mt-2 text-sm text-muted-foreground">{erro}</p>
              <Link to="/app" className="btn-primary justify-center mt-6 inline-flex">
                Ir para o painel
              </Link>
            </>
          )}
        </div>
      </main>
      <style>{`
        .btn-primary{display:inline-flex;align-items:center;gap:.5rem;background:var(--color-primary);color:var(--color-primary-foreground);font-weight:600;font-size:.875rem;padding:.625rem 1rem;border-radius:.5rem;}
        .btn-primary:hover{background:var(--color-primary-deep);}
      `}</style>
    </div>
  );
}
