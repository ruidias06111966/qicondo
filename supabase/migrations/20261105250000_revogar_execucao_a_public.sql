-- ============================================================
-- Revogar a execução a PUBLIC nas funções novas
--
-- O DEFEITO
--
-- As duas migrações anteriores escreveram
--
--   REVOKE EXECUTE ON FUNCTION f(...) FROM anon;
--
-- e isso não faz nada. No PostgreSQL, uma função nasce com EXECUTE concedido
-- a PUBLIC. Revogar a `anon` não tira a concessão a PUBLIC, e `anon` continua
-- a poder executar por essa via. Vê-se no `proacl`: as funções novas têm a
-- entrada `=X/postgres` — a tal concessão a PUBLIC — e o `aplicar_orcamento`,
-- que usou `REVOKE ALL ... FROM PUBLIC, anon`, não tem.
--
-- O linter do Supabase apanhou-o: "Public Can Execute SECURITY DEFINER
-- Function", doze funções, dez delas minhas.
--
-- QUANTO É QUE ISTO VALIA
--
-- Não era um buraco explorável. As dez funções começam todas por
--
--   IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
--
-- e a seguir verificam `pode_gerir_financeiro` ou `is_member_of`. Um pedido
-- anónimo era recusado na primeira linha. Mas o que impedia o acesso era uma
-- verificação dentro do corpo, e não a permissão — e uma função nova que se
-- esqueça dessa linha fica exposta sem nada a travá-la. É defesa em
-- profundidade, que é precisamente o que a convenção do projecto manda.
--
-- Revogar a PUBLIC não mexe na concessão a `authenticated`, que é uma entrada
-- separada do `proacl` e sobrevive.
--
-- Os gatilhos continuam a disparar: a execução de uma função de gatilho não
-- passa pela permissão EXECUTE de quem faz o INSERT. Verificado na bateria de
-- `supabase/testes/plano-de-contas.sql`, que corre depois desta migração.
-- ============================================================

-- ---------- plano de contas ----------
REVOKE ALL ON FUNCTION public.semear_plano_contas(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.plano_de_contas(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.criar_conta(uuid, text, public.tipo_lancamento, text, uuid, boolean, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atualizar_conta(uuid, text, text, uuid, boolean, boolean, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desativar_conta(uuid) FROM PUBLIC, anon;

-- ---------- anexos e relatórios ----------
REVOKE ALL ON FUNCTION public.registrar_anexo(uuid, text, uuid, public.anexo_tipo, text, text, text, bigint, text, date, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remover_anexo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_anexos(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pendencias_documentais(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prestacao_por_conta(uuid, date, date) FROM PUBLIC, anon;

-- ---------- funções de gatilho ----------
-- Não são chamáveis pela API REST, mas a concessão a PUBLIC não serve para
-- nada e o linter conta-as.
REVOKE ALL ON FUNCTION public.validar_conta_pai() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recusar_conta_sintetica() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_anexo_entidade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limpar_anexos_do_lancamento() FROM PUBLIC, anon, authenticated;

-- ---------- o mesmo defeito, de antes ----------
-- Duas funções de gatilho de migrações anteriores têm a mesma concessão a
-- PUBLIC, pela mesma razão. São duas linhas e é o mesmo defeito; deixá-las
-- mantinha o aviso aceso sem motivo.
-- Em bloco condicional: o esqueleto de testes não as tem, e uma migração que
-- falha por causa de uma função de outra área não é uma troca que valha a pena.
DO $$
DECLARE
  _f text;
BEGIN
  FOREACH _f IN ARRAY ARRAY['public.validar_coerencia_condominio()',
                            'public.acordo_fechar_se_quitado()']
  LOOP
    IF to_regprocedure(_f) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _f);
    END IF;
  END LOOP;
END;
$$;

-- As concessões a `authenticated` das dez funções chamáveis ficam como
-- estavam: `REVOKE ... FROM PUBLIC` não lhes toca. Repete-se aqui só para o
-- estado final ser legível num ficheiro só.
GRANT EXECUTE ON FUNCTION public.semear_plano_contas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plano_de_contas(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_conta(uuid, text, public.tipo_lancamento, text, uuid, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_conta(uuid, text, text, uuid, boolean, boolean, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desativar_conta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_anexo(uuid, text, uuid, public.anexo_tipo, text, text, text, bigint, text, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_anexo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_anexos(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pendencias_documentais(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestacao_por_conta(uuid, date, date) TO authenticated;
