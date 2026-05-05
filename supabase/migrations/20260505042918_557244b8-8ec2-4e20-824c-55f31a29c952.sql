CREATE OR REPLACE FUNCTION public.criar_condominio(
  _nome text,
  _cnpj text,
  _endereco text,
  _cidade text,
  _estado text,
  _cep text,
  _whatsapp_numero text,
  _codigo_publico text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _nome IS NULL OR length(trim(_nome)) < 3 THEN RAISE EXCEPTION 'nome_invalido'; END IF;
  IF _codigo_publico IS NULL OR length(trim(_codigo_publico)) < 4 THEN RAISE EXCEPTION 'codigo_invalido'; END IF;

  INSERT INTO public.condominios (
    nome, cnpj, endereco, cidade, estado, cep, whatsapp_numero, codigo_publico, criado_por
  ) VALUES (
    trim(_nome),
    NULLIF(trim(coalesce(_cnpj,'')),''),
    NULLIF(trim(coalesce(_endereco,'')),''),
    NULLIF(trim(coalesce(_cidade,'')),''),
    NULLIF(trim(coalesce(_estado,'')),''),
    NULLIF(trim(coalesce(_cep,'')),''),
    NULLIF(trim(coalesce(_whatsapp_numero,'')),''),
    upper(trim(_codigo_publico)),
    _uid
  ) RETURNING id INTO _id;

  INSERT INTO public.user_roles (user_id, condominio_id, role)
  VALUES (_uid, _id, 'sindico'::app_role)
  ON CONFLICT (user_id, condominio_id, role) DO NOTHING;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_id, _uid, 'condominio_criado', 'condominios', _id);

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_condominio(text, text, text, text, text, text, text, text) TO authenticated;