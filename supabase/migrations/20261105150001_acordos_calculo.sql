-- O cálculo do acordo, num sítio só.
--
-- `simular_acordo` e `criar_acordo` chamam esta função. Se o cálculo vivesse
-- nas duas, a simulação que o condómino assina e o acordo que fica gravado
-- podiam divergir — e é precisamente a simulação que ele viu que o vincula.
--
-- Não escreve nada, e valida tudo o que a criação valida, para que a
-- simulação recuse exactamente o que a criação recusaria. Uma simulação que
-- aceita e uma criação que rejeita é pior do que não haver simulação.
--
-- A REPARTIÇÃO AO CÊNTIMO
--
-- Dividir 3118,95 por sete dá 445,564…, que arredondado a dois decimais e
-- multiplicado por sete dá 3118,98 — três cêntimos a mais do que a dívida.
-- Por isso a conta é feita em cêntimos inteiros, e o resto da divisão é
-- distribuído pelas primeiras parcelas. A soma bate sempre exactamente.

CREATE OR REPLACE FUNCTION public._acordo_calcular(
  _condominio_id uuid,
  _unidade_id uuid,
  _cobranca_ids uuid[],
  _desconto numeric,
  _entrada numeric,
  _num_parcelas integer,
  _primeiro_vencimento date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _n int;
  _principal numeric := 0;
  _multa numeric := 0;
  _juros numeric := 0;
  _desc numeric := COALESCE(_desconto, 0);
  _ent numeric := COALESCE(_entrada, 0);
  _total numeric;
  _a_parcelar numeric;
  _centavos bigint;
  _base bigint;
  _resto int;
  _itens jsonb;
  _parcelas jsonb := '[]'::jsonb;
  _i int;
  _v numeric;
BEGIN
  IF _cobranca_ids IS NULL OR array_length(_cobranca_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'sem_cobrancas'
      USING HINT = 'Escolha pelo menos uma cobrança em atraso para consolidar.';
  END IF;

  IF _num_parcelas IS NULL OR _num_parcelas < 1 OR _num_parcelas > 60 THEN
    RAISE EXCEPTION 'num_parcelas_invalido' USING HINT = 'Entre 1 e 60 parcelas.';
  END IF;

  IF _primeiro_vencimento IS NULL OR _primeiro_vencimento < _hoje THEN
    RAISE EXCEPTION 'vencimento_invalido'
      USING HINT = 'O primeiro vencimento não pode ser anterior a hoje.';
  END IF;

  IF _desc < 0 OR _ent < 0 THEN
    RAISE EXCEPTION 'valor_negativo';
  END IF;

  -- Todas as cobranças têm de ser desta unidade e estar em aberto. Uma que já
  -- esteja `em_acordo` não passa aqui, o que impede consolidá-la duas vezes.
  SELECT count(*) INTO _n
    FROM public.cobrancas c
   WHERE c.id = ANY(_cobranca_ids)
     AND c.condominio_id = _condominio_id
     AND c.unidade_id = _unidade_id
     AND c.status IN ('pendente', 'vencida', 'parcial');

  IF _n <> array_length(_cobranca_ids, 1) THEN
    RAISE EXCEPTION 'cobranca_invalida'
      USING HINT = 'Alguma cobrança não é desta unidade, já está paga, cancelada ou já entrou noutro acordo.';
  END IF;

  WITH devido AS (
    SELECT e.cobranca_id, e.multa, e.juros
      FROM public._encargos_devidos(_condominio_id, NULL, _hoje) e
  ),
  linhas AS (
    SELECT c.id,
           c.descricao,
           c.vencimento,
           GREATEST(c.valor - c.desconto - c.valor_pago, 0) AS principal,
           COALESCE(d.multa, 0) AS multa,
           COALESCE(d.juros, 0) AS juros
      FROM public.cobrancas c
      LEFT JOIN devido d ON d.cobranca_id = c.id
     WHERE c.id = ANY(_cobranca_ids)
  )
  SELECT COALESCE(sum(l.principal), 0), COALESCE(sum(l.multa), 0), COALESCE(sum(l.juros), 0),
         COALESCE(jsonb_agg(jsonb_build_object(
           'cobranca_id', l.id, 'descricao', l.descricao, 'vencimento', l.vencimento,
           'principal', l.principal, 'multa', l.multa, 'juros', l.juros)
           ORDER BY l.vencimento, l.id), '[]'::jsonb)
    INTO _principal, _multa, _juros, _itens
    FROM linhas l;

  -- Ver o cabeçalho da migração da estrutura para a razão deste limite.
  IF _desc > _multa + _juros THEN
    RAISE EXCEPTION 'desconto_excede_encargos'
      USING HINT = format(
        'O abatimento pode ir até %s (multa %s + juros %s). Perdoar principal transfere o custo para os outros condóminos e carece de deliberação.',
        to_char(_multa + _juros, 'FM999G999G990D00'),
        to_char(_multa, 'FM999G999G990D00'),
        to_char(_juros, 'FM999G999G990D00'));
  END IF;

  _total := _principal + _multa + _juros - _desc;

  IF _ent > _total THEN
    RAISE EXCEPTION 'entrada_excede_total';
  END IF;

  _a_parcelar := _total - _ent;

  _centavos := round(_a_parcelar * 100)::bigint;
  _base := _centavos / _num_parcelas;
  _resto := (_centavos % _num_parcelas)::int;

  FOR _i IN 1.._num_parcelas LOOP
    _v := (_base + CASE WHEN _i <= _resto THEN 1 ELSE 0 END)::numeric / 100;
    _parcelas := _parcelas || jsonb_build_object(
      'numero', _i,
      'vencimento', (_primeiro_vencimento + ((_i - 1) || ' month')::interval)::date,
      'valor', _v);
  END LOOP;

  RETURN jsonb_build_object(
    'data_acordo', _hoje,
    'principal', _principal,
    'multa', _multa,
    'juros', _juros,
    'desconto', _desc,
    'total', _total,
    'entrada', _ent,
    'a_parcelar', _a_parcelar,
    'num_parcelas', _num_parcelas,
    'itens', _itens,
    'parcelas', _parcelas
  );
END;
$$;

REVOKE ALL ON FUNCTION public._acordo_calcular(uuid, uuid, uuid[], numeric, numeric, integer, date)
  FROM PUBLIC, anon, authenticated;


-- A simulação, que o síndico mostra ao condómino antes de assinar.
CREATE OR REPLACE FUNCTION public.simular_acordo(
  _condominio_id uuid,
  _unidade_id uuid,
  _cobranca_ids uuid[],
  _desconto numeric,
  _entrada numeric,
  _num_parcelas integer,
  _primeiro_vencimento date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN public._acordo_calcular(_condominio_id, _unidade_id, _cobranca_ids,
                                 _desconto, _entrada, _num_parcelas, _primeiro_vencimento);
END;
$$;

REVOKE ALL ON FUNCTION public.simular_acordo(uuid, uuid, uuid[], numeric, numeric, integer, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_acordo(uuid, uuid, uuid[], numeric, numeric, integer, date)
  TO authenticated;
