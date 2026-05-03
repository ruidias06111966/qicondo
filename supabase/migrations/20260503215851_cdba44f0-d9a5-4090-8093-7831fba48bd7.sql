
-- ENUMs
CREATE TYPE public.reserva_status AS ENUM ('pendente', 'confirmada', 'recusada', 'cancelada', 'concluida');

-- AREAS COMUNS
CREATE TABLE public.areas_comuns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  capacidade INT,
  taxa_uso NUMERIC(10,2) NOT NULL DEFAULT 0,
  requer_aprovacao BOOLEAN NOT NULL DEFAULT true,
  antecedencia_min_horas INT NOT NULL DEFAULT 24,
  antecedencia_max_dias INT NOT NULL DEFAULT 90,
  duracao_min_minutos INT NOT NULL DEFAULT 60,
  duracao_max_minutos INT NOT NULL DEFAULT 480,
  hora_abertura TIME NOT NULL DEFAULT '08:00',
  hora_fechamento TIME NOT NULL DEFAULT '22:00',
  dias_permitidos INT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=domingo
  max_reservas_por_unidade_mes INT NOT NULL DEFAULT 4,
  intervalo_entre_reservas_min INT NOT NULL DEFAULT 0,
  cor TEXT NOT NULL DEFAULT '#10B981',
  foto_url TEXT,
  regulamento TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_areas_cond ON public.areas_comuns(condominio_id);
CREATE TRIGGER areas_comuns_touch BEFORE UPDATE ON public.areas_comuns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.areas_comuns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem áreas" ON public.areas_comuns
  FOR SELECT TO authenticated USING (is_member_of(auth.uid(), condominio_id));

CREATE POLICY "Síndico/Porteiro gerenciam áreas" ON public.areas_comuns
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

-- BLOQUEIOS
CREATE TABLE public.area_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  area_id UUID NOT NULL REFERENCES public.areas_comuns(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  motivo TEXT NOT NULL,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bloqueio_periodo_valido CHECK (fim > inicio)
);
CREATE INDEX idx_bloqueios_area_periodo ON public.area_bloqueios(area_id, inicio, fim);

ALTER TABLE public.area_bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem bloqueios" ON public.area_bloqueios
  FOR SELECT TO authenticated USING (is_member_of(auth.uid(), condominio_id));

CREATE POLICY "Síndico/Porteiro gerenciam bloqueios" ON public.area_bloqueios
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

-- RESERVAS
CREATE TABLE public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  area_id UUID NOT NULL REFERENCES public.areas_comuns(id) ON DELETE RESTRICT,
  unidade_id UUID NOT NULL,
  solicitante_id UUID NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  num_convidados INT NOT NULL DEFAULT 0,
  observacoes TEXT,
  status reserva_status NOT NULL DEFAULT 'pendente',
  motivo_recusa TEXT,
  taxa NUMERIC(10,2) NOT NULL DEFAULT 0,
  cobranca_id UUID,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancelado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reserva_periodo_valido CHECK (fim > inicio)
);

CREATE INDEX idx_reservas_area_periodo ON public.reservas(area_id, inicio, fim) WHERE status IN ('pendente','confirmada');
CREATE INDEX idx_reservas_unidade ON public.reservas(unidade_id);
CREATE INDEX idx_reservas_solicitante ON public.reservas(solicitante_id);
CREATE INDEX idx_reservas_cond ON public.reservas(condominio_id);

CREATE TRIGGER reservas_touch BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solicitante vê suas reservas" ON public.reservas
  FOR SELECT TO authenticated USING (solicitante_id = auth.uid());

CREATE POLICY "Morador da unidade vê reservas da unidade" ON public.reservas
  FOR SELECT TO authenticated USING (is_morador_da_unidade(auth.uid(), unidade_id));

CREATE POLICY "Síndico/Porteiro veem todas reservas" ON public.reservas
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

CREATE POLICY "Síndico/Porteiro gerenciam reservas" ON public.reservas
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

