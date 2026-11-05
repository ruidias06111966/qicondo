-- Índices económicos, vindos do Banco Central.
--
-- POR QUE EXISTE
--
-- Na fase anterior o síndico escolhia o rótulo do índice e digitava o
-- percentual. Digitar o IPCA acumulado é das coisas em que mais se erra: ou se
-- usa a variação do mês em vez da do ano, ou se copia um número de uma notícia
-- de três meses atrás. O orçamento inteiro assenta nesse número.
--
-- DE ONDE VEM
--
-- O SGS do Banco Central publica as quatro séries em JSON, sem chave e sem
-- registo. Os códigos foram confirmados contra a API, comparando seis meses de
-- cada uma — e não tirados de memória:
--
--   433   IPCA     variação % mensal
--   188   INPC     variação % mensal
--   189   IGP-M    variação % mensal
--   7456  INCC-M   variação % mensal
--
-- O INCC tem duas séries na SGS: a 192, que acompanha o IGP-DI e fica um mês
-- atrás, e a 7456, que é o componente do IGP-M e sai ao mesmo tempo que ele.
-- Usa-se a 7456 por ser a mais actual. Quem orça uma obra em Dezembro quer o
-- número de Novembro, não o de Outubro.
--
-- GUARDA-SE O MÊS, NÃO O ACUMULADO
--
-- O que a API dá é a variação de cada mês. O acumulado de doze meses calcula-se
-- a partir dela, e é composto e não somado:
--
--   acumulado = (Π (1 + vᵢ/100) − 1) × 100
--
-- Somar doze variações de 0,5% dá 6,00%; compor dá 6,17%. Num orçamento de
-- 500 mil são 850 reais de diferença — pouco, mas é a conta errada, e a conta
-- errada não se defende em assembleia.
--
-- Guardar o mês e compor na leitura também deixa calcular o acumulado até
-- qualquer data: o orçamento de 2027 feito em Outubro usa os doze meses até
-- Setembro, e não os doze meses até hoje.
--
-- SEM CONDOMÍNIO
--
-- Esta tabela não tem `condominio_id`. O IPCA é o mesmo para toda a gente, e
-- replicá-lo por condomínio seria guardar a mesma linha mil vezes para nada.
-- É público, lê-se com sessão iniciada, e escreve-se só pela função.


CREATE TABLE public.indices_economicos (
  indice public.indice_reajuste NOT NULL,
  competencia date NOT NULL,
  variacao numeric(8,4) NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT indices_economicos_pk PRIMARY KEY (indice, competencia),

  -- O enum serve as rubricas do orçamento e tem mais valores do que os quatro
  -- que se publicam. `cct`, `tarifa`, `manual` e `nenhum` não vêm de série
  -- nenhuma, e não podem entrar aqui.
  CONSTRAINT indice_e_publicado CHECK (indice IN ('ipca', 'inpc', 'igpm', 'incc')),

  -- Competência é sempre o primeiro dia do mês: sem isto, o mesmo mês entrava
  -- duas vezes com dias diferentes e o acumulado contava-o duas vezes.
  CONSTRAINT indice_competencia_e_mes CHECK (competencia = date_trunc('month', competencia)::date)
);

COMMENT ON TABLE public.indices_economicos IS
  'Variação mensal dos índices publicados, vinda do SGS do Banco Central. O acumulado calcula-se na leitura, composto.';

CREATE INDEX idx_indices_economicos_leitura
  ON public.indices_economicos (indice, competencia DESC);

ALTER TABLE public.indices_economicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer sessão lê os índices" ON public.indices_economicos
  FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.indices_economicos FROM authenticated, anon;
GRANT SELECT ON public.indices_economicos TO authenticated;


-- ============================================================
-- GRAVAR O QUE VEIO DA API
-- ============================================================
-- Recebe o que a aplicação leu do Banco Central. Não vai à rede: o Postgres do
-- Supabase não faz chamadas HTTP, e dar-lhe essa capacidade por causa disto
-- seria abrir muito para ganhar pouco.
--
-- Qualquer sessão autenticada pode actualizar. É dado público e a mesma série
-- para toda a gente: restringir ao síndico só faria o morador ver um número
-- velho.

