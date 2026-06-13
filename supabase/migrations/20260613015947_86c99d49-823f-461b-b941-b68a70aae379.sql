
-- 1) Campos de assinatura em condominios
ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS assinatura_inicio date,
  ADD COLUMN IF NOT EXISTS assinatura_fim date,
  ADD COLUMN IF NOT EXISTS suspenso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_suspensao text,
  ADD COLUMN IF NOT EXISTS valor_mensal numeric(12,2);

-- 2) Audit log do admin master
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  acao text NOT NULL,
  entidade text,
  entidade_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins veem audit" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins escrevem audit" ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()) AND admin_user_id = auth.uid());

-- 3) Políticas para platform_admin gerir tudo
-- condominios
DROP POLICY IF EXISTS "Platform admin ve todos condominios" ON public.condominios;
CREATE POLICY "Platform admin ve todos condominios" ON public.condominios
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admin atualiza condominios" ON public.condominios;
CREATE POLICY "Platform admin atualiza condominios" ON public.condominios
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admin apaga condominios" ON public.condominios;
CREATE POLICY "Platform admin apaga condominios" ON public.condominios
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Platform admin ve todos roles" ON public.user_roles;
CREATE POLICY "Platform admin ve todos roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admin gere roles" ON public.user_roles;
CREATE POLICY "Platform admin gere roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Platform admin ve perfis" ON public.profiles;
CREATE POLICY "Platform admin ve perfis" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

-- convites
DROP POLICY IF EXISTS "Platform admin ve convites" ON public.convites;
CREATE POLICY "Platform admin ve convites" ON public.convites
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

-- platform_admins: apenas admins atuais podem gerir; permite bootstrap via função
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
DROP POLICY IF EXISTS "Platform admin gere admins" ON public.platform_admins;
CREATE POLICY "Platform admin gere admins" ON public.platform_admins
  FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 4) Bootstrap: primeira pessoa que reclama torna-se admin master
CREATE OR REPLACE FUNCTION public.claim_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT COUNT(*) INTO _count FROM public.platform_admins;
  IF _count > 0 THEN
    -- só admins podem adicionar mais
    IF NOT public.is_platform_admin(_uid) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  INSERT INTO public.platform_admins (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN true;
END;
$$;

-- 5) Métricas globais (security definer porque junta dados de várias empresas)
CREATE OR REPLACE FUNCTION public.admin_metricas_globais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r jsonb;
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
    ),
    'mrr_estimado', (
      SELECT COALESCE(SUM(
        CASE WHEN suspenso THEN 0
             WHEN valor_mensal IS NOT NULL THEN valor_mensal
             WHEN plano::text = 'basico' THEN 49
             WHEN plano::text = 'profissional' THEN 149
             WHEN plano::text = 'enterprise' THEN 499
             ELSE 0 END
      ),0) FROM public.condominios
    )
  ) INTO _r;
  RETURN _r;
END;
$$;
