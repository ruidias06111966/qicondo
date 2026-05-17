CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  condominio TEXT NOT NULL,
  telefone TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'landing',
  mensagem TEXT,
  consent_lgpd BOOLEAN NOT NULL DEFAULT false,
  quer_demo BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','contatado','agendado','convertido','descartado')),
  observacoes_internas TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX idx_leads_status ON public.leads (status);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode submeter lead"
ON public.leads FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(nome)) BETWEEN 2 AND 100
  AND length(trim(condominio)) BETWEEN 2 AND 120
  AND length(trim(telefone)) BETWEEN 8 AND 20
  AND consent_lgpd = true
);

CREATE POLICY "Síndicos veem leads"
ON public.leads FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'sindico')
);

CREATE POLICY "Síndicos atualizam leads"
ON public.leads FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'sindico')
);

CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();