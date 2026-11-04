-- ============================================================
-- Rateio por fração ideal
--
-- `unidades.fracao_ideal` existe desde a primeira migração e nunca foi usada:
-- `gerar_cobrancas_lote` só sabia dois modos — a taxa fixa de cada unidade, ou
-- um valor igual para todas. O segundo é o que se usa numa taxa extra, e divide
-- uma obra de 50 mil reais em partes iguais entre a cobertura e a quitinete.
--
-- O art. 1.336, I do Código Civil manda contribuir na proporção da fração
-- ideal, salvo disposição em contrário da convenção. Esta migração acrescenta
-- esse terceiro modo.
--
-- O `_usar_taxa_unidade boolean` dá lugar a `_modo text`, porque passaram a ser
-- três hipóteses e um booleano já não as exprime. A assinatura muda, logo a
-- função antiga é removida em vez de substituída — não queremos as duas
-- expostas no PostgREST ao mesmo tempo.
-- ============================================================

-- ------------------------------------------------------------
-- Reparte um total pelas unidades, na proporção da fração ideal.
--
-- A divisão é feita em centavos pelo método do maior resto: trunca-se a quota
-- de cada unidade ao centavo e distribui-se o que sobrar pelas maiores partes
-- fraccionárias. Sem isso a soma das quotas arredondadas quase nunca bate
-- certo com o total, e um balancete que não fecha por três centavos é um
-- balancete que ninguém assina.
--
-- O denominador é a soma das frações do condomínio, não 1 nem 100: assim
-- funciona tanto com frações decimais (0,023456) como com percentagens
-- (2,3456), que é como cada convenção entende dar-lhes.
--
-- SECURITY INVOKER de propósito. A função é exposta no PostgREST a qualquer
-- utilizador autenticado, e com SECURITY DEFINER ignorava o RLS de `unidades`:
-- bastava passar o id de outro condomínio para receber todas as suas unidades
-- e, dividindo cada quota pelo total, a fração exacta de cada uma. Como
-- INVOKER, o RLS continua a valer mesmo que a verificação abaixo falhe um dia.
--
-- Chamada de dentro de `gerar_cobrancas_lote`, que é SECURITY DEFINER, corre
-- com os privilégios do dono e vê o condomínio inteiro — que é o que a geração
-- precisa. `auth.uid()` devolve sempre o utilizador real nos dois caminhos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ratear_por_fracao_ideal(
  _condominio_id uuid,
  _total numeric
)
RETURNS TABLE(unidade_id uuid, valor numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _soma numeric;
  _sem_fracao int;
  _centavos_total bigint;
BEGIN
  -- Antes de qualquer leitura e de qualquer erro de negócio: a contagem de
  -- unidades sem fração, que a mensagem de `fracao_ideal_em_falta` devolve,
  -- já diria a um estranho quantas unidades o condomínio tem.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF COALESCE(_total, 0) <= 0 THEN
    RAISE EXCEPTION 'total_invalido';
  END IF;

  -- Ratear com frações em falta produziria uma cobrança errada em silêncio,
  -- que é pior do que não gerar nada. Falha alto e diz quantas faltam.
  SELECT count(*) INTO _sem_fracao
    FROM public.unidades u
   WHERE u.condominio_id = _condominio_id
     AND (u.fracao_ideal IS NULL OR u.fracao_ideal <= 0);

  IF _sem_fracao > 0 THEN
    RAISE EXCEPTION 'fracao_ideal_em_falta'
      USING HINT = _sem_fracao || ' unidade(s) sem fração ideal preenchida.';
  END IF;

  SELECT COALESCE(sum(u.fracao_ideal), 0) INTO _soma
    FROM public.unidades u
   WHERE u.condominio_id = _condominio_id;

  IF _soma <= 0 THEN
    RAISE EXCEPTION 'condominio_sem_unidades';
  END IF;

  _centavos_total := round(_total * 100);

  RETURN QUERY
  WITH exato AS (
    SELECT u.id,
           u.fracao_ideal,
           (_centavos_total * u.fracao_ideal) / _soma AS centavos
      FROM public.unidades u
     WHERE u.condominio_id = _condominio_id
  ),
  truncado AS (
    SELECT id,
           floor(centavos)::bigint AS centavos,
           centavos - floor(centavos) AS resto,
           fracao_ideal
      FROM exato
  ),
  -- Desempate determinístico (resto, depois fração, depois id): correr duas
  -- vezes com os mesmos dados tem de dar exactamente o mesmo rateio.
  ordenado AS (
    SELECT id,
           centavos,
           row_number() OVER (ORDER BY resto DESC, fracao_ideal DESC, id) AS posicao
      FROM truncado
  ),
  sobra AS (
    SELECT _centavos_total - COALESCE(sum(centavos), 0) AS n FROM truncado
  )
  SELECT o.id,
         (o.centavos + CASE WHEN o.posicao <= (SELECT n FROM sobra) THEN 1 ELSE 0 END)::numeric / 100
    FROM ordenado o;
END;
$$;

REVOKE ALL ON FUNCTION public.ratear_por_fracao_ideal(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ratear_por_fracao_ideal(uuid, numeric) TO authenticated;

-- ------------------------------------------------------------
-- Geração de cobranças em lote, agora com três modos.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.gerar_cobrancas_lote(uuid, uuid, date, date, text, boolean, numeric);

CREATE FUNCTION public.gerar_cobrancas_lote(
  _condominio_id uuid,
  _categoria_id uuid,
  _competencia date,
  _vencimento date,
  _descricao text,
  _modo text,      -- 'taxa_unidade' | 'valor_unico' | 'fracao_ideal'
  _valor numeric   -- 'valor_unico': por unidade. 'fracao_ideal': total a ratear.
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _count int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Era `is_sindico OR is_contador`, o que deixava de fora o perfil
  -- `financeiro` — que as políticas RLS já aceitam desde `rls_perfil_financeiro`.
  -- Quem pode inserir uma cobrança à mão tem de poder gerá-las em lote.
  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _modo NOT IN ('taxa_unidade', 'valor_unico', 'fracao_ideal') THEN
    RAISE EXCEPTION 'modo_invalido';
  END IF;

  IF _modo = 'fracao_ideal' THEN
    -- O rateio é sempre sobre TODAS as unidades do condomínio, mesmo as que já
    -- têm cobrança nesta competência e categoria: cada unidade deve a sua
    -- quota-parte e não a de mais ninguém. As que já têm são saltadas na
    -- inserção, pelo que o total inserido fica abaixo do rateado — e é isso
    -- que se quer, porque a diferença já está cobrada.
    INSERT INTO public.cobrancas (
      condominio_id, unidade_id, categoria_id, competencia, vencimento,
      valor, descricao, criado_por, status
    )
    SELECT _condominio_id, r.unidade_id, _categoria_id, _competencia, _vencimento,
           r.valor, _descricao, _uid, 'pendente'
      FROM public.ratear_por_fracao_ideal(_condominio_id, _valor) r
     WHERE NOT EXISTS (
       SELECT 1 FROM public.cobrancas c
        WHERE c.unidade_id = r.unidade_id
          AND c.competencia = _competencia
          AND c.categoria_id IS NOT DISTINCT FROM _categoria_id
     );

  ELSE
    INSERT INTO public.cobrancas (
      condominio_id, unidade_id, categoria_id, competencia, vencimento,
      valor, descricao, criado_por, status
    )
    SELECT
      _condominio_id,
      u.id,
      _categoria_id,
      _competencia,
      _vencimento,
      CASE
        WHEN _modo = 'taxa_unidade' AND u.taxa_mensal IS NOT NULL AND u.taxa_mensal > 0
          THEN u.taxa_mensal
        ELSE COALESCE(_valor, 0)
      END,
      _descricao,
      _uid,
      'pendente'
    FROM public.unidades u
    WHERE u.condominio_id = _condominio_id
      AND NOT EXISTS (
        SELECT 1 FROM public.cobrancas c
        WHERE c.unidade_id = u.id
          AND c.competencia = _competencia
          AND c.categoria_id IS NOT DISTINCT FROM _categoria_id
      );
  END IF;

  GET DIAGNOSTICS _count = ROW_COUNT;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, metadata)
  VALUES (_condominio_id, _uid, 'cobrancas_geradas', 'cobrancas',
          jsonb_build_object(
            'count', _count,
            'competencia', _competencia,
            'modo', _modo,
            'valor', _valor
          ));

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_cobrancas_lote(uuid, uuid, date, date, text, text, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_cobrancas_lote(uuid, uuid, date, date, text, text, numeric)
  TO authenticated;
