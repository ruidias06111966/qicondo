
-- Enums
CREATE TYPE public.ocorrencia_categoria AS ENUM (
  'manutencao','barulho','seguranca','limpeza','area_comum','infraestrutura','outros'
);
CREATE TYPE public.ocorrencia_prioridade AS ENUM ('baixa','media','alta','urgente');
CREATE TYPE public.ocorrencia_status AS ENUM (
  'aberta','em_andamento','aguardando_morador','resolvida','fechada','cancelada'
);

-- Tabela principal
CREATE TABLE public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  unidade_id UUID,
  aberta_por UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria ocorrencia_categoria NOT NULL DEFAULT 'outros',
  prioridade ocorrencia_prioridade NOT NULL DEFAULT 'media',
  status ocorrencia_status NOT NULL DEFAULT 'aberta',
  local TEXT,
  foto_url TEXT,
  atribuido_a TEXT,
  atribuido_por UUID,
  atribuido_em TIMESTAMPTZ,
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID,
  resolucao TEXT,
  fechado_em TIMESTAMPTZ,
  nota_satisfacao SMALLINT CHECK (nota_satisfacao BETWEEN 1 AND 5),
  comentario_satisfacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ocorrencias (condominio_id, status, created_at DESC);
CREATE INDEX ON public.ocorrencias (unidade_id);

CREATE TRIGGER trg_ocorrencias_updated BEFORE UPDATE ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Comentários
CREATE TABLE public.ocorrencia_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL,
  autor_id UUID NOT NULL,
  mensagem TEXT NOT NULL,
  interno BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ocorrencia_comentarios (ocorrencia_id, created_at);

-- Anexos
CREATE TABLE public.ocorrencia_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL,
  url TEXT NOT NULL,
  nome TEXT,
  enviado_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_anexos ENABLE ROW LEVEL SECURITY;

-- ocorrencias: morador vê as da sua unidade ou as que ele abriu
CREATE POLICY "Morador vê ocorrências da sua unidade"
ON public.ocorrencias FOR SELECT TO authenticated
USING (
  (unidade_id IS NOT NULL AND is_morador_da_unidade(auth.uid(), unidade_id))
  OR aberta_por = auth.uid()
);

CREATE POLICY "Morador abre ocorrências"
ON public.ocorrencias FOR INSERT TO authenticated
WITH CHECK (
  aberta_por = auth.uid()
  AND (
    (unidade_id IS NOT NULL AND is_morador_da_unidade(auth.uid(), unidade_id))
    OR is_sindico(auth.uid(), condominio_id)
    OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role)
  )
);

CREATE POLICY "Morador avalia própria ocorrência"
ON public.ocorrencias FOR UPDATE TO authenticated
USING (aberta_por = auth.uid())
WITH CHECK (aberta_por = auth.uid());

CREATE POLICY "Síndico/Porteiro veem todas ocorrências"
ON public.ocorrencias FOR SELECT TO authenticated
USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

CREATE POLICY "Síndico/Porteiro gerenciam ocorrências"
ON public.ocorrencias FOR ALL TO authenticated
USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

-- comentarios
CREATE POLICY "Participantes veem comentários"
ON public.ocorrencia_comentarios FOR SELECT TO authenticated
USING (
  (NOT interno AND EXISTS (
    SELECT 1 FROM public.ocorrencias o
    WHERE o.id = ocorrencia_id
      AND (o.aberta_por = auth.uid()
           OR (o.unidade_id IS NOT NULL AND is_morador_da_unidade(auth.uid(), o.unidade_id)))
  ))
  OR is_sindico(auth.uid(), condominio_id)
  OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role)
);

CREATE POLICY "Participantes comentam"
ON public.ocorrencia_comentarios FOR INSERT TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND (
    is_sindico(auth.uid(), condominio_id)
    OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role)
    OR (NOT interno AND EXISTS (
      SELECT 1 FROM public.ocorrencias o
      WHERE o.id = ocorrencia_id
        AND (o.aberta_por = auth.uid()
             OR (o.unidade_id IS NOT NULL AND is_morador_da_unidade(auth.uid(), o.unidade_id)))
    ))
  )
);

-- anexos
CREATE POLICY "Participantes veem anexos"
ON public.ocorrencia_anexos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ocorrencias o
    WHERE o.id = ocorrencia_id
      AND (o.aberta_por = auth.uid()
           OR (o.unidade_id IS NOT NULL AND is_morador_da_unidade(auth.uid(), o.unidade_id)))
  )
  OR is_sindico(auth.uid(), condominio_id)
  OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role)
);

CREATE POLICY "Participantes anexam"
ON public.ocorrencia_anexos FOR INSERT TO authenticated
WITH CHECK (
  enviado_por = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.ocorrencias o
    WHERE o.id = ocorrencia_id
      AND (o.aberta_por = auth.uid()
           OR is_sindico(auth.uid(), o.condominio_id)
           OR has_role(auth.uid(), o.condominio_id, 'porteiro'::app_role)
           OR (o.unidade_id IS NOT NULL AND is_morador_da_unidade(auth.uid(), o.unidade_id)))
  )
);

-- ============ FUNÇÕES ============

