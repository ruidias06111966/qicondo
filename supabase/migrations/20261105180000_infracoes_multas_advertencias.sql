-- Advertências e multas por infração.
--
-- O QUE A LEI DIZ, E POR QUE ISSO VIRA CÓDIGO
--
-- A multa por infração não é a multa de mora. A de mora está no art. 1.336,
-- §1º e tem tecto de 2% — é a que o motor de inadimplência aplica sozinho. A
-- de infração é outra coisa: pune o descumprimento de um dever que não o de
-- pagar, e os seus tectos são muito maiores e dependem do fundamento.
--
--   Convenção prevê        o valor que a convenção fixar; o síndico aplica
--   Art. 1.336, §2º        até 5x a contribuição mensal, por deliberação de
--                          dois terços dos condóminos restantes quando a
--                          convenção for omissa
--   Art. 1.337, caput      até 5x, por três quartos dos restantes, para quem
--                          descumpre reiteradamente os seus deveres
--   Art. 1.337, § único    até 10x, para o comportamento antissocial
--                          reiterado que gere incompatibilidade de convivência
--
-- Estes tectos entram como verificação e não como comentário. Uma multa acima
-- do limite legal é anulável, e quem a aplicou responde — o sistema recusa
-- antes de a gravar, dizendo qual é o limite e como foi calculado.
--
-- A REFERÊNCIA DO TECTO
--
-- "A contribuição mensal" é a `taxa_mensal` da unidade. Sem ela não há tecto
-- que se possa verificar, e por isso a função recusa em vez de aplicar uma
-- multa que ninguém sabe se é legal. É chato preencher; é mais chato
-- descobrir em juízo que a multa não valia.
--
-- O valor usado fica congelado em `referencia_mensal`: a taxa muda com o
-- orçamento do ano seguinte, e a legalidade da multa afere-se pela taxa do
-- momento em que foi aplicada.
--
-- A DELIBERAÇÃO
--
-- Fora o caso da convenção, todas as bases exigem assembleia. O registo tem
-- de dizer qual — por ligação à assembleia que a aprovou, ou, quando ela é
-- anterior ao sistema, por texto livre. Uma multa sem deliberação registada é
-- uma multa indefensável, e por isso a tabela não a aceita.
--
-- A MULTA VIRA COBRANÇA
--
-- Como as parcelas de acordo: a multa aplicada gera uma cobrança normal, e
-- com isso entra na inadimplência, aceita pagamento parcial e aparece no
-- balancete quando é recebida. Se não for paga, acumula mora como qualquer
-- outra — e aí sim os 2% do art. 1.336, §1º, que é a outra multa.
--
-- A ADVERTÊNCIA NÃO É MULTA
--
-- Não tem valor e não gera cobrança. Está aqui porque a maioria das
-- convenções a exige como passo anterior, e porque é ela que constrói a
-- reiteração em que o art. 1.337 se apoia. `reincidencia_da_unidade` conta-a.


CREATE TYPE public.infracao_tipo AS ENUM ('advertencia', 'multa');

CREATE TYPE public.infracao_base AS ENUM (
  'convencao',        -- valor fixado na convenção; o síndico aplica
  'art_1336_p2',      -- até 5x, 2/3 dos restantes, convenção omissa
  'art_1337_caput',   -- até 5x, 3/4 dos restantes, descumprimento reiterado
  'art_1337_unico'    -- até 10x, comportamento antissocial reiterado
);

CREATE TYPE public.infracao_status AS ENUM ('vigente', 'cancelada');

