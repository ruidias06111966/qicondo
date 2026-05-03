
-- ENUMs
CREATE TYPE public.encomenda_status AS ENUM ('aguardando', 'retirada', 'devolvida');
CREATE TYPE public.visitante_tipo AS ENUM ('visita', 'prestador', 'delivery', 'mudanca', 'outro');
CREATE TYPE public.visitante_status AS ENUM ('aguardando', 'autorizado', 'recusado', 'dentro', 'saiu', 'expirado');
CREATE TYPE public.wa_status AS ENUM ('pendente', 'enviado', 'falhou');

-- ENCOMENDAS
CREATE TABLE public.encomendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  unidade_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  transportadora TEXT,
  codigo_rastreio TEXT,
  remetente TEXT,
  foto_url TEXT,
  local_armazenamento TEXT,
  observacoes TEXT,
  status encomenda_status NOT NULL DEFAULT 'aguardando',
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  recebido_por UUID,
  retirado_em TIMESTAMPTZ,
  retirado_por UUID,
  retirado_por_nome TEXT,
  notificado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enc_cond ON public.encomendas(condominio_id);
CREATE INDEX idx_enc_unid ON public.encomendas(unidade_id);
CREATE INDEX idx_enc_status ON public.encomendas(status);
CREATE TRIGGER encomendas_touch BEFORE UPDATE ON public.encomendas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.encomendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Morador vê encomendas da sua unidade" ON public.encomendas
  FOR SELECT TO authenticated USING (is_morador_da_unidade(auth.uid(), unidade_id));

CREATE POLICY "Síndico/Porteiro veem encomendas" ON public.encomendas
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

CREATE POLICY "Síndico/Porteiro gerenciam encomendas" ON public.encomendas
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

-- VISITANTES
CREATE TABLE public.visitantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  unidade_id UUID NOT NULL,
  nome TEXT NOT NULL,
  documento TEXT,
  foto_url TEXT,
  tipo visitante_tipo NOT NULL DEFAULT 'visita',
  empresa TEXT,
  placa_veiculo TEXT,
  observacoes TEXT,
  status visitante_status NOT NULL DEFAULT 'aguardando',
  motivo_recusa TEXT,
  valido_ate TIMESTAMPTZ,
  registrado_por UUID,
  autorizado_por UUID,
  autorizado_em TIMESTAMPTZ,
  entrada_em TIMESTAMPTZ,
  saida_em TIMESTAMPTZ,
  notificado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vis_cond ON public.visitantes(condominio_id);
CREATE INDEX idx_vis_unid ON public.visitantes(unidade_id);
CREATE INDEX idx_vis_status ON public.visitantes(status);
CREATE TRIGGER visitantes_touch BEFORE UPDATE ON public.visitantes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.visitantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Morador vê visitantes da sua unidade" ON public.visitantes
  FOR SELECT TO authenticated USING (is_morador_da_unidade(auth.uid(), unidade_id));

CREATE POLICY "Síndico/Porteiro veem visitantes" ON public.visitantes
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

CREATE POLICY "Síndico/Porteiro gerenciam visitantes" ON public.visitantes
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

CREATE POLICY "Morador autoriza/recusa visitantes da sua unidade" ON public.visitantes
  FOR UPDATE TO authenticated
  USING (is_morador_da_unidade(auth.uid(), unidade_id))
  WITH CHECK (is_morador_da_unidade(auth.uid(), unidade_id));

-- Morador também pode pré-cadastrar visitantes esperados
CREATE POLICY "Morador pré-cadastra visitantes" ON public.visitantes
  FOR INSERT TO authenticated
  WITH CHECK (is_morador_da_unidade(auth.uid(), unidade_id));

-- NOTIFICAÇÕES WHATSAPP
CREATE TABLE public.notificacoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  unidade_id UUID,
  destinatario_user_id UUID,
  destinatario_telefone TEXT NOT NULL,
  destinatario_nome TEXT,
  mensagem TEXT NOT NULL,
  contexto TEXT, -- 'encomenda' | 'visitante' | 'reserva' | 'cobranca'
  contexto_id UUID,
  status wa_status NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ,
  erro TEXT,
  link_wa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_cond ON public.notificacoes_whatsapp(condominio_id);
CREATE INDEX idx_wa_status ON public.notificacoes_whatsapp(status);

ALTER TABLE public.notificacoes_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Síndico/Porteiro veem notificações" ON public.notificacoes_whatsapp
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

CREATE POLICY "Síndico/Porteiro gerenciam notificações" ON public.notificacoes_whatsapp
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