CREATE OR REPLACE FUNCTION public.registrar_indices(_dados jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF jsonb_typeof(_dados) <> 'array' THEN
    RAISE EXCEPTION 'dados_invalidos' USING HINT = 'Esperava uma lista de medições.';
  END IF;

  -- O CHECK já recusa, mas com a mensagem crua do Postgres, que o cliente
  -- transforma num "Operação falhou". Vale mais recusar aqui e dizer porquê.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_dados) x
     WHERE (x->>'indice') NOT IN ('ipca', 'inpc', 'igpm', 'incc')
  ) THEN
    RAISE EXCEPTION 'indice_nao_publicado'
      USING HINT = 'Só IPCA, INPC, IGP-M e INCC vêm de série publicada. Os outros são escolha de quem orça.';
  END IF;

  INSERT INTO public.indices_economicos (indice, competencia, variacao, atualizado_em)
  SELECT (x->>'indice')::public.indice_reajuste,
         date_trunc('month', (x->>'competencia')::date)::date,
         (x->>'variacao')::numeric,
         now()
    FROM jsonb_array_elements(_dados) x
  ON CONFLICT (indice, competencia) DO UPDATE
    SET variacao = EXCLUDED.variacao, atualizado_em = now()
    -- Só escreve quando o número mudou. O IBGE revê séries, e quando revê
    -- interessa saber quando é que isso aconteceu; nas outras vezes, mexer no
    -- `atualizado_em` só esconderia essa informação.
    WHERE public.indices_economicos.variacao IS DISTINCT FROM EXCLUDED.variacao;

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_indices(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_indices(jsonb) TO authenticated;


-- ============================================================
-- O ACUMULADO DE DOZE MESES
-- ============================================================

CREATE OR REPLACE FUNCTION public.acumulado_12m(
  _indice public.indice_reajuste,
  _ate date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fim date;
  _produto numeric;
  _meses int;
  _primeira date;
  _ultima date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  _fim := date_trunc('month', COALESCE(_ate, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date;

  SELECT exp(sum(ln(1 + v.variacao / 100.0))), count(*), min(v.competencia), max(v.competencia)
    INTO _produto, _meses, _primeira, _ultima
    FROM (
      SELECT i.competencia, i.variacao
        FROM public.indices_economicos i
       WHERE i.indice = _indice
         AND i.competencia <= _fim
         -- Uma deflação de -100% ou pior tornaria o logaritmo indefinido.
         -- Nunca aconteceu em nenhuma destas séries; a verificação está aqui
         -- para a função não rebentar se acontecer.
         AND i.variacao > -100
       ORDER BY i.competencia DESC
       LIMIT 12
    ) v;

  IF _meses IS NULL OR _meses = 0 THEN
    RETURN jsonb_build_object(
      'indice', _indice, 'meses', 0, 'acumulado', NULL, 'completo', false,
      'primeira', NULL, 'ultima', NULL);
  END IF;

  RETURN jsonb_build_object(
    'indice', _indice,
    'meses', _meses,
    'acumulado', round((_produto - 1) * 100, 2),
    -- Doze meses ou não. Com menos, o número continua a dizer alguma coisa,
    -- mas não é o acumulado do ano e quem o lê tem de o saber.
    'completo', _meses = 12,
    'primeira', _primeira,
    'ultima', _ultima
  );
END;
$$;

REVOKE ALL ON FUNCTION public.acumulado_12m(public.indice_reajuste, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acumulado_12m(public.indice_reajuste, date) TO authenticated;


-- Os quatro de uma vez, que é como o ecrã do orçamento precisa deles.

CREATE OR REPLACE FUNCTION public.indices_para_orcamento(_ate date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(public.acumulado_12m(i, _ate) ORDER BY i), '[]'::jsonb)
      FROM unnest(ARRAY['ipca', 'inpc', 'igpm', 'incc']::public.indice_reajuste[]) i
  );
END;
$$;

REVOKE ALL ON FUNCTION public.indices_para_orcamento(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indices_para_orcamento(date) TO authenticated;
