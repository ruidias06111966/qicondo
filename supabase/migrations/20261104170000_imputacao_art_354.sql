-- ============================================================
-- Imputação do pagamento parcial pelo art. 354 do Código Civil
--
-- `motor_inadimplencia` deixou esta decisão escrita e por decidir: um
-- pagamento parcial abatia primeiro ao principal, o que reduz os juros
-- seguintes e é a leitura favorável ao devedor. Escolheu-se assim por ser a
-- que não cobra a mais sem alguém ter decidido.
--
-- Decidiu-se. O art. 354 do Código Civil:
--
--   "Havendo capital e juros, o pagamento imputar-se-á primeiro nos juros
--    vencidos, e depois no capital, salvo estipulação em contrário, ou se o
--    credor der quitação por conta do capital."
--
-- É o que passa a valer. Na prática: um pagamento parcial só começa a reduzir
-- o principal — e portanto os juros futuros — depois de cobrir os juros já
-- corridos. Cobra mais do que a regra anterior, e é a regra da lei.
--
-- A multa fica entre os juros e o capital. O artigo só ordena juros e capital;
-- a multa não é juro, é pena pelo atraso, e o artigo não lhe dá lugar. Pô-la
-- antes do capital é a prática corrente e a leitura coerente com o artigo: o
-- capital é o último a ser abatido. Onde a ordem importa é no capital, porque
-- é sobre ele que os juros correm — entre multa e juros a ordem não muda
-- nenhum número.
--
-- A ressalva do artigo ("salvo estipulação em contrário") é precisamente o que
-- permite a uma convenção dispor de outro modo, e é por isso que isto pode
-- variar de condomínio para condomínio. Quando houver essa necessidade, o
-- lugar de a acomodar é uma coluna em `config_pagamento` lida por
-- `_encargos_cobranca`, abaixo — a regra está toda num sítio só, de propósito.
-- Não se antecipa aqui: uma opção de configuração que ninguém escolheu ainda é
-- mais uma coisa para manter e explicar.
--
-- ------------------------------------------------------------
-- Porque é que isto deixa de ser uma fórmula
--
-- Com imputação ao principal, os juros tinham forma fechada: o débito vezes os
-- dias, menos cada pagamento vezes os dias que lhe restavam. Uma só expressão,
-- um só UPDATE em conjunto.
--
-- Pelo art. 354 isso não é possível. O que cada pagamento abate ao principal
-- depende dos juros corridos até à sua data, e esses dependem do principal que
-- os pagamentos anteriores deixaram. É circular, e resolve-se de uma única
-- maneira: percorrer os pagamentos por ordem de data.
--
-- Para não pagar esse preço onde não é devido, ficam dois caminhos:
--
--   * Cobranças sem pagamento nenhum — a esmagadora maioria das que estão em
--     atraso e em aberto — continuam na forma fechada, em conjunto. Sem
--     pagamentos não há nada a imputar, e as duas regras dão o mesmo valor.
--   * Cobranças com pagamentos passam pelo percurso sequencial, uma a uma.
--     São poucas: uma cobrança com pagamentos costuma estar `paga`, e `paga`
--     nunca é recalculada.
--
-- As duas coincidem no caso sem pagamentos, e isso é verificado: a forma
-- fechada é `round(débito * dias * taxa / 100, 2)` e o percurso, com um só
-- segmento, calcula a mesma expressão.
--
-- ------------------------------------------------------------
-- Uma correcção que vem a par
--
-- A multa passa a incidir sobre o principal em aberto NA DATA DO VENCIMENTO,
-- e não sobre o débito original. Antes, quem pagasse metade uma semana antes
-- do vencimento e se atrasasse no resto levava multa sobre o total — 2% de uma
-- dívida que já não existia nesse dia. A multa é pelo atraso, e só se atrasa o
-- que estava em dívida quando venceu.
--
-- Sem pagamentos antecipados, que é o caso corrente, o valor é o mesmo de
-- antes.
-- ============================================================

