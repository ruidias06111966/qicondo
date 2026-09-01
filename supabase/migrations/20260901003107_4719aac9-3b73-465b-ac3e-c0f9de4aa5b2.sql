-- Liga o perfil `financeiro` às tabelas do módulo financeiro.
--
-- `pode_gerir_financeiro()` foi criada em 20260608014549 mas nunca chegou a ser
-- usada: nem numa política RLS, nem numa server function. Resultado — a UI
-- mostrava o módulo financeiro completo a quem tem o perfil `financeiro`
-- (`podeGerirFinanceiro` em `useCondominio.ts`) e cada leitura/escrita era
-- recusada pelas políticas, que só aceitam `sindico | admin | contador`.
--
-- As políticas RLS são aditivas (OR entre elas), por isso acrescentamos em vez de
-- substituir: os acessos existentes de síndico/admin/contador ficam intactos.
--
-- Fora do âmbito: `config_pagamento` continua restrita a admin/síndico — guarda
-- os dados bancários e a chave PIX da empresa.

-- Garante que o perfil autenticado pode invocar o helper (via RLS e via RPC).
GRANT EXECUTE ON FUNCTION public.pode_gerir_financeiro(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pode_gerir_financeiro(uuid, uuid) FROM anon;

-- ===== categorias_financeiras =====
DROP POLICY IF EXISTS "Financeiro gerencia categorias" ON public.categorias_financeiras;
CREATE POLICY "Financeiro gerencia categorias"
  ON public.categorias_financeiras FOR ALL TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id))
  WITH CHECK (public.pode_gerir_financeiro(auth.uid(), condominio_id));

-- ===== cobrancas =====
DROP POLICY IF EXISTS "Financeiro gerencia cobrancas" ON public.cobrancas;
CREATE POLICY "Financeiro gerencia cobrancas"
  ON public.cobrancas FOR ALL TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id))
  WITH CHECK (public.pode_gerir_financeiro(auth.uid(), condominio_id));

-- ===== pagamentos =====
DROP POLICY IF EXISTS "Financeiro gerencia pagamentos" ON public.pagamentos;
CREATE POLICY "Financeiro gerencia pagamentos"
  ON public.pagamentos FOR ALL TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id))
  WITH CHECK (public.pode_gerir_financeiro(auth.uid(), condominio_id));

-- ===== despesas =====
DROP POLICY IF EXISTS "Financeiro gerencia despesas" ON public.despesas;
CREATE POLICY "Financeiro gerencia despesas"
  ON public.despesas FOR ALL TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id))
  WITH CHECK (public.pode_gerir_financeiro(auth.uid(), condominio_id));