
CREATE OR REPLACE FUNCTION public.limite_usuarios_plano(_condominio_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Utilizadores ilimitados em todos os planos
  SELECT NULL::int WHERE EXISTS (SELECT 1 FROM public.condominios WHERE id = _condominio_id)
$$;

CREATE OR REPLACE FUNCTION public.admin_metricas_globais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'total_empresas', (SELECT COUNT(*) FROM public.condominios),
    'empresas_ativas', (SELECT COUNT(*) FROM public.condominios WHERE suspenso = false),
    'empresas_suspensas', (SELECT COUNT(*) FROM public.condominios WHERE suspenso = true),
    'total_utilizadores', (SELECT COUNT(DISTINCT user_id) FROM public.user_roles),
    'total_unidades', (SELECT COALESCE(SUM(total_unidades),0) FROM public.condominios),
    'total_leads', (SELECT COUNT(*) FROM public.leads),
    'por_plano', (
      SELECT jsonb_object_agg(plano, qtd) FROM (
        SELECT plano::text AS plano, COUNT(*) AS qtd FROM public.condominios GROUP BY plano
      ) s
    )
  ) INTO _r;
  RETURN _r;
END;
$$;
