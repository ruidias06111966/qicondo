-- Do orçamento aprovado para as cobranças do ano.
--
-- O QUE ESTE PASSO É
--
-- A assembleia aprovou um orçamento e, com ele, a quota de cada unidade. Este
-- é o passo que transforma a decisão em cobranças: escreve a nova taxa em cada
-- unidade e gera os doze lotes do ano.
--
-- POR QUE NÃO É AUTOMÁTICO
--
-- Aprovar e cobrar são momentos diferentes. A assembleia aprova em Novembro e
-- a cobrança começa em Janeiro; entre uma coisa e outra há actas a lavrar e,
-- às vezes, uma impugnação. Um orçamento que gerasse cobranças no instante da
-- aprovação tiraria essa folga a quem gere.
--
-- O QUE FICA GUARDADO, E PORQUÊ
--
-- A taxa anterior de cada unidade vai para o `audit_log`. Aplicar um orçamento
-- reescreve a taxa de todas as unidades de uma vez, e sem o registo do que lá
-- estava não há como voltar atrás senão de memória.
--
-- O DIA DO VENCIMENTO
--
-- Pedido uma vez e usado nos doze meses. Nos meses em que o dia não existe —
-- 31 em Abril, 30 em Fevereiro — cai no último dia do mês, que é o que
-- qualquer convenção entende por "vence no dia 30".
--
-- CORRER DUAS VEZES NÃO DUPLICA
--
-- `gerar_cobrancas_lote` salta as unidades que já têm cobrança naquela
-- competência e categoria. Quem aplicar o orçamento outra vez — por engano, ou
-- para gerar os meses que faltavam — não cria segunda cobrança a ninguém.


ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS aplicado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aplicado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orcamentos.aplicado_em IS
  'Quando as cobranças do ano foram geradas a partir deste orçamento. Nulo enquanto for só uma decisão.';


CREATE OR REPLACE FUNCTION public.aplicar_orcamento(
  _orcamento_id uuid,
  _categoria_id uuid,
  _dia_vencimento integer DEFAULT 10,
  _ate_mes integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orcamentos%ROWTYPE;
  _anterior jsonb;
  _unidades int := 0;
  _geradas int := 0;
  _n int;
  _m int;
  _competencia date;
  _vencimento date;
  _cat record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _o FROM public.orcamentos WHERE id = _orcamento_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'orcamento_nao_encontrado'; END IF;
  IF NOT public.is_sindico(_uid, _o.condominio_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _o.status <> 'aprovado' THEN
    RAISE EXCEPTION 'orcamento_nao_aprovado'
      USING HINT = 'Só se cobra o que a assembleia aprovou. Aprove o orçamento primeiro.';
  END IF;

  IF _dia_vencimento IS NULL OR _dia_vencimento < 1 OR _dia_vencimento > 31 THEN
    RAISE EXCEPTION 'dia_invalido' USING HINT = 'O dia do vencimento vai de 1 a 31.';
  END IF;

  IF _ate_mes IS NULL OR _ate_mes < 1 OR _ate_mes > 12 THEN
    RAISE EXCEPTION 'periodo_invalido' USING HINT = 'Os meses a gerar vão de 1 a 12.';
  END IF;

  -- A categoria da receita tem de ser deste condomínio e tem de ser receita:
  -- uma quota lançada numa categoria de despesa entra no balancete pelo lado
  -- errado e só se dá por isso no fecho do mês.
  SELECT c.id, c.tipo INTO _cat
    FROM public.categorias_financeiras c
   WHERE c.id = _categoria_id AND c.condominio_id = _o.condominio_id;
  IF _cat.id IS NULL THEN RAISE EXCEPTION 'categoria_invalida'; END IF;
  IF _cat.tipo <> 'receita' THEN
    RAISE EXCEPTION 'categoria_invalida'
      USING HINT = 'A quota é receita. Escolha uma categoria de receita.';
  END IF;

  -- O que lá estava, antes de ser substituído. Ver o cabeçalho.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'unidade_id', u.id, 'taxa_mensal', u.taxa_mensal) ORDER BY u.id), '[]'::jsonb)
    INTO _anterior
    FROM public.unidades u
   WHERE u.condominio_id = _o.condominio_id;

  -- A quota de cada unidade, pela fração ideal. Recusa se faltar a fração a
  -- alguma, e é bom que recuse: metade das unidades com quota nova e metade
  -- com a antiga é pior do que não aplicar.
  UPDATE public.unidades u
     SET taxa_mensal = q.quota_mensal
    FROM public.quotas_do_orcamento(_orcamento_id) q
   WHERE u.id = q.unidade_id;

  GET DIAGNOSTICS _unidades = ROW_COUNT;

  -- Os doze lotes, um por mês.
  FOR _m IN 1.._ate_mes LOOP
    _competencia := make_date(_o.ano, _m, 1);
    -- O dia pedido, ou o último do mês quando esse dia não existe.
    _vencimento := _competencia
      + (LEAST(_dia_vencimento,
               extract(day FROM (_competencia + interval '1 month - 1 day'))::int) - 1);

    _n := public.gerar_cobrancas_lote(
      _o.condominio_id, _categoria_id, _competencia, _vencimento,
      format('Taxa condominial %s/%s', to_char(_competencia, 'MM'), _o.ano),
      'taxa_unidade', NULL);

    _geradas := _geradas + _n;
  END LOOP;

  UPDATE public.orcamentos
     SET aplicado_em = now(), aplicado_por = _uid
   WHERE id = _orcamento_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_o.condominio_id, _uid, 'orcamento_aplicado', 'orcamentos', _orcamento_id,
          jsonb_build_object(
            'ano', _o.ano,
            'dia_vencimento', _dia_vencimento,
            'meses', _ate_mes,
            'unidades_actualizadas', _unidades,
            'cobrancas_geradas', _geradas,
            'categoria_id', _categoria_id,
            -- É isto que permite desfazer.
            'taxas_anteriores', _anterior));

  RETURN jsonb_build_object(
    'ano', _o.ano,
    'unidades_actualizadas', _unidades,
    'cobrancas_geradas', _geradas,
    'meses', _ate_mes,
    'dia_vencimento', _dia_vencimento
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_orcamento(uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_orcamento(uuid, uuid, integer, integer) TO authenticated;