-- ============================================================
-- FUNÇÕES: Encomendas
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_encomenda(
  _unidade_id UUID,
  _descricao TEXT,
  _transportadora TEXT,
  _codigo_rastreio TEXT,
  _remetente TEXT,
  _local_armazenamento TEXT,
  _observacoes TEXT,
  _foto_url TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT condominio_id INTO _cond FROM public.unidades WHERE id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_invalida'; END IF;

  IF NOT (is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.encomendas (
    condominio_id, unidade_id, descricao, transportadora, codigo_rastreio,
    remetente, local_armazenamento, observacoes, foto_url, recebido_por
  ) VALUES (
    _cond, _unidade_id, _descricao, _transportadora, _codigo_rastreio,
    _remetente, _local_armazenamento, _observacoes, _foto_url, _uid
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'encomenda_registrada', 'encomendas', _id);

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_encomenda_retirada(
  _encomenda_id UUID,
  _retirado_por_nome TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _st encomenda_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, status INTO _cond, _st FROM public.encomendas WHERE id = _encomenda_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'encomenda_nao_encontrada'; END IF;
  IF NOT (is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _st <> 'aguardando' THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.encomendas
    SET status = 'retirada',
        retirado_em = now(),
        retirado_por = _uid,
        retirado_por_nome = COALESCE(_retirado_por_nome, retirado_por_nome)
    WHERE id = _encomenda_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'encomenda_retirada', 'encomendas', _encomenda_id);
END;
$$;

-- ============================================================
-- FUNÇÕES: Visitantes
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_visitante(
  _unidade_id UUID,
  _nome TEXT,
  _documento TEXT,
  _tipo visitante_tipo,
  _empresa TEXT,
  _placa_veiculo TEXT,
  _observacoes TEXT,
  _valido_ate TIMESTAMPTZ,
  _foto_url TEXT,
  _pre_autorizar BOOLEAN
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _id UUID;
  _morador BOOLEAN;
  _gestor BOOLEAN;
  _st visitante_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT condominio_id INTO _cond FROM public.unidades WHERE id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_invalida'; END IF;

  _morador := is_morador_da_unidade(_uid, _unidade_id);
  _gestor := is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role);

  IF NOT (_morador OR _gestor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Morador pré-autorizando ou gestor com pré_autorizar = true
  _st := CASE
    WHEN _pre_autorizar AND _morador THEN 'autorizado'::visitante_status
    WHEN _gestor THEN 'aguardando'::visitante_status
    WHEN _morador THEN 'autorizado'::visitante_status
    ELSE 'aguardando'::visitante_status
  END;

  INSERT INTO public.visitantes (
    condominio_id, unidade_id, nome, documento, tipo, empresa, placa_veiculo,
    observacoes, valido_ate, foto_url, registrado_por, status,
    autorizado_por, autorizado_em
  ) VALUES (
    _cond, _unidade_id, _nome, _documento, COALESCE(_tipo,'visita'::visitante_tipo),
    _empresa, _placa_veiculo, _observacoes, _valido_ate, _foto_url, _uid, _st,
    CASE WHEN _st = 'autorizado' THEN _uid ELSE NULL END,
    CASE WHEN _st = 'autorizado' THEN now() ELSE NULL END
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'visitante_registrado', 'visitantes', _id,
          jsonb_build_object('status', _st, 'tipo', _tipo));

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.autorizar_visitante(_visitante_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID; _unid UUID; _st visitante_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, unidade_id, status INTO _cond, _unid, _st FROM public.visitantes WHERE id = _visitante_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'visitante_nao_encontrado'; END IF;
  IF NOT (is_morador_da_unidade(_uid, _unid) OR is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _st <> 'aguardando' THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.visitantes
    SET status = 'autorizado', autorizado_por = _uid, autorizado_em = now()
    WHERE id = _visitante_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'visitante_autorizado', 'visitantes', _visitante_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recusar_visitante(_visitante_id UUID, _motivo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID; _unid UUID; _st visitante_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, unidade_id, status INTO _cond, _unid, _st FROM public.visitantes WHERE id = _visitante_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'visitante_nao_encontrado'; END IF;
  IF NOT (is_morador_da_unidade(_uid, _unid) OR is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _st <> 'aguardando' THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.visitantes
    SET status = 'recusado', motivo_recusa = _motivo, autorizado_por = _uid, autorizado_em = now()
    WHERE id = _visitante_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'visitante_recusado', 'visitantes', _visitante_id, jsonb_build_object('motivo', _motivo));
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_entrada_visitante(_visitante_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID; _st visitante_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, status INTO _cond, _st FROM public.visitantes WHERE id = _visitante_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'visitante_nao_encontrado'; END IF;
  IF NOT (is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _st NOT IN ('autorizado','aguardando') THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.visitantes
    SET status = 'dentro', entrada_em = now(),
        autorizado_por = COALESCE(autorizado_por, _uid),
        autorizado_em = COALESCE(autorizado_em, now())
    WHERE id = _visitante_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'visitante_entrou', 'visitantes', _visitante_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_saida_visitante(_visitante_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID; _st visitante_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, status INTO _cond, _st FROM public.visitantes WHERE id = _visitante_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'visitante_nao_encontrado'; END IF;
  IF NOT (is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _st <> 'dentro' THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.visitantes
    SET status = 'saiu', saida_em = now()
    WHERE id = _visitante_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'visitante_saiu', 'visitantes', _visitante_id);
END;
$$;
