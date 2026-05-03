
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('sindico', 'morador', 'contador', 'porteiro');
CREATE TYPE public.plano_tipo AS ENUM ('basico', 'profissional', 'admin');
CREATE TYPE public.vinculo_tipo AS ENUM ('proprietario', 'inquilino', 'familiar');
CREATE TYPE public.convite_status AS ENUM ('pendente', 'aceito', 'expirado', 'cancelado');

-- ============ CONDOMINIOS ============
CREATE TABLE public.condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  codigo_publico TEXT NOT NULL UNIQUE,
  plano public.plano_tipo NOT NULL DEFAULT 'basico',
  total_unidades INT NOT NULL DEFAULT 0,
  whatsapp_numero TEXT,
  logo_url TEXT,
  criado_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ UNIDADES ============
CREATE TABLE public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  bloco TEXT,
  numero TEXT NOT NULL,
  fracao_ideal NUMERIC(8,6),
  taxa_mensal NUMERIC(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (condominio_id, bloco, numero)
);

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  telefone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USER_ROLES (sempre separado!) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, condominio_id, role)
);

-- ============ UNIDADE_MORADORES ============
CREATE TABLE public.unidade_moradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vinculo public.vinculo_tipo NOT NULL DEFAULT 'proprietario',
  principal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, user_id)
);

-- ============ CONVITES ============
CREATE TABLE public.convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  email TEXT,
  telefone TEXT,
  nome TEXT,
  role public.app_role NOT NULL DEFAULT 'morador',
  token TEXT NOT NULL UNIQUE,
  status public.convite_status NOT NULL DEFAULT 'pendente',
  enviado_por UUID NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  aceito_em TIMESTAMPTZ,
  aceito_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ AUDIT_LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_cond ON public.user_roles(condominio_id);
CREATE INDEX idx_unidades_cond ON public.unidades(condominio_id);
CREATE INDEX idx_unidade_moradores_user ON public.unidade_moradores(user_id);
CREATE INDEX idx_audit_cond ON public.audit_log(condominio_id, created_at DESC);
CREATE INDEX idx_convites_token ON public.convites(token);

-- ============ FUNCTIONS (security definer) ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _condominio_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND condominio_id = _condominio_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_user_id UUID, _condominio_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND condominio_id = _condominio_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_sindico(_user_id UUID, _condominio_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, _condominio_id, 'sindico'::public.app_role)
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_cond_updated BEFORE UPDATE ON public.condominios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_unid_updated BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_prof_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger: profile auto-criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'telefone', NEW.phone)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS ============
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidade_moradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- CONDOMINIOS
CREATE POLICY "Membros veem seu condomínio" ON public.condominios
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), id));
CREATE POLICY "Qualquer autenticado cria condomínio" ON public.condominios
  FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());
CREATE POLICY "Síndico atualiza condomínio" ON public.condominios
  FOR UPDATE TO authenticated USING (public.is_sindico(auth.uid(), id));
CREATE POLICY "Síndico deleta condomínio" ON public.condominios
  FOR DELETE TO authenticated USING (public.is_sindico(auth.uid(), id));

-- UNIDADES
CREATE POLICY "Membros veem unidades do condomínio" ON public.unidades
  FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), condominio_id));
CREATE POLICY "Síndico cria unidades" ON public.unidades
  FOR INSERT TO authenticated WITH CHECK (public.is_sindico(auth.uid(), condominio_id));
CREATE POLICY "Síndico atualiza unidades" ON public.unidades
  FOR UPDATE TO authenticated USING (public.is_sindico(auth.uid(), condominio_id));
CREATE POLICY "Síndico deleta unidades" ON public.unidades
  FOR DELETE TO authenticated USING (public.is_sindico(auth.uid(), condominio_id));

-- PROFILES
CREATE POLICY "Usuário vê próprio perfil" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Usuário atualiza próprio perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Usuário insere próprio perfil" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Síndicos veem perfis de membros" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.id
      AND public.is_sindico(auth.uid(), ur.condominio_id)
    )
  );

-- USER_ROLES
CREATE POLICY "Usuário vê próprios papéis" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Síndico vê papéis do condomínio" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_sindico(auth.uid(), condominio_id));
CREATE POLICY "Síndico gerencia papéis" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_sindico(auth.uid(), condominio_id))
  WITH CHECK (public.is_sindico(auth.uid(), condominio_id));
-- Permite que o criador do condomínio se atribua o papel de síndico no onboarding
CREATE POLICY "Auto-atribuir síndico ao criar condomínio" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'sindico'
    AND EXISTS (
      SELECT 1 FROM public.condominios c
      WHERE c.id = condominio_id AND c.criado_por = auth.uid()
    )
  );

-- UNIDADE_MORADORES
CREATE POLICY "Morador vê próprios vínculos" ON public.unidade_moradores
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Síndico vê vínculos do condomínio" ON public.unidade_moradores
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = unidade_id AND public.is_sindico(auth.uid(), u.condominio_id))
  );
CREATE POLICY "Síndico gerencia vínculos" ON public.unidade_moradores
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = unidade_id AND public.is_sindico(auth.uid(), u.condominio_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = unidade_id AND public.is_sindico(auth.uid(), u.condominio_id)));

-- CONVITES
CREATE POLICY "Síndico vê convites" ON public.convites
  FOR SELECT TO authenticated USING (public.is_sindico(auth.uid(), condominio_id));
CREATE POLICY "Síndico gerencia convites" ON public.convites
  FOR ALL TO authenticated
  USING (public.is_sindico(auth.uid(), condominio_id))
  WITH CHECK (public.is_sindico(auth.uid(), condominio_id));

-- AUDIT_LOG
CREATE POLICY "Síndico lê auditoria" ON public.audit_log
  FOR SELECT TO authenticated USING (
    condominio_id IS NOT NULL AND public.is_sindico(auth.uid(), condominio_id)
  );
CREATE POLICY "Sistema escreve auditoria" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
