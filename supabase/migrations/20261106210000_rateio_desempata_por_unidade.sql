-- ============================================================
-- O centavo que sobra passa a ter um dono explicável
--
-- O rateio por fração ideal divide em centavos pelo método do maior resto:
-- trunca-se a quota de cada unidade e distribui-se o que sobrou pelas maiores
-- partes fraccionárias. Quando os restos empatam — e empatam sempre que as
-- frações são iguais, que é o caso de qualquer prédio de plantas repetidas —
-- alguém tem de ficar com o centravo a mais.
--
-- Até aqui esse alguém era decidido pelo `id`, isto é, por um uuid aleatório.
-- Funcionava e era determinístico, que era o requisito: correr duas vezes dava
-- o mesmo resultado. Mas não é explicável.
--
-- Num condomínio de quatro unidades com 25% cada e uma obra de 1.000,01, uma
-- delas paga 250,01 e as outras 250,00. Quando o condómino da 104 pergunta por
-- que é que foi ele, "porque o identificador interno da sua unidade vem antes
-- na ordenação" não é uma resposta que se dê numa assembleia. "Porque é a
-- primeira, por bloco e número" é.
--
-- A ordem por número NÃO é alfabética: o `numero` é texto, e em texto a
-- unidade "10" vem antes da "9". Extraem-se os dígitos e compara-se como
-- número, com o texto como critério seguinte para os casos em que o número
-- tem letras ("101-A"). O `id` fica no fim, para a ordenação continuar total
-- se um dia existirem duas unidades com o mesmo bloco e número.
--
-- O que isto NÃO muda: o total rateado, a soma das quotas, nem o número de
-- centavos distribuídos. Muda a qual unidade vai cada um deles.
-- ============================================================

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
           u.bloco,
           u.numero,
           (_centavos_total * u.fracao_ideal) / _soma AS centavos
      FROM public.unidades u
     WHERE u.condominio_id = _condominio_id
  ),
  truncado AS (
    SELECT id,
           floor(centavos)::bigint AS centavos,
           centavos - floor(centavos) AS resto,
           fracao_ideal,
           bloco,
           numero
      FROM exato
  ),
  -- Desempate determinístico E explicável: resto, fração, e depois a unidade
  -- pela ordem em que aparece numa lista — bloco, número. O `id` só entra no
  -- fim, para a ordenação ser total mesmo se houver duas unidades iguais.
  ordenado AS (
    SELECT id,
           centavos,
           row_number() OVER (
             ORDER BY resto DESC,
                      fracao_ideal DESC,
                      COALESCE(bloco, '') ,
                      -- Os dígitos do número, como número: em texto a "10"
                      -- vinha antes da "9".
                      NULLIF(regexp_replace(COALESCE(numero, ''), '\D', '', 'g'), '')::bigint
                        NULLS LAST,
                      numero,
                      id
           ) AS posicao
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