-- ------------------------------------------------------------
-- Percurso sequencial de uma cobrança: a regra de imputação vive aqui.
--
-- Três fases, pela ordem do tempo:
--
--   1. Pagamentos até ao vencimento. Ainda não há atraso, logo não há juros
--      nem multa a imputar: abatem ao principal.
--   2. O vencimento. A multa é lançada, uma vez, sobre o que ficou em aberto.
--   3. Pagamentos depois do vencimento. Por cada um: correm-se os juros do
--      principal desde o evento anterior, e o pagamento é imputado aos juros
--      vencidos, depois à multa, e só o que sobrar ao capital.
--
-- Devolve os encargos LANÇADOS, não os que faltam pagar: `cobrancas.multa` e
-- `cobrancas.juros` guardam o que foi debitado, e o saldo devedor é
-- `valor + multa + juros - desconto - valor_pago`. A imputação não muda esse
-- total — muda quanto de cada pagamento deixa de render juros, e portanto os
-- juros que se lançam a partir daí.
--
-- Interna: sem verificação de permissões, revogada de todos os roles, chamada
-- só de `_encargos_devidos`, que corre com os privilégios do dono.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._encargos_cobranca(
  _cobranca_id uuid,
  _referencia date
)
RETURNS TABLE(multa numeric, juros numeric, dias_atraso int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref date;
  _venc date;
  _multa_pct numeric;
  _juros_pct numeric;

  _saldo numeric;                  -- principal ainda em aberto
  _multa_lancada numeric;          -- multa debitada (uma vez)
  _multa_aberta numeric;           -- parte da multa ainda não coberta
  _juros_lancados numeric := 0;    -- total de juros debitados
  _juros_abertos numeric := 0;     -- juros debitados e ainda não cobertos
  _marco date;                     -- data do último evento já processado

  _p RECORD;
  _sobra numeric;
  _imputado numeric;
BEGIN
  SELECT c.vencimento,
         GREATEST(c.valor - c.desconto, 0),
         COALESCE(cp.multa_percentual, 2.00),
         COALESCE(cp.juros_dia_percentual, 0.0333)
    INTO _venc, _saldo, _multa_pct, _juros_pct
    FROM public.cobrancas c
    LEFT JOIN public.config_pagamento cp ON cp.condominio_id = c.condominio_id
   WHERE c.id = _cobranca_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  _ref := COALESCE(_referencia, (now() AT TIME ZONE 'America/Sao_Paulo')::date);

  IF _ref <= _venc THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0;
    RETURN;
  END IF;

  -- Fase 1: o que foi pago até ao vencimento abate ao principal.
  SELECT GREATEST(_saldo - COALESCE(sum(p.valor), 0), 0) INTO _saldo
    FROM public.pagamentos p
   WHERE p.cobranca_id = _cobranca_id
     AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date <= _venc;

  -- Fase 2: a multa, sobre o que ficou em dívida no dia do vencimento.
  _multa_lancada := round(_saldo * _multa_pct / 100, 2);
  _multa_aberta := _multa_lancada;
  _marco := _venc;

  -- Fase 3: os pagamentos em atraso, por ordem.
  FOR _p IN
    SELECT p.valor,
           (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia
      FROM public.pagamentos p
     WHERE p.cobranca_id = _cobranca_id
       AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date > _venc
       AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date <= _ref
     ORDER BY p.pago_em, p.id
  LOOP
    -- Juros corridos do principal desde o evento anterior.
    _imputado := round(_saldo * _juros_pct / 100 * (_p.dia - _marco), 2);
    _juros_lancados := _juros_lancados + _imputado;
    _juros_abertos := _juros_abertos + _imputado;
    _marco := _p.dia;

    -- Art. 354: juros vencidos, depois a multa, e só então o capital.
    _sobra := _p.valor;

    _imputado := LEAST(_sobra, _juros_abertos);
    _juros_abertos := _juros_abertos - _imputado;
    _sobra := _sobra - _imputado;

    _imputado := LEAST(_sobra, _multa_aberta);
    _multa_aberta := _multa_aberta - _imputado;
    _sobra := _sobra - _imputado;

    _saldo := GREATEST(_saldo - _sobra, 0);
  END LOOP;

  -- E os juros do último evento até à data de referência.
  _juros_lancados := _juros_lancados
    + round(_saldo * _juros_pct / 100 * (_ref - _marco), 2);

  RETURN QUERY SELECT _multa_lancada, _juros_lancados, (_ref - _venc)::int;
END;
$$;

REVOKE ALL ON FUNCTION public._encargos_cobranca(uuid, date)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Os encargos devidos, agora em dois caminhos.
--
-- Mesma assinatura e mesmo contrato de antes: devolve uma linha por cobrança
-- em atraso e em aberto, e nada para as que não estão. Quem a chama
-- (`_aplicar_encargos`, `calcular_encargos_cobranca`) não muda.
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
           (_ref - c.vencimento) AS dias,
           EXISTS (SELECT 1 FROM public.pagamentos p WHERE p.cobranca_id = c.id) AS tem_pagamentos
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
  )
  -- Sem pagamentos: não há nada a imputar, e a forma fechada é a mesma conta
  -- que o percurso faria com um único segmento.
  SELECT a.id,
         round(a.debito * t.multa_pct / 100, 2),
         round(a.debito * a.dias * t.juros_pct / 100, 2),
         a.dias::int
    FROM alvo a
    JOIN taxa t ON t.id = a.id
   WHERE NOT a.tem_pagamentos

  UNION ALL

  -- Com pagamentos: percurso sequencial, que é o único modo de aplicar o
  -- art. 354.
  SELECT a.id, e.multa, e.juros, e.dias_atraso
    FROM alvo a
   CROSS JOIN LATERAL public._encargos_cobranca(a.id, _ref) e
   WHERE a.tem_pagamentos;
END;
$$;

REVOKE ALL ON FUNCTION public._encargos_devidos(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated;
