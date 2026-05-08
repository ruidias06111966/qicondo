import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { FinanceiroSubNav } from "@/components/financeiro/ui";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — CONDOZAP" }] }),
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const { condominioId, podeGerirFinanceiro, isMorador } = useCondominioAtivo();

  if (!condominioId) {
    return (
      <div className="p-10 text-muted-foreground">
        Selecione um condomínio para acessar o financeiro.
      </div>
    );
  }

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

      <FinanceiroSubNav podeGerir={podeGerirFinanceiro} />

      <Outlet />
    </div>
  );
}
