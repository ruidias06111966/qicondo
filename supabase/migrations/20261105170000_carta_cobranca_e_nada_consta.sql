-- Carta de cobrança e certidão de nada consta.
--
-- Dois documentos que o síndico produz a partir da mesma base — a dívida em
-- aberto de uma unidade — e que servem para o oposto um do outro.
--
-- A DÍVIDA, NUM SÍTIO SÓ
--
-- `divida_da_unidade` devolve a dívida em aberto detalhada, com os encargos
-- vindos do motor. Os dois documentos chamam-na, e por isso dizem o mesmo
-- número. Um sistema onde a carta de cobrança e o nada consta discordam é um
-- sistema que não se pode usar para nenhum dos dois.
--
-- Entram as cobranças `pendente`, `vencida` e `parcial`. Ficam de fora as
-- `em_acordo`, porque a dívida delas passou para as parcelas, e essas são
-- cobranças normais que entram — é a mesma regra que impede a dupla contagem
-- na inadimplência.
--
-- O NADA CONSTA FICA REGISTADO
--
-- A carta de cobrança é uma notificação: o que prova que foi feita é o
-- comprovativo de entrega, não a existência do papel. Vai para o `audit_log`
-- e não se guarda.
--
-- A certidão é outra coisa. Quem compra uma fração confia nela, e o
-- art. 1.345 manda que o adquirente responda pelos débitos do alienante — ou
-- seja, uma certidão errada transfere para o síndico um prejuízo que era de
-- outro. Por isso cada emissão fica gravada, com código e com a fotografia do
-- que foi certificado, e com validade limitada: a situação muda no mês
-- seguinte, e uma certidão sem prazo seria usada muito depois de deixar de
-- ser verdade.
--
-- E RECUSA COM ACORDO EM CURSO
--
-- Um acordo activo significa que há dívida; está parcelada, não perdoada.
-- Certificar que nada consta nesse caso engana quem compra. A função recusa e
-- diz qual é o acordo, para o síndico decidir o que fazer com a informação em
-- vez de receber um "não" sem explicação.


CREATE TYPE public.certidao_tipo AS ENUM ('nada_consta');

CREATE TABLE public.certidoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tipo public.certidao_tipo NOT NULL DEFAULT 'nada_consta',
  numero integer NOT NULL,
  codigo text NOT NULL,
  emitida_em timestamptz NOT NULL DEFAULT now(),
  emitida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  valida_ate date NOT NULL,
  -- A fotografia do que foi certificado. Sem isto, uma certidão emitida hoje
  -- não se pode reconstituir amanhã, porque a dívida é calculada e não
  -- guardada.
  dados jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT certidao_codigo_unico UNIQUE (codigo),
  CONSTRAINT certidao_numero_unico UNIQUE (condominio_id, tipo, numero)
);

CREATE INDEX idx_certidoes_condominio ON public.certidoes (condominio_id);
CREATE INDEX idx_certidoes_unidade ON public.certidoes (unidade_id);

ALTER TABLE public.certidoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro vê certidões do condomínio" ON public.certidoes
  FOR SELECT USING (public.pode_gerir_financeiro(auth.uid(), condominio_id));

CREATE POLICY "Morador vê certidões da sua unidade" ON public.certidoes
  FOR SELECT USING (public.is_morador_da_unidade(auth.uid(), unidade_id));

-- Só pela função: uma certidão inserida à mão não passou pela verificação de
-- que não há dívida, que é a única coisa que ela certifica.
REVOKE INSERT, UPDATE, DELETE ON public.certidoes FROM authenticated, anon;
GRANT SELECT ON public.certidoes TO authenticated;

DROP TRIGGER IF EXISTS trg_coerencia ON public.certidoes;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.certidoes
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');


-- ============================================================
-- A DÍVIDA DE UMA UNIDADE
-- ============================================================

