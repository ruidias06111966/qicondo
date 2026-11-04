-- ============================================================
-- Motor de inadimplência
--
-- `cobrancas.multa` e `cobrancas.juros` existem desde a primeira migração e
-- `config_pagamento` guarda as taxas desde então (2% de multa, 0,0333% ao dia).
-- Nunca houve nada que os calculasse: o ecrã de inadimplência soma-os no saldo
-- devedor e soma sempre zero. O estado `vencida` também nunca era atribuído —
-- cobranças há meses em atraso continuavam `pendente`.
--
-- Pior do que isso: `registrar_pagamento_manual` e `cnab_baixar_cobranca`
-- consideram a cobrança quitada quando o pago atinge
-- `valor + multa + juros - desconto`. Com multa e juros a zero, quem pagasse o
-- valor nominal ficava `paga` — e uma cobrança `paga` não volta a ser tocada.
-- Os encargos de um atraso de meio ano desapareciam sem deixar rasto.
--
-- Decisões que um contador quer ver escritas:
--
--   * A multa entra UMA vez, sobre o débito original (`valor - desconto`), e
--     não volta a crescer nem diminui com pagamentos parciais. É o que o
--     art. 1.336, §1º do Código Civil prevê: multa de até 2% sobre o débito,
--     não 2% por período.
--   * Os juros são simples e não capitalizam: os juros de ontem não geram
--     juros hoje.
--   * Os juros de cada dia incidem sobre o principal que estava em aberto
--     NAQUELE dia, reconstruído a partir de `pagamentos`. Um pagamento parcial
--     reduz os juros a partir da sua data, não antes dela — e os juros já
--     corridos não se perdem quando o principal acaba por ser coberto.
--   * Tudo é recalculado do zero a cada passagem, nunca incrementado. Correr o
--     agendamento duas vezes no mesmo dia dá exactamente o mesmo resultado, e
--     uma falha a meio não deixa a base com meio cálculo. O cálculo depende
--     apenas de `cobrancas` e `pagamentos`, nunca do valor anterior da coluna.
--   * "Hoje" é o dia em São Paulo, não em UTC. Uma cobrança que vence hoje não
--     está em atraso, e às 22h de Brasília já é o dia seguinte em UTC.
--   * `paga` e `cancelada` nunca são recalculadas. O que foi acertado fica como
--     ficou: um balancete não se reescreve a si mesmo.
--
-- Fica deliberadamente por decidir: a imputação de um pagamento parcial. Aqui
-- abate-se primeiro ao principal, o que reduz os juros seguintes. O art. 354 do
-- Código Civil manda imputar primeiro aos juros vencidos e só depois ao capital
-- — o contrário, e mais oneroso para o condómino. Escolheu-se a leitura
-- favorável ao devedor por ser a que não cobra a mais sem alguém ter decidido.
-- Mudar isso é mexer só no cálculo de `_encargos_devidos`.
--
-- Um aviso sobre dados antigos: os juros são derivados de `pagamentos`. As duas
-- funções que mexem em `cobrancas.valor_pago` — `registrar_pagamento_manual` e
-- `cnab_baixar_cobranca` — gravam sempre a linha de pagamento correspondente,
-- por isso o histórico está completo. Se algum dia aparecer um `valor_pago`
-- sem pagamento registado, o motor trata-o como ainda não pago para efeitos de
-- juros: cobra a mais, em vez de deixar passar uma data que não existe.
-- ============================================================