-- Solicitar reserva (morador ou síndico)
CREATE OR REPLACE FUNCTION public.solicitar_reserva(
  _area_id UUID,
  _unidade_id UUID,
  _inicio TIMESTAMPTZ,
  _fim TIMESTAMPTZ,
  _num_convidados INT,
  _observacoes TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _area RECORD;
  _cond UUID;
  _dow INT;
  _dur_min INT;
  _hora_ini TIME;
  _hora_fim TIME;
  _conflito INT;
  _bloqueado INT;
  _reservas_mes INT;
  _status reserva_status;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _area FROM public.areas_comuns WHERE id = _area_id;
  IF _area IS NULL OR NOT _area.ativo THEN RAISE EXCEPTION 'area_indisponivel'; END IF;
  _cond := _area.condominio_id;

  -- Valida vínculo: morador da unidade OU síndico/porteiro do condomínio
  IF NOT (
    is_morador_da_unidade(_uid, _unidade_id)
    OR is_sindico(_uid, _cond)
    OR has_role(_uid, _cond, 'porteiro'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Confere se a unidade pertence ao condomínio da área
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = _unidade_id AND condominio_id = _cond) THEN
    RAISE EXCEPTION 'unidade_invalida';
  END IF;

  IF _fim <= _inicio THEN RAISE EXCEPTION 'periodo_invalido'; END IF;

  -- Antecedência mínima/máxima
  IF _inicio < now() + (_area.antecedencia_min_horas || ' hours')::interval THEN
    RAISE EXCEPTION 'antecedencia_minima_nao_atendida';
  END IF;
  IF _inicio > now() + (_area.antecedencia_max_dias || ' days')::interval THEN
    RAISE EXCEPTION 'antecedencia_maxima_excedida';
  END IF;

  _dur_min := EXTRACT(EPOCH FROM (_fim - _inicio))/60;
  IF _dur_min < _area.duracao_min_minutos THEN RAISE EXCEPTION 'duracao_abaixo_minimo'; END IF;
  IF _dur_min > _area.duracao_max_minutos THEN RAISE EXCEPTION 'duracao_acima_maximo'; END IF;

  -- Dia da semana permitido
  _dow := EXTRACT(DOW FROM _inicio AT TIME ZONE 'America/Sao_Paulo')::INT;
  IF NOT (_dow = ANY(_area.dias_permitidos)) THEN
    RAISE EXCEPTION 'dia_nao_permitido';
  END IF;

  -- Horário de funcionamento
  _hora_ini := (_inicio AT TIME ZONE 'America/Sao_Paulo')::TIME;
  _hora_fim := (_fim AT TIME ZONE 'America/Sao_Paulo')::TIME;
  IF _hora_ini < _area.hora_abertura OR _hora_fim > _area.hora_fechamento THEN
    RAISE EXCEPTION 'fora_horario_funcionamento';
  END IF;

  -- Capacidade de convidados
  IF _area.capacidade IS NOT NULL AND _num_convidados > _area.capacidade THEN
    RAISE EXCEPTION 'capacidade_excedida';
  END IF;

  -- Conflito com outras reservas (pendente/confirmada)
  SELECT COUNT(*) INTO _conflito
  FROM public.reservas r
  WHERE r.area_id = _area_id
    AND r.status IN ('pendente','confirmada')
    AND tstzrange(r.inicio, r.fim, '[)') && tstzrange(_inicio, _fim, '[)');
  IF _conflito > 0 THEN RAISE EXCEPTION 'horario_indisponivel'; END IF;

  -- Conflito com bloqueios
  SELECT COUNT(*) INTO _bloqueado
  FROM public.area_bloqueios b
  WHERE b.area_id = _area_id
    AND tstzrange(b.inicio, b.fim, '[)') && tstzrange(_inicio, _fim, '[)');
  IF _bloqueado > 0 THEN RAISE EXCEPTION 'periodo_bloqueado'; END IF;

  -- Limite mensal por unidade
  SELECT COUNT(*) INTO _reservas_mes
  FROM public.reservas r
  WHERE r.unidade_id = _unidade_id
    AND r.area_id = _area_id
    AND r.status IN ('pendente','confirmada','concluida')
    AND date_trunc('month', r.inicio) = date_trunc('month', _inicio);
  IF _reservas_mes >= _area.max_reservas_por_unidade_mes THEN
    RAISE EXCEPTION 'limite_mensal_atingido';
  END IF;

  _status := CASE WHEN _area.requer_aprovacao THEN 'pendente'::reserva_status ELSE 'confirmada'::reserva_status END;

  INSERT INTO public.reservas (
    condominio_id, area_id, unidade_id, solicitante_id, inicio, fim,
    num_convidados, observacoes, status, taxa
  ) VALUES (
    _cond, _area_id, _unidade_id, _uid, _inicio, _fim,
    COALESCE(_num_convidados,0), _observacoes, _status, _area.taxa_uso
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'reserva_solicitada', 'reservas', _id,
    jsonb_build_object('area_id', _area_id, 'status', _status));

  RETURN _id;
END;
$$;

-- Aprovar
CREATE OR REPLACE FUNCTION public.aprovar_reserva(_reserva_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _st reserva_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, status INTO _cond, _st FROM public.reservas WHERE id = _reserva_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'reserva_nao_encontrada'; END IF;
  IF NOT (is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _st <> 'pendente' THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.reservas
    SET status = 'confirmada', aprovado_por = _uid, aprovado_em = now()
    WHERE id = _reserva_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'reserva_aprovada', 'reservas', _reserva_id);
END;
$$;

-- Recusar
CREATE OR REPLACE FUNCTION public.recusar_reserva(_reserva_id UUID, _motivo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _st reserva_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, status INTO _cond, _st FROM public.reservas WHERE id = _reserva_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'reserva_nao_encontrada'; END IF;
  IF NOT (is_sindico(_uid, _cond) OR has_role(_uid, _cond, 'porteiro'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _st <> 'pendente' THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.reservas
    SET status = 'recusada', motivo_recusa = _motivo, aprovado_por = _uid, aprovado_em = now()
    WHERE id = _reserva_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'reserva_recusada', 'reservas', _reserva_id, jsonb_build_object('motivo', _motivo));
END;
$$;

-- Cancelar (morador ou síndico)
CREATE OR REPLACE FUNCTION public.cancelar_reserva(_reserva_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _solic UUID;
  _st reserva_status;
  _ini TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT condominio_id, solicitante_id, status, inicio INTO _cond, _solic, _st, _ini
    FROM public.reservas WHERE id = _reserva_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'reserva_nao_encontrada'; END IF;

  IF NOT (
    _solic = _uid
    OR is_sindico(_uid, _cond)
    OR has_role(_uid, _cond, 'porteiro'::app_role)
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _st NOT IN ('pendente','confirmada') THEN RAISE EXCEPTION 'status_invalido'; END IF;

  UPDATE public.reservas
    SET status = 'cancelada', cancelado_em = now(), cancelado_por = _uid
    WHERE id = _reserva_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'reserva_cancelada', 'reservas', _reserva_id);
END;
$$;
