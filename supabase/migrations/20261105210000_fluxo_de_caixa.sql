-- Fluxo de caixa e concentração de pagamentos.
--
-- O QUE FALTAVA
--
-- O balancete responde "quanto entrou e saiu neste período". Não responde
-- "quando". E é o quando que decide se o condomínio tem dinheiro no dia 10
-- para pagar o que vence no dia 10.
--
-- Um condomínio que recebe a taxa no dia 10 e paga a folha no dia 5 passa cinco
-- dias por mês a descoberto, todos os meses, e o balancete fecha no azul na
-- mesma. Isso não se vê num total mensal: vê-se num saldo dia a dia.
--
-- A MESMA CONTA DO BALANCETE, OU NÃO VALE NADA
--
-- O saldo de abertura segue exactamente a regra de `calcular_balancete`: o
-- saldo inicial da configuração, mais o recebido e menos o pago desde a data
-- de corte até à véspera. Se os dois ecrãs discordassem sobre o mesmo dia, o
-- condómino teria dois números e nenhuma forma de saber qual vale.
--
-- Está extraído em `_saldo_ate` e há um teste que compara o que esta função
-- devolve com o `saldo_anterior` do balancete para a mesma data. É a única
-- garantia que não se desfaz quando alguém mexer num dos dois.
--
-- REGIME DE CAIXA, PELA DATA DO MOVIMENTO
--
-- Entra o que foi recebido, pela data do pagamento; sai o que foi pago, pela
-- data da despesa. É o mesmo regime do balancete. A cobrança emitida e não
-- paga não aparece aqui — aparece na inadimplência, que é outro ecrã e outra
-- pergunta.
--
-- A CONCENTRAÇÃO
--
-- Por dia do mês e por dia da semana. A do mês é a que serve para decidir: se
-- 60% da despesa sai até ao dia 8 e a taxa vence no dia 10, o vencimento está
-- no sítio errado e muda-se com uma assembleia, não com um empréstimo.
--
-- A da semana diz outra coisa — quase sempre que se paga à segunda ou na
-- sexta — e serve mais para conferir o hábito de quem lança do que para
-- decidir seja o que for. Vai junto porque custa a mesma consulta.


