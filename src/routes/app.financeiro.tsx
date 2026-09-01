import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { FinanceiroSubNav, rotaFinanceiraBloqueada } from "@/components/financeiro/ui";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — QiCond" }] }),
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const { condominioId, podeGerirFinanceiro, isAdmin, isMorador } = useCondominioAtivo();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (!condominioId) {
    return (
      <div className="p-10 text-muted-foreground">
        Selecione uma empresa para acessar o financeiro.
      </div>
    );
  }

  // A sub-navegação já esconde as abas restritas; isto cobre o acesso por URL directo.
  const bloqueado = rotaFinanceiraBloqueada(path, { podeGerir: podeGerirFinanceiro, isAdmin });

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold">Financeiro</h1>
        <p className="text-muted-foreground mt-1">
          {isMorador
            ? "Suas cobranças e pagamentos."
            : "Gestão completa de receitas, despesas e cobranças."}
        </p>
      </header>

      <FinanceiroSubNav podeGerir={podeGerirFinanceiro} isAdmin={isAdmin} />

      {bloqueado ? (
        <div className="bg-background border border-border rounded-2xl p-10 text-center">
          <ShieldAlert className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground mt-1">
            Esta área é reservada a quem gere o financeiro da empresa.
          </p>
          <Link
            to="/app/financeiro"
            className="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Voltar à visão geral
          </Link>
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
