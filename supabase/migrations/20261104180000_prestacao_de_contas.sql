-- ============================================================
-- Prestação de contas: o balancete
--
-- O sistema registava receitas e despesas e nunca as juntou num documento. O
-- painel financeiro mostra totais do mês corrente e `resumoFinanceiro` devolve
-- quatro números soltos — nada disso é uma prestação de contas. Faltava o que o
-- art. 1.348, VIII do Código Civil obriga o síndico a fazer: prestar contas à
-- assembleia.
--
-- Pior: `despesas` só é legível por síndico, contador e financeiro. Um condómino
-- nunca pôde ver em que é que o dinheiro dele foi gasto. É exactamente a lacuna
-- que esta migração fecha.
--
-- ------------------------------------------------------------
-- Três decisões, e porque é que são estas
--
-- 1. REGIME DE CAIXA. O balancete reporta o que entrou e saiu no período:
--    receitas são `pagamentos` pela data de recebimento, despesas são
--    `despesas` pela data de pagamento. Não são cobranças emitidas. Um
--    balancete de condomínio é um extracto, não um resultado por competência —
--    o condómino quer saber onde está o dinheiro, não quanto foi faturado.
--
--    O lado da competência não desaparece: a inadimplência à data de fecho vai
--    no mesmo documento. Um saldo bonito com 40 mil em atraso por cobrar não
--    é um saldo bonito, e esconder isso seria o erro inverso.
--
-- 2. FOTOGRAFIA, NÃO VISTA AO VIVO. Ao fechar, os números e as linhas ficam
--    gravados na linha do balancete. Não são recalculados depois.
--
--    Uma prestação de contas que muda depois de ser apresentada não é uma
--    prestação de contas. Se o síndico corrigir uma despesa de Março, o
--    balancete de Março que a assembleia já viu não pode reescrever-se a si
--    mesmo em silêncio — reabre-se, corrige-se e republica-se, e isso fica no
--    `audit_log`.
--
-- 3. O ACESSO É A PUBLICAÇÃO. Em vez de abrir `despesas` aos moradores — o que
--    lhes daria todas as linhas, fornecedores e anexos, incluindo as que ainda
--    estão a ser corrigidas — o síndico publica o balancete, e é a fotografia
--    publicada que os condóminos leem. É o "o síndico dá acesso aos condóminos"
--    com um momento de decisão pelo meio, que é como funciona no papel.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'balancete_status') THEN
    CREATE TYPE public.balancete_status AS ENUM ('rascunho', 'publicado');
  END IF;
END $$;

-- ------------------------------------------------------------
-- Saldo de abertura.
--
-- Um condomínio que adopta o sistema a meio da vida tem dinheiro no banco que
-- este sistema nunca viu. Sem isto, o saldo acumulado fica errado para sempre —
-- e um balancete cujo saldo não corresponde ao extracto bancário não serve para
-- nada.
--
-- `saldo_inicial_data` é a data a que o saldo se refere. Movimentos anteriores a
-- essa data são ignorados no acumulado, porque já estão dentro do saldo: sem
-- esse corte, lançar o histórico antigo contaria tudo duas vezes.
-- ------------------------------------------------------------
ALTER TABLE public.config_pagamento
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_inicial_data date;

-- ------------------------------------------------------------
-- Fundo de reserva.
--
-- No condomínio brasileiro o fundo de reserva não é receita corrente: é
-- poupança com destino próprio, e gastá-lo na despesa do mês é das coisas que
-- mais rapidamente põem um síndico em apuros. Misturá-lo no saldo operacional
-- faz o condomínio parecer mais folgado do que está.
--
-- Qual das categorias é fundo de reserva é decisão de quem lança, não adivinha
-- do nome: o `semearCategoriasPadrao` cria uma chamada "Fundo de reserva", mas
-- cada condomínio chama-lhe o que quer.
-- ------------------------------------------------------------
ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS fundo_reserva boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- O balancete fechado.
--
-- `dados` guarda a fotografia inteira: totais, desdobramento por categoria e as
-- linhas uma a uma. É jsonb e não tabelas-filho de propósito — o que se quer
-- preservar é o documento tal como foi apresentado, não um modelo normalizado
-- que as correcções posteriores vão arrastando atrás delas.
-- ------------------------------------------------------------
CREATE TABLE public.balancetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  status public.balancete_status NOT NULL DEFAULT 'rascunho',

  -- Desnormalizados para fora do jsonb: são o que se lista e ordena, e o que
  -- um condómino vê sem abrir o documento.
  saldo_anterior numeric(14,2) NOT NULL,
  total_receitas numeric(14,2) NOT NULL,
  total_despesas numeric(14,2) NOT NULL,
  saldo_final numeric(14,2) NOT NULL,
  inadimplencia numeric(14,2) NOT NULL DEFAULT 0,

  dados jsonb NOT NULL,
  observacoes text,

  fechado_em timestamptz NOT NULL DEFAULT now(),
  fechado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  publicado_em timestamptz,
  publicado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT periodo_valido CHECK (periodo_fim >= periodo_inicio),
  CONSTRAINT um_balancete_por_periodo UNIQUE (condominio_id, periodo_inicio, periodo_fim)
);

CREATE INDEX idx_balancetes_cond ON public.balancetes (condominio_id, periodo_inicio DESC);

CREATE TRIGGER trg_balancetes_upd BEFORE UPDATE ON public.balancetes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.balancetes ENABLE ROW LEVEL SECURITY;

-- Quem gere o financeiro vê tudo, rascunhos incluídos.
CREATE POLICY "Gestao financeira ve balancetes"
  ON public.balancetes FOR SELECT TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id));