CREATE TABLE public.infracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  numero integer NOT NULL,

  tipo public.infracao_tipo NOT NULL,
  data_ocorrencia date NOT NULL,
  descricao text NOT NULL,
  local text,

  -- Só para multa.
  base_legal public.infracao_base,
  valor numeric(14,2),
  referencia_mensal numeric(14,2),
  deliberacao text,
  assembleia_id uuid REFERENCES public.assembleias(id) ON DELETE SET NULL,
  cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE SET NULL,

  status public.infracao_status NOT NULL DEFAULT 'vigente',
  cancelada_em timestamptz,
  cancelamento_motivo text,

  registrada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT infracao_numero_unico UNIQUE (condominio_id, numero),
  CONSTRAINT infracao_descricao_nao_vazia CHECK (length(trim(descricao)) >= 10),

  -- A advertência não tem dinheiro nem fundamento de multa.
  CONSTRAINT advertencia_sem_valor CHECK (
    tipo <> 'advertencia'
    OR (valor IS NULL AND base_legal IS NULL AND cobranca_id IS NULL)
  ),

  -- A multa tem valor positivo e fundamento.
  CONSTRAINT multa_com_valor_e_base CHECK (
    tipo <> 'multa' OR (valor IS NOT NULL AND valor > 0 AND base_legal IS NOT NULL)
  ),

  -- Fora a convenção, toda a base exige deliberação registada.
  CONSTRAINT multa_deliberada CHECK (
    tipo <> 'multa'
    OR base_legal = 'convencao'
    OR assembleia_id IS NOT NULL
    OR (deliberacao IS NOT NULL AND length(trim(deliberacao)) > 0)
  )
);

COMMENT ON TABLE public.infracoes IS
  'Advertências e multas por descumprimento de dever que não o de pagar. A multa de mora é outra coisa, e vive no motor de inadimplência.';

COMMENT ON COLUMN public.infracoes.referencia_mensal IS
  'A taxa mensal da unidade à data da aplicação, congelada. O tecto legal afere-se por ela, e ela muda com o orçamento.';

CREATE INDEX idx_infracoes_condominio ON public.infracoes (condominio_id);
CREATE INDEX idx_infracoes_unidade ON public.infracoes (unidade_id);
CREATE INDEX idx_infracoes_cobranca ON public.infracoes (cobranca_id);
CREATE INDEX idx_infracoes_assembleia ON public.infracoes (assembleia_id);

ALTER TABLE public.infracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Síndico vê infrações do condomínio" ON public.infracoes
  FOR SELECT USING (public.is_sindico(auth.uid(), condominio_id));

CREATE POLICY "Morador vê infrações da sua unidade" ON public.infracoes
  FOR SELECT USING (public.is_morador_da_unidade(auth.uid(), unidade_id));

-- Só pelas funções: uma multa inserida à mão não passou pela verificação do
-- tecto legal, que é a única coisa que a torna defensável.
REVOKE INSERT, UPDATE, DELETE ON public.infracoes FROM authenticated, anon;
GRANT SELECT ON public.infracoes TO authenticated;

CREATE TRIGGER touch_infracoes BEFORE UPDATE ON public.infracoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_coerencia ON public.infracoes;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.infracoes
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'unidade_id', 'unidades', 'cobranca_id', 'cobrancas', 'assembleia_id', 'assembleias');


-- ============================================================
-- REINCIDÊNCIA
-- ============================================================
-- O art. 1.337 apoia-se em "reiteradamente". Quem vai propor uma multa com
-- esse fundamento precisa de mostrar o histórico, e quem a recebe precisa de
-- o poder contestar. Conta só as vigentes: uma infração cancelada não
-- constrói reiteração nenhuma.

