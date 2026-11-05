-- Recursão infinita em duas policies de RLS.
--
-- O SINTOMA
--
--   ERROR 42P17: infinite recursion detected in policy for relation "..."
--
-- Qualquer leitura de `unidade_moradores` ou de `platform_admins` por um
-- utilizador autenticado rebentava. Como `platform_admins` é lido no arranque
-- de todas as páginas de `/app` (`usePlatformAdmin`), isto derrubava a
-- aplicação inteira para toda a gente — síndico incluído. Passou despercebido
-- porque até hoje ninguém tinha entrado na aplicação em produção: sem conta
-- criada, nenhuma destas policies chegou a ser avaliada.
--
-- A CAUSA
--
-- Uma policy de SELECT sobre a tabela X que, na sua própria expressão, faz
-- SELECT à tabela X. A subconsulta volta a ser filtrada pela mesma policy,
-- que volta a correr a subconsulta. O Postgres detecta e aborta.
--
--   unidade_moradores:  EXISTS (SELECT 1 FROM unidade_moradores um2 WHERE ...)
--   platform_admins:    EXISTS (SELECT 1 FROM platform_admins p WHERE ...)
--
-- A CORREÇÃO
--
-- As duas perguntas já existem como funções `SECURITY DEFINER`, escritas
-- exactamente para isto: `is_morador_da_unidade` e `is_platform_admin`. Correm
-- como dono da tabela, não accionam RLS, e devolvem a mesma resposta. A regra
-- geral: uma policy sobre X nunca consulta X directamente — pergunta a uma
-- função DEFINER.
--
-- Não há alargamento de acesso. As expressões respondem ao mesmo que
-- respondiam; o que muda é só quem corre a subconsulta.


-- ------------------------------------------------------------
-- unidade_moradores
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Morador vê co-residentes da sua unidade"
  ON public.unidade_moradores;

CREATE POLICY "Morador vê co-residentes da sua unidade"
  ON public.unidade_moradores
  FOR SELECT
  USING (public.is_morador_da_unidade(auth.uid(), unidade_id));


-- ------------------------------------------------------------
-- platform_admins
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins veem admins" ON public.platform_admins;

CREATE POLICY "Admins veem admins"
  ON public.platform_admins
  FOR SELECT
  USING (public.is_platform_admin(auth.uid()));