-- O condómino vê os publicados, e só esses. É esta política que é a prestação
-- de contas: sem ela, o morador continuava sem ver despesa nenhuma.
CREATE POLICY "Membros veem balancetes publicados"
  ON public.balancetes FOR SELECT TO authenticated
  USING (status = 'publicado' AND public.is_member_of(auth.uid(), condominio_id));

CREATE POLICY "Gestao financeira gere balancetes"
  ON public.balancetes FOR ALL TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id))
  WITH CHECK (public.pode_gerir_financeiro(auth.uid(), condominio_id));

-- ------------------------------------------------------------
-- Calcula o balancete de um período, sem gravar nada.
--
-- Serve para o síndico ver antes de fechar, e é a mesma função que o fecho usa
-- — para não haver dois sítios a calcular o mesmo e a divergir.
--
-- Datas em São Paulo, como todo o resto do sistema: `pagamentos.pago_em` é
-- timestamptz, e um recebimento das 22h do dia 31 pertence a esse mês e não ao
-- seguinte.
-- ------------------------------------------------------------
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
  SELECT COALESCE(sum(GREATEST(c.valor + c.multa + c.juros - c.desconto - c.valor_pago, 0)), 0),
         count(*)::int,
         count(DISTINCT c.unidade_id)::int
    INTO _inad_total, _inad_cobrancas, _inad_unidades
    FROM public.cobrancas c
   WHERE c.condominio_id = _condominio_id
     AND c.status IN ('pendente', 'vencida', 'parcial')
     AND c.vencimento <= _fim;

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

-- ------------------------------------------------------------
-- Fecha o período: calcula e grava a fotografia.
--
-- Recusa se já houver um balancete publicado para o mesmo período. Para
-- refazer, reabre-se primeiro — e a reabertura fica registada. Sem essa recusa,
-- um fecho distraído reescrevia por cima do documento que a assembleia aprovou.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fechar_balancete(
  _condominio_id uuid,
  _inicio date,
  _fim date,
  _observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _dados jsonb;
  _id uuid;
  _status public.balancete_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT b.id, b.status INTO _id, _status
    FROM public.balancetes b
   WHERE b.condominio_id = _condominio_id
     AND b.periodo_inicio = _inicio
     AND b.periodo_fim = _fim;

  IF _status = 'publicado' THEN
    RAISE EXCEPTION 'balancete_publicado'
      USING HINT = 'Reabra o balancete antes de o refazer.';
  END IF;

  _dados := public.calcular_balancete(_condominio_id, _inicio, _fim);

  INSERT INTO public.balancetes (
    condominio_id, periodo_inicio, periodo_fim, status,
    saldo_anterior, total_receitas, total_despesas, saldo_final, inadimplencia,
    dados, observacoes, fechado_em, fechado_por
  ) VALUES (
    _condominio_id, _inicio, _fim, 'rascunho',
    (_dados->>'saldo_anterior')::numeric,
    (_dados->'receitas'->>'total')::numeric,
    (_dados->'despesas'->>'total')::numeric,
    (_dados->>'saldo_final')::numeric,
    (_dados->'inadimplencia'->>'total')::numeric,
    _dados, _observacoes, now(), _uid
  )
  ON CONFLICT (condominio_id, periodo_inicio, periodo_fim) DO UPDATE
    SET saldo_anterior = EXCLUDED.saldo_anterior,
        total_receitas = EXCLUDED.total_receitas,
        total_despesas = EXCLUDED.total_despesas,
        saldo_final    = EXCLUDED.saldo_final,
        inadimplencia  = EXCLUDED.inadimplencia,
        dados          = EXCLUDED.dados,
        observacoes    = COALESCE(EXCLUDED.observacoes, balancetes.observacoes),
        fechado_em     = now(),
        fechado_por    = EXCLUDED.fechado_por
  RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, _uid, 'balancete_fechado', 'balancetes', _id,
          jsonb_build_object('inicio', _inicio, 'fim', _fim,
                             'saldo_final', (_dados->>'saldo_final')::numeric));

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_balancete(uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_balancete(uuid, date, date, text) TO authenticated;

-- ------------------------------------------------------------
-- Publica: é aqui que os condóminos passam a ver.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publicar_balancete(_balancete_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT condominio_id INTO _cond FROM public.balancetes WHERE id = _balancete_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'balancete_nao_encontrado'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _cond) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.balancetes
     SET status = 'publicado', publicado_em = now(), publicado_por = _uid
   WHERE id = _balancete_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'balancete_publicado', 'balancetes', _balancete_id);
END;
$$;

REVOKE ALL ON FUNCTION public.publicar_balancete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_balancete(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Reabre um balancete publicado.
--
-- Existe porque erros existem, e a alternativa — publicar um balancete errado e
-- não poder corrigi-lo — é pior. Mas sai do alcance dos condóminos no momento
-- em que é reaberto, e fica no `audit_log` com quem o fez: um documento que
-- desaparece da vista de quem o leu tem de deixar rasto.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reabrir_balancete(_balancete_id uuid, _motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT condominio_id INTO _cond FROM public.balancetes WHERE id = _balancete_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'balancete_nao_encontrado'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _cond) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.balancetes
     SET status = 'rascunho', publicado_em = NULL, publicado_por = NULL
   WHERE id = _balancete_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'balancete_reaberto', 'balancetes', _balancete_id,
          jsonb_build_object('motivo', _motivo));
END;
$$;

REVOKE ALL ON FUNCTION public.reabrir_balancete(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_balancete(uuid, text) TO authenticated;
