-- A inadimplência passa a mostrar o devido, não o último gravado.
--
-- O PROBLEMA
--
-- `relatorio_inadimplencia` somava `c.multa` e `c.juros`, que são colunas
-- gravadas na cobrança. Quem as grava é `_aplicar_encargos`, chamada pelo
-- agendamento diário das 9h ou ao registar um pagamento. Entre o momento em
-- que uma cobrança vence e a passagem seguinte do agendamento, as colunas
-- valem zero, e o relatório mostrava zero.
--
-- Num condomínio acabado de criar isso é o primeiro dia inteiro: o síndico
-- lança o rateio com vencimentos já passados, abre a Inadimplência e vê a
-- dívida sem multa nem juros. Pior no caso que mais acontece na prática —
-- importar a carteira em atraso de outro sistema e emitir as cartas de
-- cobrança no mesmo dia: todas saem por baixo do que é devido.
--
-- Verificado na base: com quatro cobranças vencidas há 59 dias e sem
-- configuração própria (2% de multa, 0,0333% ao dia), o relatório dava
-- 1000,00 por unidade. Depois de correr à mão o que o agendamento faz,
-- passou a dar 1039,65. Os mesmos dados, dois números.
--
-- A CORREÇÃO
--
-- O relatório passa a chamar `_encargos_devidos`, o mesmo motor que o
-- agendamento usa para gravar. Deixa de haver dois números possíveis para a
-- mesma dívida: há o devido, e o agendamento é só quem o persiste para quem
-- lê a tabela directamente.
--
-- O cálculo é determinístico a partir do vencimento e do histórico de
-- pagamentos, por isso não depende de quando a função é chamada — duas
-- leituras no mesmo dia dão o mesmo. E o que o motor devolve nunca é inferior
-- ao gravado, porque os juros só correm para a frente.
--
-- `_encargos_devidos` é `SECURITY DEFINER` e está revogada de `authenticated`.
-- Continua a ser chamada só de dentro de `relatorio_inadimplencia`, que já
-- verifica `pode_gerir_financeiro` antes de qualquer leitura.