CREATE OR REPLACE FUNCTION public.divida_da_unidade(_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _itens jsonb;
  _principal numeric;
  _multa numeric;
  _juros numeric;
  _acordos jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT u.condominio_id INTO _cond FROM public.unidades u WHERE u.id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_nao_encontrada'; END IF;

  -- Quem gere o financeiro, ou o próprio morador da unidade.
  IF NOT (public.pode_gerir_financeiro(_uid, _cond)
          OR public.is_morador_da_unidade(_uid, _unidade_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH devido AS (
    SELECT e.cobranca_id, e.multa, e.juros, e.dias_atraso
      FROM public._encargos_devidos(_cond, NULL, _hoje) e
  ),
  linhas AS (
    SELECT c.id, c.descricao, c.competencia, c.vencimento,
           GREATEST(c.valor - c.desconto - c.valor_pago, 0) AS principal,
           COALESCE(d.multa, 0) AS multa,
           COALESCE(d.juros, 0) AS juros,
           COALESCE(d.dias_atraso, 0) AS dias_atraso,
           c.acordo_id, c.parcela_num
      FROM public.cobrancas c
      LEFT JOIN devido d ON d.cobranca_id = c.id
     WHERE c.unidade_id = _unidade_id
       AND c.status IN ('pendente', 'vencida', 'parcial')
  )
  SELECT COALESCE(sum(l.principal), 0),
         COALESCE(sum(l.multa), 0),
         COALESCE(sum(l.juros), 0),
         COALESCE(jsonb_agg(jsonb_build_object(
           'cobranca_id', l.id, 'descricao', l.descricao,
           'competencia', l.competencia, 'vencimento', l.vencimento,
           'principal', l.principal, 'multa', l.multa, 'juros', l.juros,
           'dias_atraso', l.dias_atraso,
           'de_acordo', l.acordo_id IS NOT NULL, 'parcela_num', l.parcela_num)
           ORDER BY l.vencimento, l.id), '[]'::jsonb)
    INTO _principal, _multa, _juros, _itens
    FROM linhas l;

  -- Acordos activos entram na resposta mesmo sem parcela vencida: para o nada
  -- consta, um acordo em curso é dívida, e quem lê precisa de o saber.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'acordo_id', a.id, 'numero', a.numero, 'data_acordo', a.data_acordo,
           'valor_total', a.valor_total, 'num_parcelas', a.num_parcelas,
           'em_aberto', (SELECT COALESCE(sum(GREATEST(
                           c.valor + c.multa + c.juros - c.desconto - c.valor_pago, 0)), 0)
                           FROM public.cobrancas c
                          WHERE c.acordo_id = a.id
                            AND c.status IN ('pendente', 'vencida', 'parcial')))
           ORDER BY a.numero), '[]'::jsonb)
    INTO _acordos
    FROM public.acordos a
   WHERE a.unidade_id = _unidade_id AND a.status = 'ativo';

  RETURN jsonb_build_object(
    'referencia', _hoje,
    'principal', _principal,
    'multa', _multa,
    'juros', _juros,
    'total', _principal + _multa + _juros,
    'itens', _itens,
    'acordos_ativos', _acordos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.divida_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.divida_da_unidade(uuid) TO authenticated;


-- ============================================================
-- CARTA DE COBRANÇA
-- ============================================================
-- Devolve tudo o que o documento precisa: o cabeçalho do condomínio, a
-- unidade, os proprietários a quem a carta se dirige, a dívida linha a linha
-- e o prazo. Quem monta a folha é o cliente; aqui só se reúne o conteúdo, com
-- os valores vindos do mesmo motor que a inadimplência usa.

CREATE OR REPLACE FUNCTION public.carta_cobranca(
  _unidade_id uuid,
  _prazo_dias integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _divida jsonb;
  _c record;
  _u record;
  _donos jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _prazo_dias IS NULL OR _prazo_dias < 1 OR _prazo_dias > 90 THEN
    RAISE EXCEPTION 'prazo_invalido' USING HINT = 'Entre 1 e 90 dias.';
  END IF;

  SELECT u.condominio_id INTO _cond FROM public.unidades u WHERE u.id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_nao_encontrada'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  _divida := public.divida_da_unidade(_unidade_id);

  IF (_divida->>'total')::numeric <= 0 THEN
    RAISE EXCEPTION 'sem_divida'
      USING HINT = 'Esta unidade não tem valores em aberto. Não há o que cobrar.';
  END IF;

  SELECT c.nome, c.cnpj, c.endereco, c.cidade, c.estado, c.cep
    INTO _c FROM public.condominios c WHERE c.id = _cond;

  SELECT u.bloco, u.numero INTO _u FROM public.unidades u WHERE u.id = _unidade_id;

  SELECT COALESCE(jsonb_agg(p.nome_completo ORDER BY m.created_at), '[]'::jsonb)
    INTO _donos
    FROM public.unidade_moradores m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.unidade_id = _unidade_id AND m.vinculo = 'proprietario';

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'carta_cobranca_gerada', 'unidades', _unidade_id,
          jsonb_build_object('total', (_divida->>'total')::numeric, 'prazo_dias', _prazo_dias));

  RETURN jsonb_build_object(
    'emitida_em', _hoje,
    'prazo_dias', _prazo_dias,
    'vence_em', _hoje + _prazo_dias,
    'condominio', jsonb_build_object(
      'nome', _c.nome, 'cnpj', _c.cnpj, 'endereco', _c.endereco,
      'cidade', _c.cidade, 'estado', _c.estado, 'cep', _c.cep),
    'unidade', jsonb_build_object('bloco', _u.bloco, 'numero', _u.numero),
    'proprietarios', _donos,
    'divida', _divida
  );
END;
$$;

REVOKE ALL ON FUNCTION public.carta_cobranca(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carta_cobranca(uuid, integer) TO authenticated;


-- ============================================================
-- NADA CONSTA
-- ============================================================

CREATE OR REPLACE FUNCTION public.emitir_nada_consta(
  _unidade_id uuid,
  _validade_dias integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _divida jsonb;
  _acordos jsonb;
  _numero int;
  _codigo text;
  _id uuid;
  _c record;
  _u record;
  _donos jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _validade_dias IS NULL OR _validade_dias < 1 OR _validade_dias > 180 THEN
    RAISE EXCEPTION 'validade_invalida' USING HINT = 'Entre 1 e 180 dias.';
  END IF;

  SELECT u.condominio_id INTO _cond FROM public.unidades u WHERE u.id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_nao_encontrada'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  _divida := public.divida_da_unidade(_unidade_id);
  _acordos := _divida->'acordos_ativos';

  -- A única coisa que a certidão afirma é que não há dívida. Se há, recusa.
  IF (_divida->>'total')::numeric > 0 THEN
    RAISE EXCEPTION 'unidade_com_debito'
      USING HINT = format(
        'A unidade tem %s em aberto. Emita a certidão depois da liquidação.',
        to_char((_divida->>'total')::numeric, 'FM999G999G990D00'));
  END IF;

  -- Acordo em curso é dívida, só parcelada. Ver o cabeçalho.
  IF jsonb_array_length(_acordos) > 0 THEN
    RAISE EXCEPTION 'unidade_com_acordo'
      USING HINT = format(
        'A unidade tem o acordo %s em cumprimento, com %s em aberto. Um acordo activo é dívida parcelada, e o art. 1.345 transfere-a a quem adquire a fração.',
        (_acordos->0->>'numero'),
        to_char((_acordos->0->>'em_aberto')::numeric, 'FM999G999G990D00'));
  END IF;

  SELECT COALESCE(max(x.numero), 0) + 1 INTO _numero
    FROM public.certidoes x WHERE x.condominio_id = _cond AND x.tipo = 'nada_consta';

  -- Sequencial para ordenar e localizar, sufixo aleatório para não se
  -- adivinhar o código de uma certidão que não se tem.
  _codigo := format('NC-%s-%s-%s',
                    to_char(_hoje, 'YYYY'),
                    lpad(_numero::text, 4, '0'),
                    upper(encode(extensions.gen_random_bytes(4), 'hex')));

  SELECT c.nome, c.cnpj, c.endereco, c.cidade, c.estado, c.cep
    INTO _c FROM public.condominios c WHERE c.id = _cond;

  SELECT u.bloco, u.numero INTO _u FROM public.unidades u WHERE u.id = _unidade_id;

  SELECT COALESCE(jsonb_agg(p.nome_completo ORDER BY m.created_at), '[]'::jsonb)
    INTO _donos
    FROM public.unidade_moradores m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.unidade_id = _unidade_id AND m.vinculo = 'proprietario';

  INSERT INTO public.certidoes (
    condominio_id, unidade_id, tipo, numero, codigo, emitida_por, valida_ate, dados
  ) VALUES (
    _cond, _unidade_id, 'nada_consta', _numero, _codigo, _uid, _hoje + _validade_dias,
    jsonb_build_object(
      'emitida_em', _hoje,
      'valida_ate', _hoje + _validade_dias,
      'condominio', jsonb_build_object(
        'nome', _c.nome, 'cnpj', _c.cnpj, 'endereco', _c.endereco,
        'cidade', _c.cidade, 'estado', _c.estado, 'cep', _c.cep),
      'unidade', jsonb_build_object('bloco', _u.bloco, 'numero', _u.numero),
      'proprietarios', _donos,
      'referencia', _divida->>'referencia')
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'nada_consta_emitido', 'certidoes', _id,
          jsonb_build_object('codigo', _codigo, 'unidade_id', _unidade_id));

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_nada_consta(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_nada_consta(uuid, integer) TO authenticated;


-- Conferir uma certidão pelo código.
--
-- Fica em `authenticated` e não em `anon`, de propósito. Quem precisa de
-- conferir é tipicamente quem compra a fração, que não tem conta — e abrir
-- isto ao anónimo daria a qualquer um, com um código, o nome do proprietário
-- e o endereço do condomínio. Uma página pública de conferência resolve-se
-- melhor com um ponto de acesso próprio, que devolva só "válida / inválida /
-- expirada" sem os dados pessoais. Fica como trabalho à parte, e não aberto
-- por descuido.

CREATE OR REPLACE FUNCTION public.conferir_certidao(_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r public.certidoes%ROWTYPE;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _r FROM public.certidoes WHERE codigo = upper(trim(_codigo));
  IF _r.id IS NULL THEN
    RETURN jsonb_build_object('valida', false, 'motivo', 'codigo_nao_encontrado');
  END IF;

  IF NOT (public.pode_gerir_financeiro(auth.uid(), _r.condominio_id)
          OR public.is_morador_da_unidade(auth.uid(), _r.unidade_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN jsonb_build_object(
    'valida', _r.valida_ate >= _hoje,
    'motivo', CASE WHEN _r.valida_ate < _hoje THEN 'expirada' ELSE NULL END,
    'codigo', _r.codigo,
    'numero', _r.numero,
    'emitida_em', _r.emitida_em,
    'valida_ate', _r.valida_ate,
    'dados', _r.dados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.conferir_certidao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_certidao(text) TO authenticated;
