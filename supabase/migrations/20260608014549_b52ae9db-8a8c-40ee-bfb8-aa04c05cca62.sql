
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid, _condominio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND condominio_id = _condominio_id AND role = 'admin'::public.app_role
  )
$$;

-- Admin herda poderes de síndico: redefinimos is_sindico para aceitar ambos
CREATE OR REPLACE FUNCTION public.is_sindico(_user_id uuid, _condominio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND condominio_id = _condominio_id
      AND role IN ('sindico'::public.app_role, 'admin'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_gerir_financeiro(_user_id uuid, _condominio_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND condominio_id = _condominio_id
      AND role IN ('sindico'::public.app_role, 'admin'::public.app_role,
                   'contador'::public.app_role, 'financeiro'::public.app_role)
  )
$$;