-- O saldo em caixa até ao fim de um dia, pela regra do balancete.
CREATE OR REPLACE FUNCTION public._saldo_ate(
  _condominio_id uuid,
  _ate date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _saldo_inicial numeric;
  _corte date;
BEGIN
  SELECT COALESCE(cp.saldo_inicial, 0), cp.saldo_inicial_data
    INTO _saldo_inicial, _corte
    FROM public.config_pagamento cp
   WHERE cp.condominio_id = _condominio_id;

  _saldo_inicial := COALESCE(_saldo_inicial, 0);

  RETURN _saldo_inicial
    + COALESCE((SELECT sum(p.valor) FROM public.pagamentos p
                 WHERE p.condominio_id = _condominio_id
                   AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date <= _ate
                   AND (_corte IS NULL
                        OR (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date >= _corte)), 0)
    - COALESCE((SELECT sum(d.valor) FROM public.despesas d
                 WHERE d.condominio_id = _condominio_id
                   AND d.data <= _ate
                   AND (_corte IS NULL OR d.data >= _corte)), 0);
END;
$$;

COMMENT ON FUNCTION public._saldo_ate(uuid, date) IS
  'Saldo em caixa até ao fim do dia indicado, pela mesma regra do saldo de abertura do balancete.';

REVOKE ALL ON FUNCTION public._saldo_ate(uuid, date) FROM PUBLIC, anon, authenticated;


-- ============================================================
-- FLUXO DE CAIXA, DIA A DIA
-- ============================================================

CREATE OR REPLACE FUNCTION public.fluxo_de_caixa(
  _condominio_id uuid,
  _inicio date,
  _fim date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _abertura numeric;
  _dias jsonb;
  _entradas numeric;
  _saidas numeric;
  _menor numeric;
  _menor_dia date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'periodo_invalido';
  END IF;

  IF _fim - _inicio > 400 THEN
    RAISE EXCEPTION 'periodo_invalido'
      USING HINT = 'O fluxo diário vai até pouco mais de um ano de cada vez.';
  END IF;

  _abertura := public._saldo_ate(_condominio_id, _inicio - 1);

  WITH dias AS (
    SELECT d::date AS dia FROM generate_series(_inicio, _fim, interval '1 day') d
  ),
  mov AS (
    SELECT dias.dia,
           COALESCE((SELECT sum(p.valor) FROM public.pagamentos p
                      WHERE p.condominio_id = _condominio_id
                        AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date = dias.dia), 0) AS entrada,
           COALESCE((SELECT sum(x.valor) FROM public.despesas x
                      WHERE x.condominio_id = _condominio_id
                        AND x.data = dias.dia), 0) AS saida
      FROM dias
  ),
  corrido AS (
    -- O saldo de cada dia é o de abertura mais tudo o que se moveu até ele.
    -- Somar na consulta e não no cliente: quem imprime a folha e quem vê o
    -- ecrã têm de ver o mesmo número.
    SELECT m.dia, m.entrada, m.saida,
           _abertura + sum(m.entrada - m.saida) OVER (ORDER BY m.dia) AS saldo
      FROM mov m
  )
  SELECT jsonb_agg(jsonb_build_object(
           'data', c.dia, 'entradas', c.entrada, 'saidas', c.saida, 'saldo', c.saldo)
           ORDER BY c.dia),
         COALESCE(sum(c.entrada), 0),
         COALESCE(sum(c.saida), 0),
         min(c.saldo)
    INTO _dias, _entradas, _saidas, _menor
    FROM corrido c;

  -- O dia em que o saldo esteve mais baixo. É o número que diz se houve
  -- aperto, e o total do mês esconde-o sempre.
  SELECT (x->>'data')::date INTO _menor_dia
    FROM jsonb_array_elements(COALESCE(_dias, '[]'::jsonb)) x
   WHERE (x->>'saldo')::numeric = _menor
   ORDER BY (x->>'data')::date
   LIMIT 1;

  RETURN jsonb_build_object(
    'inicio', _inicio,
    'fim', _fim,
    'saldo_abertura', _abertura,
    'entradas', _entradas,
    'saidas', _saidas,
    'resultado', _entradas - _saidas,
    'saldo_final', _abertura + _entradas - _saidas,
    'saldo_minimo', _menor,
    'saldo_minimo_em', _menor_dia,
    'dias', COALESCE(_dias, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fluxo_de_caixa(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fluxo_de_caixa(uuid, date, date) TO authenticated;


-- ============================================================
-- EM QUE DIAS SAI O DINHEIRO
-- ============================================================

CREATE OR REPLACE FUNCTION public.concentracao_pagamentos(
  _condominio_id uuid,
  _inicio date,
  _fim date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _total numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'periodo_invalido';
  END IF;

  SELECT COALESCE(sum(d.valor), 0) INTO _total
    FROM public.despesas d
   WHERE d.condominio_id = _condominio_id AND d.data BETWEEN _inicio AND _fim;

  RETURN jsonb_build_object(
    'inicio', _inicio,
    'fim', _fim,
    'total_despesas', _total,

    -- Todos os 31 dias aparecem, mesmo os de valor zero: um gráfico com os
    -- dias em falta desenha uma concentração que não existe.
    'por_dia_do_mes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'dia', g.dia,
               'despesas', COALESCE(s.valor, 0),
               'quantidade', COALESCE(s.qtd, 0),
               'recebimentos', COALESCE(r.valor, 0),
               'percentagem', CASE WHEN _total > 0
                                   THEN round(COALESCE(s.valor, 0) * 100 / _total, 2)
                                   ELSE 0 END) ORDER BY g.dia), '[]'::jsonb)
        FROM generate_series(1, 31) g(dia)
        LEFT JOIN (
          SELECT extract(day FROM d.data)::int AS dia, sum(d.valor) AS valor, count(*) AS qtd
            FROM public.despesas d
           WHERE d.condominio_id = _condominio_id AND d.data BETWEEN _inicio AND _fim
           GROUP BY 1) s ON s.dia = g.dia
        LEFT JOIN (
          SELECT extract(day FROM (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date)::int AS dia,
                 sum(p.valor) AS valor
            FROM public.pagamentos p
           WHERE p.condominio_id = _condominio_id
             AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _inicio AND _fim
           GROUP BY 1) r ON r.dia = g.dia
    ),

    'por_dia_da_semana', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'dia', g.dia,
               'despesas', COALESCE(s.valor, 0),
               'quantidade', COALESCE(s.qtd, 0)) ORDER BY g.dia), '[]'::jsonb)
        FROM generate_series(0, 6) g(dia)
        LEFT JOIN (
          SELECT extract(dow FROM d.data)::int AS dia, sum(d.valor) AS valor, count(*) AS qtd
            FROM public.despesas d
           WHERE d.condominio_id = _condominio_id AND d.data BETWEEN _inicio AND _fim
           GROUP BY 1) s ON s.dia = g.dia
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.concentracao_pagamentos(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concentracao_pagamentos(uuid, date, date) TO authenticated;
