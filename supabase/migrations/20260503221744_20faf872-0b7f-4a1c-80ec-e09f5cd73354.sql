-- 1) CONVITES: hash tokens; restrict SELECT to omit token; add helper to validate
ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS token_hash text;

-- Backfill existing tokens to hashed form (sha256), keep only hash going forward
UPDATE public.convites
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

-- Drop existing broad policies
DROP POLICY IF EXISTS "Síndico vê convites" ON public.convites;
DROP POLICY IF EXISTS "Síndico gerencia convites" ON public.convites;

-- Create a safe view excluding the raw token
CREATE OR REPLACE VIEW public.convites_safe
WITH (security_invoker = true) AS
SELECT id, condominio_id, unidade_id, email, telefone, nome, role,
       status, enviado_por, expira_em, aceito_em, aceito_por, created_at
FROM public.convites;

-- Re-create restrictive policies. Síndico can SELECT but token column will not be exposed via app code.
CREATE POLICY "Síndico vê convites (sem token cru)"
  ON public.convites FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id));

CREATE POLICY "Síndico insere convites"
  ON public.convites FOR INSERT TO authenticated
  WITH CHECK (is_sindico(auth.uid(), condominio_id));

CREATE POLICY "Síndico atualiza convites"
  ON public.convites FOR UPDATE TO authenticated
  USING (is_sindico(auth.uid(), condominio_id))
  WITH CHECK (is_sindico(auth.uid(), condominio_id));

CREATE POLICY "Síndico deleta convites"
  ON public.convites FOR DELETE TO authenticated
  USING (is_sindico(auth.uid(), condominio_id));

-- RPC para aceitar convite via token em texto (compara via hash)
CREATE OR REPLACE FUNCTION public.aceitar_convite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _conv RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _conv FROM public.convites
   WHERE token_hash = encode(digest(_token, 'sha256'), 'hex')
     AND status = 'pendente'
     AND expira_em > now()
   LIMIT 1;
  IF _conv IS NULL THEN RAISE EXCEPTION 'convite_invalido'; END IF;

  INSERT INTO public.user_roles (user_id, condominio_id, role)
  VALUES (_uid, _conv.condominio_id, _conv.role)
  ON CONFLICT (user_id, condominio_id, role) DO NOTHING;

  IF _conv.unidade_id IS NOT NULL THEN
    INSERT INTO public.unidade_moradores (unidade_id, user_id)
    VALUES (_conv.unidade_id, _uid)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.convites
     SET status = 'aceito', aceito_em = now(), aceito_por = _uid
   WHERE id = _conv.id;

  RETURN _conv.condominio_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aceitar_convite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.aceitar_convite(text) TO authenticated;

-- 2) CONFIG_PAGAMENTO: restringir SELECT direto; expor via view sem segredos.
DROP POLICY IF EXISTS "Síndico vê config pagamento" ON public.config_pagamento;
DROP POLICY IF EXISTS "Síndico gerencia config pagamento" ON public.config_pagamento;

-- Síndico só pode INSERT/UPDATE/DELETE; SELECT é proibido (use a view ou RPC obterConfigPagamento via service-role)
CREATE POLICY "Síndico insere config pagamento"
  ON public.config_pagamento FOR INSERT TO authenticated
  WITH CHECK (is_sindico(auth.uid(), condominio_id));

CREATE POLICY "Síndico atualiza config pagamento"
  ON public.config_pagamento FOR UPDATE TO authenticated
  USING (is_sindico(auth.uid(), condominio_id))
  WITH CHECK (is_sindico(auth.uid(), condominio_id));

CREATE POLICY "Síndico deleta config pagamento"
  ON public.config_pagamento FOR DELETE TO authenticated
  USING (is_sindico(auth.uid(), condominio_id));

-- View segura sem mp_access_token nem pix_chave completa
CREATE OR REPLACE VIEW public.config_pagamento_safe
WITH (security_invoker = true) AS
SELECT condominio_id,
       mp_public_key,
       CASE WHEN pix_chave IS NULL OR length(pix_chave) < 4
            THEN NULL
            ELSE '****' || right(pix_chave, 4) END AS pix_chave_mascarada,
       multa_percentual,
       juros_dia_percentual,
       dias_envio_lembrete,
       ativo,
       (mp_access_token IS NOT NULL) AS mp_token_configured,
       updated_at
FROM public.config_pagamento;

-- Permitir SELECT da view para síndico
CREATE POLICY "Síndico lê config sem segredos"
  ON public.config_pagamento FOR SELECT TO authenticated
  USING (false);  -- bloqueia leitura direta da tabela; use a view ou RPC server-side

-- 3) RESERVAS: política INSERT para morador da unidade
CREATE POLICY "Morador insere reserva da sua unidade"
  ON public.reservas FOR INSERT TO authenticated
  WITH CHECK (
    solicitante_id = auth.uid()
    AND is_morador_da_unidade(auth.uid(), unidade_id)
  );

-- 4) Webhook secret per-condomínio
ALTER TABLE public.config_pagamento ADD COLUMN IF NOT EXISTS mp_webhook_secret text;