CREATE OR REPLACE FUNCTION public.reincidencia_da_unidade(_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT u.condominio_id INTO _cond FROM public.unidades u WHERE u.id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_nao_encontrada'; END IF;

  IF NOT (public.is_sindico(_uid, _cond)
          OR public.is_morador_da_unidade(_uid, _unidade_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'advertencias', count(*) FILTER (WHERE i.tipo = 'advertencia'),
      'multas', count(*) FILTER (WHERE i.tipo = 'multa'),
      'total', count(*),
      'primeira', min(i.data_ocorrencia),
      'ultima', max(i.data_ocorrencia),
      'valor_multas', COALESCE(sum(i.valor) FILTER (WHERE i.tipo = 'multa'), 0)
    )
    FROM public.infracoes i
   WHERE i.unidade_id = _unidade_id AND i.status = 'vigente'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reincidencia_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reincidencia_da_unidade(uuid) TO authenticated;


-- ============================================================
-- ADVERTÊNCIA
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_advertencia(
  _condominio_id uuid,
  _unidade_id uuid,
  _data_ocorrencia date,
  _descricao text,
  _local text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _numero int;
  _id uuid;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_sindico(_uid, _condominio_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _data_ocorrencia IS NULL OR _data_ocorrencia > _hoje THEN
    RAISE EXCEPTION 'data_invalida' USING HINT = 'A ocorrência não pode ser no futuro.';
  END IF;

  SELECT COALESCE(max(i.numero), 0) + 1 INTO _numero
    FROM public.infracoes i WHERE i.condominio_id = _condominio_id;

  INSERT INTO public.infracoes (
    condominio_id, unidade_id, numero, tipo, data_ocorrencia, descricao, local, registrada_por
  ) VALUES (
    _condominio_id, _unidade_id, _numero, 'advertencia', _data_ocorrencia,
    trim(_descricao), NULLIF(trim(COALESCE(_local, '')), ''), _uid
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, _uid, 'advertencia_registrada', 'infracoes', _id,
          jsonb_build_object('numero', _numero, 'unidade_id', _unidade_id));

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_advertencia(uuid, uuid, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_advertencia(uuid, uuid, date, text, text)
  TO authenticated;


-- ============================================================
-- MULTA
-- ============================================================

CREATE OR REPLACE FUNCTION public.aplicar_multa(
  _condominio_id uuid,
  _unidade_id uuid,
  _data_ocorrencia date,
  _descricao text,
  _base_legal public.infracao_base,
  _valor numeric,
  _vencimento date,
  _local text DEFAULT NULL,
  _categoria_id uuid DEFAULT NULL,
  _deliberacao text DEFAULT NULL,
  _assembleia_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _taxa numeric;
  _mult int;
  _tecto numeric;
  _numero int;
  _cob uuid;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_sindico(_uid, _condominio_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _data_ocorrencia IS NULL OR _data_ocorrencia > _hoje THEN
    RAISE EXCEPTION 'data_invalida' USING HINT = 'A ocorrência não pode ser no futuro.';
  END IF;

  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;

  IF _vencimento IS NULL OR _vencimento < _hoje THEN
    RAISE EXCEPTION 'vencimento_invalido'
      USING HINT = 'O vencimento não pode ser anterior a hoje.';
  END IF;

  SELECT u.taxa_mensal INTO _taxa
    FROM public.unidades u WHERE u.id = _unidade_id AND u.condominio_id = _condominio_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unidade_de_outro_condominio'; END IF;

  -- O tecto legal, conforme o fundamento. Ver o cabeçalho da migração.
  _mult := CASE _base_legal
             WHEN 'art_1337_unico' THEN 10
             WHEN 'art_1337_caput' THEN 5
             WHEN 'art_1336_p2'    THEN 5
             ELSE NULL                      -- convenção: o tecto é o que ela fixar
           END;

  IF _mult IS NOT NULL THEN
    IF _taxa IS NULL OR _taxa <= 0 THEN
      RAISE EXCEPTION 'taxa_mensal_em_falta'
        USING HINT = 'O tecto da multa é um múltiplo da contribuição mensal, e a unidade não a tem preenchida. Sem ela não há como verificar se a multa é legal.';
    END IF;

    _tecto := round(_taxa * _mult, 2);

    IF _valor > _tecto THEN
      RAISE EXCEPTION 'multa_acima_do_tecto'
        USING HINT = format(
          'O limite é %s (%sx a contribuição mensal de %s). Uma multa acima do tecto legal é anulável.',
          to_char(_tecto, 'FM999G999G990D00'), _mult,
          to_char(_taxa, 'FM999G999G990D00'));
    END IF;
  END IF;

  SELECT COALESCE(max(i.numero), 0) + 1 INTO _numero
    FROM public.infracoes i WHERE i.condominio_id = _condominio_id;

  -- A multa vira cobrança, e com isso herda inadimplência, pagamento parcial
  -- e balancete, como as parcelas de acordo.
  INSERT INTO public.cobrancas (
    condominio_id, unidade_id, categoria_id, competencia, vencimento,
    valor, descricao, criado_por
  ) VALUES (
    _condominio_id, _unidade_id, _categoria_id,
    date_trunc('month', _vencimento)::date, _vencimento, _valor,
    format('Multa %s — infração de %s', _numero, to_char(_data_ocorrencia, 'DD/MM/YYYY')),
    _uid
  ) RETURNING id INTO _cob;

  INSERT INTO public.infracoes (
    condominio_id, unidade_id, numero, tipo, data_ocorrencia, descricao, local,
    base_legal, valor, referencia_mensal, deliberacao, assembleia_id, cobranca_id,
    registrada_por
  ) VALUES (
    _condominio_id, _unidade_id, _numero, 'multa', _data_ocorrencia,
    trim(_descricao), NULLIF(trim(COALESCE(_local, '')), ''),
    _base_legal, _valor, _taxa,
    NULLIF(trim(COALESCE(_deliberacao, '')), ''), _assembleia_id, _cob, _uid
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, _uid, 'multa_aplicada', 'infracoes', _id,
          jsonb_build_object('numero', _numero, 'unidade_id', _unidade_id,
                             'valor', _valor, 'base_legal', _base_legal,
                             'tecto', _tecto, 'referencia_mensal', _taxa));

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_multa(uuid, uuid, date, text, public.infracao_base, numeric, date, text, uuid, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_multa(uuid, uuid, date, text, public.infracao_base, numeric, date, text, uuid, text, uuid)
  TO authenticated;


-- ============================================================
-- CANCELAR
-- ============================================================
-- O condómino contesta e a assembleia dá-lhe razão, ou o síndico errou. A
-- infração não se apaga: fica cancelada, com motivo. Apagá-la esconderia que
-- foi aplicada, e é precisamente isso que o condómino quer poder provar.
--
-- Cancelar uma multa cancela a cobrança que ela gerou — mas só se ainda não
-- tiver recebido pagamento. Com pagamento feito há devolução a tratar, e isso
-- é decisão de quem gere, não automatismo.

CREATE OR REPLACE FUNCTION public.cancelar_infracao(
  _infracao_id uuid,
  _motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _i public.infracoes%ROWTYPE;
  _pago numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _i FROM public.infracoes WHERE id = _infracao_id;
  IF _i.id IS NULL THEN RAISE EXCEPTION 'infracao_nao_encontrada'; END IF;

  IF NOT public.is_sindico(_uid, _i.condominio_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _i.status <> 'vigente' THEN RAISE EXCEPTION 'infracao_ja_cancelada'; END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'motivo_obrigatorio'
      USING HINT = 'Diga por que a infração foi cancelada. É o que o condómino vai ler.';
  END IF;

  IF _i.cobranca_id IS NOT NULL THEN
    SELECT c.valor_pago INTO _pago FROM public.cobrancas c WHERE c.id = _i.cobranca_id;

    IF COALESCE(_pago, 0) > 0 THEN
      RAISE EXCEPTION 'multa_ja_paga'
        USING HINT = format(
          'A cobrança desta multa já recebeu %s. Trate a devolução e depois cancele a cobrança à mão — não é automatismo.',
          to_char(_pago, 'FM999G999G990D00'));
    END IF;

    UPDATE public.cobrancas SET status = 'cancelada'
     WHERE id = _i.cobranca_id AND status IN ('pendente', 'vencida', 'parcial');
  END IF;

  UPDATE public.infracoes
     SET status = 'cancelada', cancelada_em = now(), cancelamento_motivo = trim(_motivo)
   WHERE id = _infracao_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_i.condominio_id, _uid, 'infracao_cancelada', 'infracoes', _infracao_id,
          jsonb_build_object('numero', _i.numero, 'tipo', _i.tipo, 'motivo', _motivo));
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_infracao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_infracao(uuid, text) TO authenticated;
