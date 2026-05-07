
-- Preferências de notificação por morador
CREATE TABLE public.wa_preferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  condominio_id UUID NOT NULL,
  receber_comunicados BOOLEAN NOT NULL DEFAULT true,
  receber_cobrancas BOOLEAN NOT NULL DEFAULT true,
  receber_visitantes BOOLEAN NOT NULL DEFAULT true,
  receber_encomendas BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, condominio_id)
);
ALTER TABLE public.wa_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê e gerencia preferências"
ON public.wa_preferencias FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Síndico vê preferências do condomínio"
ON public.wa_preferencias FOR SELECT TO authenticated
USING (is_sindico(auth.uid(), condominio_id));

CREATE TRIGGER trg_wa_pref_touch BEFORE UPDATE ON public.wa_preferencias
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Fila de envios
CREATE TYPE wa_job_status AS ENUM ('pendente','enviando','enviado','falha','desistido');

CREATE TABLE public.wa_notif_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  documento_id UUID,
  destinatario_user_id UUID,
  destinatario_telefone TEXT NOT NULL,
  destinatario_nome TEXT,
  contexto TEXT NOT NULL DEFAULT 'comunicado',
  mensagem TEXT NOT NULL,
  status wa_job_status NOT NULL DEFAULT 'pendente',
  tentativas INT NOT NULL DEFAULT 0,
  max_tentativas INT NOT NULL DEFAULT 3,
  ultimo_erro TEXT,
  proxima_tentativa TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wa_notif_jobs_drain_idx ON public.wa_notif_jobs (status, proxima_tentativa)
  WHERE status IN ('pendente','falha');
CREATE INDEX wa_notif_jobs_doc_idx ON public.wa_notif_jobs (documento_id, created_at DESC);
CREATE INDEX wa_notif_jobs_cond_idx ON public.wa_notif_jobs (condominio_id, created_at DESC);

ALTER TABLE public.wa_notif_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Síndico/Contador veem jobs"
ON public.wa_notif_jobs FOR SELECT TO authenticated
USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

CREATE POLICY "Síndico gerencia jobs"
ON public.wa_notif_jobs FOR ALL TO authenticated
USING (is_sindico(auth.uid(), condominio_id))
WITH CHECK (is_sindico(auth.uid(), condominio_id));

CREATE TRIGGER trg_wa_jobs_touch BEFORE UPDATE ON public.wa_notif_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Template de comunicado
ALTER TABLE public.wa_config
  ADD COLUMN IF NOT EXISTS template_comunicado TEXT
  DEFAULT '📢 *{{condominio}}*

Novo {{categoria}} publicado:

📄 *{{titulo}}*

Acesse (link válido por 7 dias):
{{link}}

Responda *menu* para mais opções.';

-- Função: enfileirar comunicado para todos os moradores elegíveis
CREATE OR REPLACE FUNCTION public.enqueue_documento_comunicado(_documento_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc RECORD;
  _cond_nome TEXT;
  _template TEXT;
  _msg TEXT;
  _count INT := 0;
BEGIN
  SELECT d.* INTO _doc FROM public.documentos d WHERE d.id = _documento_id;
  IF _doc IS NULL THEN RETURN 0; END IF;
  IF NOT _doc.aprovado OR NOT _doc.visivel_publico THEN RETURN 0; END IF;
  IF _doc.categoria NOT IN ('comunicado','informativo') THEN RETURN 0; END IF;

  SELECT nome INTO _cond_nome FROM public.condominios WHERE id = _doc.condominio_id;
  SELECT COALESCE(template_comunicado,
    '📢 *{{condominio}}*\n\nNovo {{categoria}}: *{{titulo}}*\n\n{{link}}')
    INTO _template
    FROM public.wa_config WHERE condominio_id = _doc.condominio_id;

  -- placeholder para o link (gerado no worker)
  _msg := replace(replace(replace(replace(_template,
    '{{condominio}}', COALESCE(_cond_nome, 'Condomínio')),
    '{{categoria}}', _doc.categoria::text),
    '{{titulo}}', _doc.titulo),
    '{{link}}', '__SIGNED_LINK__');

  INSERT INTO public.wa_notif_jobs (
    condominio_id, documento_id, destinatario_user_id,
    destinatario_telefone, destinatario_nome, contexto, mensagem
  )
  SELECT
    _doc.condominio_id, _doc.id, p.id,
    p.telefone, p.nome_completo, 'comunicado', _msg
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.condominio_id = _doc.condominio_id
  LEFT JOIN public.wa_preferencias pref
    ON pref.user_id = p.id AND pref.condominio_id = _doc.condominio_id
  WHERE p.telefone IS NOT NULL
    AND length(regexp_replace(p.telefone, '\D', '', 'g')) >= 10
    AND COALESCE(pref.receber_comunicados, true) = true
  GROUP BY _doc.condominio_id, _doc.id, p.id, p.telefone, p.nome_completo;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_documento_comunicado(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_documento_comunicado(UUID) TO authenticated, service_role;

-- Trigger: ao aprovar comunicado/informativo público, enfileira
CREATE OR REPLACE FUNCTION public.tg_documento_aprovado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aprovado = true
     AND NEW.visivel_publico = true
     AND NEW.categoria IN ('comunicado','informativo')
     AND (TG_OP = 'INSERT'
          OR OLD.aprovado IS DISTINCT FROM NEW.aprovado
          OR OLD.visivel_publico IS DISTINCT FROM NEW.visivel_publico)
  THEN
    PERFORM public.enqueue_documento_comunicado(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documento_aprovado ON public.documentos;
CREATE TRIGGER trg_documento_aprovado
AFTER INSERT OR UPDATE OF aprovado, visivel_publico ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.tg_documento_aprovado();
