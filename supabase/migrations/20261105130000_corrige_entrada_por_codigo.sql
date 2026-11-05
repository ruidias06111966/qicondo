-- `join_condominio_by_code` rebentava sempre. Nenhum morador conseguia entrar.
--
-- O SINTOMA
--
--   ERROR 42702: column reference "condominio_id" is ambiguous
--   DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--
-- Cem por cento das chamadas. Este é o caminho pelo qual um condómino entra
-- no condomínio a partir do onboarding, escrevendo o código público que o
-- síndico lhe deu. Estava morto, e com ele o requisito que define o sistema:
-- o síndico dar acesso aos condóminos.
--
-- Nunca apareceu porque até hoje ninguém se tinha registado em produção.
--
-- A CAUSA
--
-- `RETURNS TABLE(condominio_id uuid, nome text)` declara, em PL/pgSQL, duas
-- variáveis com esses nomes dentro da função. Quando o corpo escreve
--
--   ON CONFLICT (user_id, condominio_id, role)
--
-- o `condominio_id` pode ser a variável de saída ou a coluna de `user_roles`,
-- e o Postgres recusa-se a adivinhar.
--
-- A CORREÇÃO
--
-- `#variable_conflict use_column`, que manda resolver para a coluna quando há
-- dúvida. É a opção certa aqui porque todas as variáveis que a função usa a
-- sério têm prefixo `_` e não colidem com coluna nenhuma: `_uid`, `_cid` e
-- `_nome`. As únicas que colidem são as de saída, e em nenhum sítio do corpo
-- se pretende lê-las — são preenchidas pelo `RETURN QUERY` final.
--
-- A assinatura fica igual. O ecrã de onboarding lê `data[0].nome`, e mudar os
-- nomes das colunas de saída partiria esse código sem necessidade.
--
-- O resto do corpo é o que já lá estava, sem uma vírgula alterada.

CREATE OR REPLACE FUNCTION public.join_condominio_by_code(_codigo text)
RETURNS TABLE(condominio_id uuid, nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  _uid UUID := auth.uid();
  _cid UUID;
  _nome TEXT;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT c.id, c.nome INTO _cid, _nome
  FROM public.condominios c
  WHERE upper(c.codigo_publico) = upper(trim(_codigo))
  LIMIT 1;

  IF _cid IS NULL THEN
    RAISE EXCEPTION 'codigo_nao_encontrado';
  END IF;

  INSERT INTO public.user_roles (user_id, condominio_id, role)
  VALUES (_uid, _cid, 'morador')
  ON CONFLICT (user_id, condominio_id, role) DO NOTHING;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cid, _uid, 'morador_entrou_via_codigo', 'user_roles', _uid);

  RETURN QUERY SELECT _cid, _nome;
END;
$$;

REVOKE ALL ON FUNCTION public.join_condominio_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_condominio_by_code(text) TO authenticated;