CREATE OR REPLACE FUNCTION public.relatorio_inadimplencia(_condominio_id uuid)
RETURNS TABLE(
  unidade_id uuid,
  bloco text,
  numero text,
  cobrancas int,
  dias_atraso_max int,
  principal numeric,
  multa numeric,
  juros numeric,
  total numeric,
  vencimento_mais_antigo date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH devido AS (
    SELECT e.cobranca_id, e.multa, e.juros
      FROM public._encargos_devidos(_condominio_id, NULL, _ref) e
  )
  SELECT u.id,
         u.bloco,
         u.numero,
         count(*)::int,
         max(_ref - c.vencimento)::int,
         sum(GREATEST(c.valor - c.desconto - c.valor_pago, 0)),
         sum(COALESCE(d.multa, 0)),
         sum(COALESCE(d.juros, 0)),
         sum(GREATEST(
               c.valor + COALESCE(d.multa, 0) + COALESCE(d.juros, 0)
                 - c.desconto - c.valor_pago, 0)),
         min(c.vencimento)
    FROM public.cobrancas c
    JOIN public.unidades u ON u.id = c.unidade_id
    LEFT JOIN devido d ON d.cobranca_id = c.id
   WHERE c.condominio_id = _condominio_id
     AND c.status IN ('pendente', 'vencida', 'parcial')
     AND c.vencimento < _ref
   GROUP BY u.id, u.bloco, u.numero
   ORDER BY sum(GREATEST(
               c.valor + COALESCE(d.multa, 0) + COALESCE(d.juros, 0)
                 - c.desconto - c.valor_pago, 0)) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.relatorio_inadimplencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_inadimplencia(uuid) TO authenticated;



-- ============================================================
-- O MESMO DEFEITO NO BALANCETE
-- ============================================================
-- `calcular_balancete` somava `c.multa + c.juros` das mesmas colunas gravadas,
-- na linha de inadimplência que acompanha a prestação de contas. Mesma causa,
-- mesmo efeito: o valor dependia de quando o agendamento passou pela última
-- vez.
--
-- Aqui há um agravante. O balancete é de um período fechado e a fotografia
-- fica gravada na linha. Com as colunas, a inadimplência de um balancete de
-- Setembro refletia o estado das cobranças à data em que o agendamento correu
-- — que pode ser Novembro. A referência certa é o fim do período, e é essa
-- que `_encargos_devidos` recebe: a prestação de contas de Setembro mostra o
-- que estava em atraso a 30 de Setembro, não o que está em atraso quando
-- alguém abre o documento.
--
-- Só o bloco da inadimplência muda. O resto da função fica como estava — o
-- saldo inicial de `config_pagamento` com a sua data de corte, as linhas uma
-- a uma, e a ordenação das categorias.
--
-- A função é `SECURITY DEFINER` e verifica `pode_gerir_financeiro` antes de
-- qualquer leitura; `_encargos_devidos` continua revogada de `authenticated`.

CREATE OR REPLACE FUNCTION public.calcular_balancete(
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
  _saldo_inicial numeric;
  _corte date;
  _saldo_anterior numeric;
  _receitas numeric;
  _despesas numeric;
  _fundo numeric;
  _inad_total numeric;
  _inad_cobrancas int;
  _inad_unidades int;
  _ref_inad date;
  _rec_cat jsonb;
  _desp_cat jsonb;
  _rec_lin jsonb;
  _desp_lin jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'periodo_invalido';
  END IF;

  SELECT COALESCE(cp.saldo_inicial, 0), cp.saldo_inicial_data
    INTO _saldo_inicial, _corte
    FROM public.config_pagamento cp
   WHERE cp.condominio_id = _condominio_id;

  _saldo_inicial := COALESCE(_saldo_inicial, 0);

  -- Saldo anterior: o de abertura, mais tudo o que mexeu entre a data desse
  -- saldo e o início do período. Derivado, nunca guardado — assim não pode
  -- divergir do que está lançado.
  SELECT _saldo_inicial
         + COALESCE((SELECT sum(p.valor) FROM public.pagamentos p
                      WHERE p.condominio_id = _condominio_id
                        AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date < _inicio
                        AND (_corte IS NULL
                             OR (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date >= _corte)), 0)
         - COALESCE((SELECT sum(d.valor) FROM public.despesas d
                      WHERE d.condominio_id = _condominio_id
                        AND d.data < _inicio
                        AND (_corte IS NULL OR d.data >= _corte)), 0)
    INTO _saldo_anterior;

  SELECT COALESCE(sum(p.valor), 0) INTO _receitas
    FROM public.pagamentos p
   WHERE p.condominio_id = _condominio_id
     AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _inicio AND _fim;

  SELECT COALESCE(sum(d.valor), 0) INTO _despesas
    FROM public.despesas d
   WHERE d.condominio_id = _condominio_id
     AND d.data BETWEEN _inicio AND _fim;

  -- Receitas por categoria. A categoria vem da cobrança que o pagamento
  -- liquidou; um recebimento sem cobrança (lançado à mão) fica sem categoria.
  --
  -- O valor é o recebido, multa e juros incluídos: em caixa entrou o que
  -- entrou, e dividir um pagamento entre principal e encargos exigiria a
  -- imputação linha a linha, que é do saldo devedor e não do extracto.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'categoria'), '[]'::jsonb) INTO _rec_cat
    FROM (
      SELECT jsonb_build_object(
               'categoria', COALESCE(cat.nome, 'Sem categoria'),
               'cor', cat.cor,
               'fundo_reserva', COALESCE(cat.fundo_reserva, false),
               'valor', sum(p.valor)
             ) AS x
        FROM public.pagamentos p
        LEFT JOIN public.cobrancas c ON c.id = p.cobranca_id
        LEFT JOIN public.categorias_financeiras cat ON cat.id = c.categoria_id
       WHERE p.condominio_id = _condominio_id
         AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _inicio AND _fim
       GROUP BY cat.nome, cat.cor, cat.fundo_reserva
    ) s;

  SELECT COALESCE(sum(p.valor), 0) INTO _fundo
    FROM public.pagamentos p
    LEFT JOIN public.cobrancas c ON c.id = p.cobranca_id
    LEFT JOIN public.categorias_financeiras cat ON cat.id = c.categoria_id
   WHERE p.condominio_id = _condominio_id
     AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _inicio AND _fim
     AND COALESCE(cat.fundo_reserva, false);

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'categoria'), '[]'::jsonb) INTO _desp_cat
    FROM (
      SELECT jsonb_build_object(
               'categoria', COALESCE(cat.nome, 'Sem categoria'),
               'cor', cat.cor,
               'valor', sum(d.valor)
             ) AS x
        FROM public.despesas d
        LEFT JOIN public.categorias_financeiras cat ON cat.id = d.categoria_id
       WHERE d.condominio_id = _condominio_id
         AND d.data BETWEEN _inicio AND _fim
       GROUP BY cat.nome, cat.cor
    ) s;

  -- As linhas, uma a uma. É isto que dá ao condómino o direito de examinar as
  -- contas em vez de confiar num total.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data', x->>'descricao'), '[]'::jsonb) INTO _rec_lin
    FROM (
      SELECT jsonb_build_object(
               'data', (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date,
               'descricao', COALESCE(c.descricao, p.observacoes, 'Recebimento'),
               'unidade', CASE WHEN u.id IS NULL THEN NULL
                               ELSE COALESCE(u.bloco || '-', '') || u.numero END,
               'categoria', COALESCE(cat.nome, 'Sem categoria'),
               'forma', p.forma::text,
               'valor', p.valor
             ) AS x
        FROM public.pagamentos p
        LEFT JOIN public.cobrancas c ON c.id = p.cobranca_id
        LEFT JOIN public.unidades u ON u.id = c.unidade_id
        LEFT JOIN public.categorias_financeiras cat ON cat.id = c.categoria_id
       WHERE p.condominio_id = _condominio_id
         AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _inicio AND _fim
    ) s;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data', x->>'descricao'), '[]'::jsonb) INTO _desp_lin
    FROM (
      SELECT jsonb_build_object(
               'data', d.data,
               'descricao', d.descricao,
               'fornecedor', d.fornecedor,
               'categoria', COALESCE(cat.nome, 'Sem categoria'),
               'forma', d.forma::text,
               'anexo_url', d.anexo_url,
               'valor', d.valor
             ) AS x
        FROM public.despesas d
        LEFT JOIN public.categorias_financeiras cat ON cat.id = d.categoria_id
       WHERE d.condominio_id = _condominio_id
         AND d.data BETWEEN _inicio AND _fim
    ) s;

  -- Inadimplência à data de fecho. Não entra no saldo — é caixa, e isto não
  -- entrou — mas vai no documento, porque um saldo sem ela engana.
  --
  -- Os encargos vêm do motor, com `_fim` como referência: é o que estava em
  -- atraso naquela data, e não o que as colunas `multa`/`juros` tinham
  -- gravado de alguma passagem posterior do agendamento.
  -- Tudo nesta conta tem de olhar para a mesma data, senão o número não quer
  -- dizer nada: encargos calculados ao fim do período e pagamentos de hoje
  -- dariam um balancete de Setembro a abater um pagamento de Novembro.
  --
  -- `LEAST` com hoje porque um balancete do mês a decorrer tem `_fim` no
  -- futuro, e não se cobram juros de dias que ainda não correram. Num período
  -- já fechado `_fim` é passado e o `LEAST` não faz nada.
  _ref_inad := LEAST(_fim, (now() AT TIME ZONE 'America/Sao_Paulo')::date);

  -- O estado em aberto é derivado do que estava pago naquela data, não da
  -- coluna `status`, que é de hoje: uma cobrança vencida em Setembro e paga
  -- em Novembro está hoje `paga`, mas estava em atraso no fecho de Setembro.
  -- Só as canceladas ficam de fora, que essas nunca foram devidas.
  --
  -- LIMITAÇÃO CONHECIDA: `_encargos_devidos` filtra por `status`, por isso
  -- uma cobrança que hoje está `paga` não devolve encargos. Num balancete
  -- recalculado para um período antigo essa cobrança entra com o principal
  -- em aberto à data, mas sem a multa e os juros que então corriam — fica
  -- por baixo. Não afecta o balancete fechado na altura certa, que é o uso
  -- normal: `fechar_balancete` grava a fotografia e é ela que se lê depois.
  -- Resolver isto obriga a mexer no motor, que o agendamento também usa.
  WITH pago_ate AS (
    SELECT p.cobranca_id, sum(p.valor) AS valor
      FROM public.pagamentos p
     WHERE p.condominio_id = _condominio_id
       AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date <= _ref_inad
     GROUP BY p.cobranca_id
  ),
  devido AS (
    SELECT e.cobranca_id, e.multa, e.juros
      FROM public._encargos_devidos(_condominio_id, NULL, _ref_inad) e
  ),
  aberto AS (
    SELECT c.unidade_id,
           GREATEST(c.valor + COALESCE(d.multa, 0) + COALESCE(d.juros, 0)
                      - c.desconto - COALESCE(pa.valor, 0), 0) AS saldo
      FROM public.cobrancas c
      LEFT JOIN devido d ON d.cobranca_id = c.id
      LEFT JOIN pago_ate pa ON pa.cobranca_id = c.id
     WHERE c.condominio_id = _condominio_id
       AND c.status <> 'cancelada'
       AND c.vencimento <= _ref_inad
  )
  SELECT COALESCE(sum(a.saldo), 0),
         count(*) FILTER (WHERE a.saldo > 0)::int,
         count(DISTINCT a.unidade_id) FILTER (WHERE a.saldo > 0)::int
    INTO _inad_total, _inad_cobrancas, _inad_unidades
    FROM aberto a;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', _inicio, 'fim', _fim),
    'saldo_anterior', _saldo_anterior,
    'saldo_inicial_considerado', _saldo_inicial,
    'receitas', jsonb_build_object(
      'total', _receitas,
      'fundo_reserva', _fundo,
      'operacional', _receitas - _fundo,
      'por_categoria', _rec_cat
    ),
    'despesas', jsonb_build_object('total', _despesas, 'por_categoria', _desp_cat),
    'saldo_final', _saldo_anterior + _receitas - _despesas,
    'inadimplencia', jsonb_build_object(
      'total', _inad_total,
      'cobrancas', _inad_cobrancas,
      'unidades', _inad_unidades
    ),
    'lancamentos', jsonb_build_object('receitas', _rec_lin, 'despesas', _desp_lin)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_balancete(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_balancete(uuid, date, date) TO authenticated;
