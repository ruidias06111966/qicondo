
CREATE OR REPLACE FUNCTION public.join_condominio_by_code(_codigo TEXT)
RETURNS TABLE(condominio_id UUID, nome TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE EXECUTE ON FUNCTION public.join_condominio_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_condominio_by_code(TEXT) TO authenticated;