-- ------------------------------------------------------------
-- O cálculo, e só o cálculo. Não grava nada.
--
-- Única fonte da fórmula: tanto a aplicação diária como a pré-visualização
-- passam por aqui, para não haver dois sítios a divergir.
--
-- Chamar com `_cobranca_id` preenchido devolve uma cobrança; com
-- `_condominio_id` preenchido, a carteira inteira desse condomínio. Devolve
-- apenas cobranças efectivamente em atraso e em aberto — o que não aparece não
-- tem encargos a aplicar.
--
-- A soma dos juros em linguagem corrente: para cada dia entre o vencimento e a
-- data de referência, o principal que estava em aberto nesse dia, vezes a taxa
-- diária. Não é um ciclo por dia (uma cobrança com dois anos de atraso seriam
-- 730 linhas, vezes milhares de cobranças): é a mesma soma em forma fechada —
-- o débito vezes os dias, menos, por cada pagamento, a parte imputada ao
-- principal vezes os dias que lhe restavam.
--
-- Interna de propósito: não verifica permissões, porque é chamada tanto por
-- quem gere o financeiro como pelo agendamento, que não tem `auth.uid()`.
-- Revogada de todos os roles — só os invólucros abaixo, que correm com os
-- privilégios do dono, a conseguem chamar.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._encargos_devidos(
  _condominio_id uuid,
  _cobranca_id uuid,
  _referencia date
)
RETURNS TABLE(cobranca_id uuid, multa numeric, juros numeric, dias_atraso int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref date := COALESCE(_referencia, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
BEGIN
  IF _condominio_id IS NULL AND _cobranca_id IS NULL THEN
    RAISE EXCEPTION 'condominio_ou_cobranca_obrigatorio';
  END IF;

  RETURN QUERY
  WITH alvo AS (
    SELECT c.id,
           c.condominio_id,
           c.vencimento,
           GREATEST(c.valor - c.desconto, 0) AS debito,
           (_ref - c.vencimento) AS dias
      FROM public.cobrancas c
     WHERE c.status IN ('pendente', 'vencida', 'parcial')
       AND c.vencimento < _ref
       AND ((_cobranca_id IS NOT NULL AND c.id = _cobranca_id)
            OR (_cobranca_id IS NULL AND c.condominio_id = _condominio_id))
  ),
  -- Sem configuração própria valem os mesmos valores que a tabela assume por
  -- omissão: 2% de multa e 0,0333% ao dia, que dá perto de 1% ao mês.
  taxa AS (
    SELECT a.id,
           COALESCE(cp.multa_percentual, 2.00) AS multa_pct,
           COALESCE(cp.juros_dia_percentual, 0.0333) AS juros_pct
      FROM alvo a
      LEFT JOIN public.config_pagamento cp ON cp.condominio_id = a.condominio_id
  ),
  -- `antes` é o acumulado dos pagamentos anteriores a este. Serve para limitar
  -- ao principal a parte de cada pagamento que o abate: o que passa disso
  -- pagou multa e juros, e não pode reduzir juros de dias já corridos.
  pago AS (
    SELECT p.cobranca_id,
           p.valor,
           (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           COALESCE(
             sum(p.valor) OVER (PARTITION BY p.cobranca_id
                                ORDER BY p.pago_em, p.id
                                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),
             0) AS antes
      FROM public.pagamentos p
     WHERE p.cobranca_id IN (SELECT a.id FROM alvo a)
  ),
  soma AS (
    SELECT a.id,
           a.debito * a.dias
             - COALESCE((
                 SELECT sum(
                          LEAST(pg.valor, GREATEST(a.debito - pg.antes, 0))
                          -- Dias em que este pagamento já estava feito: de
                          -- `dia + 1` até `_ref`. Pago no próprio dia do
                          -- vencimento, abate o período todo; pago hoje, não
                          -- abate nada dos juros de hoje para trás.
                          * GREATEST(_ref - GREATEST(pg.dia, a.vencimento), 0)
                        )
                   FROM pago pg
                  WHERE pg.cobranca_id = a.id), 0) AS principal_x_dias
      FROM alvo a
  )
  SELECT a.id,
         round(a.debito * t.multa_pct / 100, 2),
         round(GREATEST(s.principal_x_dias, 0) * t.juros_pct / 100, 2),
         a.dias::int
    FROM alvo a
    JOIN taxa t ON t.id = a.id
    JOIN soma s ON s.id = a.id;
END;
$$;

REVOKE ALL ON FUNCTION public._encargos_devidos(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Grava o que `_encargos_devidos` calcula, e devolve quantas linhas mudaram.
--
-- É um único UPDATE em conjunto, não um ciclo. A cláusula final evita
-- reescrever linhas já certas — sem ela, o trigger `touch_updated_at` marcava
-- toda a carteira como alterada todas as noites e qualquer sincronização
-- incremental passava a trazer tudo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._aplicar_encargos(
  _condominio_id uuid,
  _cobranca_id uuid,
  _referencia date
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n int;
BEGIN
  UPDATE public.cobrancas c
     SET multa  = e.multa,
         juros  = e.juros,
         status = CASE WHEN c.status = 'pendente'
                         THEN 'vencida'::public.cobranca_status
                       ELSE c.status END
    FROM public._encargos_devidos(_condominio_id, _cobranca_id, _referencia) e
   WHERE c.id = e.cobranca_id
     AND (c.multa IS DISTINCT FROM e.multa
          OR c.juros IS DISTINCT FROM e.juros
          OR c.status = 'pendente');

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public._aplicar_encargos(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Pré-visualização: os encargos de uma cobrança numa data, sem gravar.
--
-- Serve para mostrar ao síndico o que vai acontecer antes de acontecer, e para
-- simular uma data futura ("quanto é que isto custa se ele pagar no dia 20").
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_encargos_cobranca(
  _cobranca_id uuid,
  _referencia date DEFAULT NULL
)
RETURNS TABLE(multa numeric, juros numeric, dias_atraso int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cond uuid;
  _status public.cobranca_status;
BEGIN
  SELECT c.condominio_id, c.status INTO _cond, _status
    FROM public.cobrancas c WHERE c.id = _cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cobranca_nao_encontrada';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _cond) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Quitada ou cancelada: devolve o que está gravado, não o que daria hoje.
  IF _status IN ('paga', 'cancelada') THEN
    RETURN QUERY
      SELECT c.multa, c.juros, 0 FROM public.cobrancas c WHERE c.id = _cobranca_id;
    RETURN;
  END IF;

  -- `_encargos_devidos` não devolve linha para quem não está em atraso.
  RETURN QUERY
  SELECT COALESCE(e.multa, 0::numeric),
         COALESCE(e.juros, 0::numeric),
         COALESCE(e.dias_atraso, 0)
    FROM (SELECT 1) _
    LEFT JOIN public._encargos_devidos(NULL, _cobranca_id, _referencia) e ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_encargos_cobranca(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_encargos_cobranca(uuid, date) TO authenticated;

-- ------------------------------------------------------------
-- Recalcula a carteira de um condomínio, a pedido de quem gere o financeiro.
--
-- Existe para não ser preciso esperar pela madrugada depois de corrigir uma
-- taxa em `config_pagamento`, e para quem quiser ver o efeito antes de emitir
-- uma segunda via.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_encargos_atraso(
  _condominio_id uuid,
  _referencia date DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _n := public._aplicar_encargos(_condominio_id, NULL, _referencia);

  IF _n > 0 THEN
    INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, metadata)
    VALUES (_condominio_id, _uid, 'encargos_aplicados', 'cobrancas',
            jsonb_build_object('cobrancas', _n, 'referencia', _referencia, 'origem', 'manual'));
  END IF;

  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_encargos_atraso(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_encargos_atraso(uuid, date) TO authenticated;

-- ------------------------------------------------------------
-- O que o agendamento corre: todos os condomínios com alguma cobrança em
-- atraso.
--
-- Cada condomínio vai no seu próprio bloco com tratamento de erro. Um
-- condomínio com dados estranhos não pode impedir os outros de ser
-- actualizados — e o agendamento corre sem ninguém a olhar, por isso o que
-- falha fica no log do Postgres em vez de abortar a noite toda.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_encargos_atraso_todos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cond uuid;
  _ref date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _n int;
  _total int := 0;
BEGIN
  FOR _cond IN
    SELECT DISTINCT c.condominio_id
      FROM public.cobrancas c
     WHERE c.status IN ('pendente', 'vencida', 'parcial')
       AND c.vencimento < _ref
  LOOP
    BEGIN
      _n := public._aplicar_encargos(_cond, NULL, _ref);
      _total := _total + _n;

      IF _n > 0 THEN
        INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, metadata)
        VALUES (_cond, NULL, 'encargos_aplicados', 'cobrancas',
                jsonb_build_object('cobrancas', _n, 'referencia', _ref, 'origem', 'agendamento'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'aplicar_encargos_atraso_todos: condomínio % falhou: %', _cond, SQLERRM;
    END;
  END LOOP;

  RETURN _total;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_encargos_atraso_todos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_encargos_atraso_todos() TO service_role;

-- ------------------------------------------------------------
-- Quem deve quanto, por unidade.
--
-- O ecrã de inadimplência lista cobranças; o síndico precisa da outra vista —
-- a unidade 302 deve três meses e 1.847,32, e está 94 dias em atraso no mais
-- antigo. É também o que vai para a pauta da assembleia.
--
-- Lê o que está gravado, não recalcula: é um relatório. Quem quiser os valores
-- de hoje corre `aplicar_encargos_atraso` primeiro — e o agendamento já o fez
-- de madrugada.
-- ------------------------------------------------------------
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
  SELECT u.id,
         u.bloco,
         u.numero,
         count(*)::int,
         max(_ref - c.vencimento)::int,
         sum(GREATEST(c.valor - c.desconto - c.valor_pago, 0)),
         sum(c.multa),
         sum(c.juros),
         sum(GREATEST(c.valor + c.multa + c.juros - c.desconto - c.valor_pago, 0)),
         min(c.vencimento)
    FROM public.cobrancas c
    JOIN public.unidades u ON u.id = c.unidade_id
   WHERE c.condominio_id = _condominio_id
     AND c.status IN ('pendente', 'vencida', 'parcial')
     AND c.vencimento < _ref
   GROUP BY u.id, u.bloco, u.numero
   ORDER BY sum(GREATEST(c.valor + c.multa + c.juros - c.desconto - c.valor_pago, 0)) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.relatorio_inadimplencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_inadimplencia(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Pagamento manual: aplica os encargos do dia do pagamento antes de somar.
--
-- Era aqui que os encargos se perdiam. A função lê `valor + multa + juros -
-- desconto` para decidir se a cobrança fica `paga`; com os encargos a zero,
-- pagar o valor nominal de uma cobrança com seis meses de atraso quitava-a, e
-- `paga` nunca mais é recalculada. Agora os encargos são postos em dia à data
-- do pagamento — não à de hoje, porque quem pagou no dia 10 não deve os juros
-- do dia 20 — e só depois se compara.
--
-- A autorização passa a ser `pode_gerir_financeiro`: era `is_sindico OR
-- is_contador`, o que deixava de fora o perfil `financeiro`, que as políticas
-- RLS já aceitam desde `rls_perfil_financeiro`. Quem pode lançar uma cobrança
-- tem de poder registar o pagamento dela.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pagamento_manual(
  _cobranca_id UUID,
  _valor NUMERIC,
  _forma public.forma_pagamento,
  _pago_em TIMESTAMPTZ,
  _observacoes TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _valor_total NUMERIC;
  _pag_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT condominio_id INTO _cond FROM public.cobrancas WHERE id = _cobranca_id;

  IF _cond IS NULL THEN RAISE EXCEPTION 'cobranca_nao_encontrada'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _cond) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.pagamentos (condominio_id, cobranca_id, valor, forma, pago_em, observacoes, registrado_por)
  VALUES (_cond, _cobranca_id, _valor, _forma, _pago_em, _observacoes, _uid)
  RETURNING id INTO _pag_id;

  -- Depois de inserir o pagamento, porque os juros são calculados a partir do
  -- histórico: este pagamento reduz o principal a partir de hoje, e os juros
  -- dos dias anteriores continuam devidos.
  PERFORM public._aplicar_encargos(
    NULL, _cobranca_id,
    (COALESCE(_pago_em, now()) AT TIME ZONE 'America/Sao_Paulo')::date
  );

  SELECT (valor + multa + juros - desconto) INTO _valor_total
    FROM public.cobrancas WHERE id = _cobranca_id;

  UPDATE public.cobrancas
  SET valor_pago = valor_pago + _valor,
      status = CASE
        WHEN (valor_pago + _valor) >= _valor_total THEN 'paga'::public.cobranca_status
        WHEN (valor_pago + _valor) > 0 THEN 'parcial'::public.cobranca_status
        ELSE status
      END,
      pago_em = CASE WHEN (valor_pago + _valor) >= _valor_total THEN _pago_em ELSE pago_em END
  WHERE id = _cobranca_id;

  RETURN _pag_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pagamento_manual(uuid, numeric, public.forma_pagamento, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_manual(uuid, numeric, public.forma_pagamento, timestamptz, text)
  TO authenticated;

-- ------------------------------------------------------------
-- Baixa por retorno CNAB: o mesmo problema, a mesma correcção.
--
-- Chamada pelo processador de ficheiros de retorno do banco. Tinha
-- exactamente o mesmo defeito: comparava o pago com um total sem encargos. Com
-- boleto a diferença é maior, porque o banco cobra o valor actualizado e o
-- ficheiro traz esse valor — a cobrança ficava `paga` com um pago acima do
-- total registado, e a multa e os juros recebidos não apareciam em sítio
-- nenhum do balancete.
--
-- A data de referência é a do pagamento no banco, não a de hoje: um retorno
-- processado na segunda-feira traz pagamentos de sexta.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cnab_baixar_cobranca(
  _cobranca_id UUID, _valor NUMERIC, _data_pagamento DATE, _retorno_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cond UUID; _total NUMERIC; _pag_id UUID;
BEGIN
  SELECT condominio_id INTO _cond FROM public.cobrancas WHERE id = _cobranca_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'cobranca_nao_encontrada'; END IF;

  INSERT INTO public.pagamentos (condominio_id, cobranca_id, valor, forma, pago_em, observacoes)
  VALUES (_cond, _cobranca_id, _valor, 'boleto'::public.forma_pagamento,
          (_data_pagamento::timestamptz),
          'Baixa automática CNAB ' || _retorno_id::text)
  RETURNING id INTO _pag_id;

  PERFORM public._aplicar_encargos(NULL, _cobranca_id, _data_pagamento);

  SELECT (valor + multa + juros - desconto) INTO _total
    FROM public.cobrancas WHERE id = _cobranca_id;

  UPDATE public.cobrancas
     SET valor_pago = valor_pago + _valor,
         status = CASE
           WHEN (valor_pago + _valor) >= _total THEN 'paga'::public.cobranca_status
           WHEN (valor_pago + _valor) > 0 THEN 'parcial'::public.cobranca_status
           ELSE status END,
         pago_em = CASE WHEN (valor_pago + _valor) >= _total
                        THEN _data_pagamento::timestamptz ELSE pago_em END
   WHERE id = _cobranca_id;

  RETURN _pag_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cnab_baixar_cobranca(uuid, numeric, date, uuid)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Agendamento diário.
--
-- 09:00 UTC = 06:00 em Brasília (UTC-3, sem horário de verão desde 2019). Já
-- virou o dia em São Paulo, e está feito antes de alguém abrir o sistema.
--
-- Ao contrário dos outros agendamentos deste repositório, este não chama rota
-- nenhuma: é SQL puro, não precisa do vault nem de segredo, e por isso também
-- não falha quando a aplicação está em baixo.
--
-- Correr duas vezes seguidas é inofensivo — o cálculo é feito do zero, a partir
-- de `cobrancas` e `pagamentos`, e o UPDATE só toca nas linhas que mudam.
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  _jid BIGINT;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'encargos-atraso-diario' LOOP
    PERFORM cron.unschedule(_jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'encargos-atraso-diario',
  '0 9 * * *',
  $$SELECT public.aplicar_encargos_atraso_todos();$$
);

-- Índice para a varredura diária: sem ele é um seq scan em `cobrancas` por
-- cada passagem, e a lista de inadimplência faz a mesma pergunta.
CREATE INDEX IF NOT EXISTS idx_cobrancas_atraso
  ON public.cobrancas (condominio_id, vencimento)
  WHERE status IN ('pendente', 'vencida', 'parcial');
