
-- Platform admin role table (separate from condo-scoped user_roles)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem admins"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins p WHERE p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;

-- Tighten leads policies: drop síndico-wide access
DROP POLICY IF EXISTS "Síndicos veem leads" ON public.leads;
DROP POLICY IF EXISTS "Síndicos atualizam leads" ON public.leads;

CREATE POLICY "Admins plataforma veem leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins plataforma atualizam leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
