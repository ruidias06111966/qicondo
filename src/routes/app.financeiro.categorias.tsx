/**
 * A aba "Categorias" passou a ser o plano de contas.
 *
 * É a mesma tabela: a categoria financeira ganhou código, conta superior e a
 * marca de sintética. Duas páginas sobre a mesma coisa só servem para as duas
 * divergirem, por isso esta ficou um redireccionamento — os favoritos e os
 * links antigos continuam a funcionar.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/financeiro/categorias")({
  beforeLoad: () => {
    throw redirect({ to: "/app/financeiro/plano-contas" });
  },
});