CREATE OR REPLACE FUNCTION public.abrir_ocorrencia(
  _condominio_id UUID,
  _unidade_id UUID,
  _titulo TEXT,
  _descricao TEXT,
  _categoria ocorrencia_categoria,
  _prioridade ocorrencia_prioridade,
  _local TEXT,
  _foto_url TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _id UUID;
  _ok BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  _ok := is_sindico(_uid, _condominio_id)
      OR has_role(_uid, _condominio_id, 'porteiro'::app_role)
      OR (_unidade_id IS NOT NULL AND is_morador_da_unidade(_uid, _unidade_id));
  IF NOT _ok THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _unidade_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM unidades WHERE id = _unidade_id AND condominio_id = _condominio_id) THEN
      RAISE EXCEPTION 'unidade_invalida';
    END IF;
  END IF;

  INSERT INTO public.ocorrencias (
    condominio_id, unidade_id, aberta_por, titulo, descricao,
    categoria, prioridade, local, foto_url
  ) VALUES (
    _condominio_id, _unidade_id, _uid, _titulo, _descricao,
    COALESCE(_categoria,'outros'::ocorrencia_categoria),
    COALESCE(_prioridade,'media'::ocorrencia_prioridade),
    _local, _foto_url
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, _uid, 'ocorrencia_aberta', 'ocorrencias', _id,
    jsonb_build_object('categoria', _categoria, 'prioridade', _prioridade));

  RETURN _id;
END;$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_ocorrencia(
  _ocorrencia_id UUID,
  _novo_status ocorrencia_status,
  _resolucao TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id INTO _cond FROM ocorrencias WHERE id = _ocorrencia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'ocorrencia_nao_encontrada'; END IF;
  IF NOT (is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE ocorrencias SET
    status = _novo_status,
    resolucao = COALESCE(_resolucao, resolucao),
    resolvido_em = CASE WHEN _novo_status = 'resolvida' THEN now() ELSE resolvido_em END,
    resolvido_por = CASE WHEN _novo_status = 'resolvida' THEN _uid ELSE resolvido_por END,
    fechado_em = CASE WHEN _novo_status = 'fechada' THEN now() ELSE fechado_em END
  WHERE id = _ocorrencia_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'ocorrencia_status_alterado', 'ocorrencias', _ocorrencia_id,
    jsonb_build_object('status', _novo_status));
END;$$;

CREATE OR REPLACE FUNCTION public.atribuir_ocorrencia(
  _ocorrencia_id UUID,
  _atribuido_a TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id INTO _cond FROM ocorrencias WHERE id = _ocorrencia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'ocorrencia_nao_encontrada'; END IF;
  IF NOT is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE ocorrencias SET
    atribuido_a = _atribuido_a,
    atribuido_por = _uid,
    atribuido_em = now(),
    status = CASE WHEN status = 'aberta' THEN 'em_andamento'::ocorrencia_status ELSE status END
  WHERE id = _ocorrencia_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'ocorrencia_atribuida', 'ocorrencias', _ocorrencia_id,
    jsonb_build_object('atribuido_a', _atribuido_a));
END;$$;

CREATE OR REPLACE FUNCTION public.comentar_ocorrencia(
  _ocorrencia_id UUID,
  _mensagem TEXT,
  _interno BOOLEAN
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID; _unid UUID; _aberta UUID;
  _id UUID; _ok BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, unidade_id, aberta_por INTO _cond, _unid, _aberta
    FROM ocorrencias WHERE id = _ocorrencia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'ocorrencia_nao_encontrada'; END IF;

  _ok := is_sindico(_uid, _cond)
      OR has_role(_uid, _cond, 'porteiro'::app_role)
      OR (NOT _interno AND (_aberta = _uid
            OR (_unid IS NOT NULL AND is_morador_da_unidade(_uid, _unid))));
  IF NOT _ok THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.ocorrencia_comentarios (ocorrencia_id, condominio_id, autor_id, mensagem, interno)
  VALUES (_ocorrencia_id, _cond, _uid, _mensagem, COALESCE(_interno, false))
  RETURNING id INTO _id;

  RETURN _id;
END;$$;

CREATE OR REPLACE FUNCTION public.avaliar_ocorrencia(
  _ocorrencia_id UUID,
  _nota SMALLINT,
  _comentario TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID; _aberta UUID; _st ocorrencia_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _nota < 1 OR _nota > 5 THEN RAISE EXCEPTION 'nota_invalida'; END IF;

  SELECT condominio_id, aberta_por, status INTO _cond, _aberta, _st
    FROM ocorrencias WHERE id = _ocorrencia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'ocorrencia_nao_encontrada'; END IF;
  IF _aberta <> _uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _st NOT IN ('resolvida','fechada') THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE ocorrencias SET
    nota_satisfacao = _nota,
    comentario_satisfacao = _comentario,
    status = 'fechada',
    fechado_em = COALESCE(fechado_em, now())
  WHERE id = _ocorrencia_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'ocorrencia_avaliada', 'ocorrencias', _ocorrencia_id,
    jsonb_build_object('nota', _nota));
END;$$;

REVOKE EXECUTE ON FUNCTION public.abrir_ocorrencia FROM anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_status_ocorrencia FROM anon;
REVOKE EXECUTE ON FUNCTION public.atribuir_ocorrencia FROM anon;
REVOKE EXECUTE ON FUNCTION public.comentar_ocorrencia FROM anon;
REVOKE EXECUTE ON FUNCTION public.avaliar_ocorrencia FROM anon;
