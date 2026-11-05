-- ============================================================
-- AS TRÊS MIGRAÇÕES PENDENTES, NA ORDEM
-- ============================================================
--
-- Gerado a partir dos ficheiros de `supabase/migrations/`, sem uma linha
-- alterada. A ordem importa: o orçamento cria o tipo `indice_reajuste`, que os
-- índices usam; o fluxo de caixa é independente mas vai no fim para o registo
-- ficar coerente com os nomes dos ficheiros.
--
--   20261105190000  orçamento anual
--   20261105200000  índices económicos
--   20261105210000  fluxo de caixa
--
-- COMO CORRER
--
--   Supabase -> SQL Editor -> New query -> colar tudo -> Run
--
-- Correr duas vezes não é seguro: as três criam tabelas e tipos, e a segunda
-- passagem pára no primeiro `CREATE TYPE` que já existe. Se isso acontecer, é
-- sinal de que já estava aplicado — não é estrago.
--
-- Para conferir no fim, a consulta está no rodapé deste ficheiro.
-- ============================================================



-- ============================================================
-- 20261105190000_orcamento_anual.sql
-- ============================================================

-- Planilha orçamentária anual.
--
-- O QUE A LEI PEDE
--
-- O art. 1.350 manda o síndico convocar a assembleia anual para aprovar o
-- orçamento. Isto não é, portanto, um ecrã de contas: é um documento que vai à
-- AGO, que depois determina a quota de cada unidade pela fração ideal (art.
-- 1.336, I), e que fica como prova do que foi aprovado e com que fundamento.
--
-- Daí três coisas no desenho: o orçamento tem estado (rascunho → aprovado),
-- fica ligado à assembleia que o aprovou, e nada do que foi aprovado se
-- reescreve depois.
--
-- A BASE NÃO SE DIGITA
--
-- O ponto de partida de cada rubrica é o realizado do ano anterior, que o
-- sistema já tem nas despesas. Digitar à mão o que o banco sabe é convidar o
-- erro de transcrição e perder a comparação no fim do ano.
--
-- O ÍNDICE É POR RUBRICA, E NÃO UM SÓ
--
-- Aplicar um índice único ao total subestima o ano, de forma sistemática. A
-- estrutura de custo de um condomínio é dominada pela folha — porteiro,
-- zelador, limpeza —, que não segue inflação geral: segue a convenção
-- colectiva da categoria e o salário mínimo, que têm corrido acima do IPCA. E
-- água e energia não seguem índice nenhum: seguem o reajuste tarifário da
-- concessionária.
--
-- Por isso cada rubrica guarda o índice que foi usado e o percentual. Quem
-- escolhe é o síndico; o sistema regista o quê, quanto, e deixa o rasto. Numa
-- assembleia contestada, é essa a defesa.
--
-- A PROVISÃO DE INADIMPLÊNCIA
--
-- É a parte que a maioria dos sistemas não faz, e é a que quebra condomínios.
-- Se o orçamento prevê arrecadar exactamente o que vai gastar, e 8% das
-- unidades não paga, falta 8% em caixa a partir de Março.
--
-- E a correcção não é somar 8%. É dividir por (1 - 8%):
--
--   precisa de 100, recebe 92% do que lança  →  100 / 0,92 = 108,70
--   somar 8% daria 108, e receber-se-ia 99,36 — faltava na mesma
--
-- A diferença é pequena numa planilha e é exactamente o que falta em caixa.
--
-- O QUE ESTA MIGRAÇÃO NÃO FAZ
--
-- Não vai buscar os índices a lado nenhum. O síndico escolhe o índice e digita
-- o percentual. Puxar IPCA, INPC, IGP-M e INCC do Banco Central fica para
-- trabalho à parte, com o seu próprio agendamento — e não muda nada do que
-- está aqui, porque o percentual continua a ser gravado na rubrica.
--
-- Também não gera cobranças. O orçamento aprovado diz qual deve ser a quota;
-- transformá-la em doze lotes de cobranças e na taxa de cada unidade é outro
-- passo, e é um passo que se quer deliberado e não automático.


CREATE TYPE public.orcamento_status AS ENUM ('rascunho', 'aprovado');

-- O rótulo do que foi usado para projectar. `manual` é quando o síndico tem
-- número próprio — uma proposta de contrato já recebida, por exemplo — e
-- `nenhum` quando a rubrica não leva reajuste nenhum.
CREATE TYPE public.indice_reajuste AS ENUM (
  'ipca',     -- inflação oficial; serve a administração e os seguros
  'inpc',     -- consumo de rendimentos baixos; aproxima a folha
  'igpm',     -- tradicional nos aluguéis, volátil
  'incc',     -- custo da construção; obras e reformas
  'cct',      -- convenção colectiva da categoria; a folha a sério
  'tarifa',   -- reajuste da concessionária; água e energia
  'manual',   -- número próprio, com a razão na observação
  'nenhum'    -- rubrica que não reajusta
);


CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  ano_base integer NOT NULL,

  status public.orcamento_status NOT NULL DEFAULT 'rascunho',

  -- Percentagem a prever de quem não vai pagar. Ver o cabeçalho: entra como
  -- divisor e não como soma.
  inadimplencia_prevista numeric(5,2) NOT NULL DEFAULT 0,

  -- Fundo de reserva, em percentagem sobre a despesa prevista. O valor vem da
  -- convenção; o sistema não o inventa.
  fundo_reserva_percentual numeric(5,2) NOT NULL DEFAULT 0,

  premissas text,

  assembleia_id uuid REFERENCES public.assembleias(id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT orcamento_ano_unico UNIQUE (condominio_id, ano),
  CONSTRAINT orcamento_ano_valido CHECK (ano BETWEEN 2000 AND 2100),
  CONSTRAINT orcamento_base_anterior CHECK (ano_base < ano),
  CONSTRAINT orcamento_inadimplencia_valida
    CHECK (inadimplencia_prevista >= 0 AND inadimplencia_prevista < 100),
  CONSTRAINT orcamento_fundo_valido
    CHECK (fundo_reserva_percentual >= 0 AND fundo_reserva_percentual <= 100),
  CONSTRAINT orcamento_aprovado_tem_data
    CHECK (status <> 'aprovado' OR aprovado_em IS NOT NULL)
);

COMMENT ON TABLE public.orcamentos IS
  'Previsão anual de despesa, aprovada em assembleia (art. 1.350). Determina a quota de cada unidade pela fração ideal.';

COMMENT ON COLUMN public.orcamentos.inadimplencia_prevista IS
  'Percentagem que não se espera receber. Entra na conta como divisor: a arrecadar = necessidade / (1 - pct/100).';

CREATE INDEX idx_orcamentos_condominio ON public.orcamentos (condominio_id, ano DESC);


CREATE TABLE public.orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  -- Redundante por desenho: é o que deixa o gatilho de coerência verificar que
  -- a rubrica e a categoria são do mesmo condomínio.
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE,

  realizado_base numeric(14,2) NOT NULL DEFAULT 0,
  indice public.indice_reajuste NOT NULL DEFAULT 'manual',
  percentual numeric(6,2) NOT NULL DEFAULT 0,
  valor_previsto numeric(14,2) NOT NULL DEFAULT 0,
  observacao text,
  ordem integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT orcamento_item_unico UNIQUE (orcamento_id, categoria_id),
  CONSTRAINT orcamento_item_valor_nao_negativo CHECK (valor_previsto >= 0),
  -- Um reajuste de -100% zera a rubrica; abaixo disso não quer dizer nada.
  CONSTRAINT orcamento_item_percentual_valido CHECK (percentual > -100 AND percentual <= 1000)
);

CREATE INDEX idx_orcamento_itens_orcamento ON public.orcamento_itens (orcamento_id, ordem);
CREATE INDEX idx_orcamento_itens_categoria ON public.orcamento_itens (categoria_id);

CREATE TRIGGER touch_orcamentos BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_orcamento_itens BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_coerencia ON public.orcamentos;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'assembleia_id', 'assembleias');

DROP TRIGGER IF EXISTS trg_coerencia ON public.orcamento_itens;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'orcamento_id', 'orcamentos', 'categoria_id', 'categorias_financeiras');


-- ============================================================
-- QUEM VÊ
-- ============================================================
-- O orçamento aprovado é para os condóminos: foi aprovado em assembleia e é
-- por ele que pagam. O rascunho é de quem o prepara.

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro vê todos os orçamentos" ON public.orcamentos
  FOR SELECT USING (public.pode_gerir_financeiro(auth.uid(), condominio_id));

CREATE POLICY "Membro vê orçamento aprovado" ON public.orcamentos
  FOR SELECT USING (status = 'aprovado' AND public.is_member_of(auth.uid(), condominio_id));

CREATE POLICY "Financeiro vê todas as rubricas" ON public.orcamento_itens
  FOR SELECT USING (public.pode_gerir_financeiro(auth.uid(), condominio_id));

CREATE POLICY "Membro vê rubricas de orçamento aprovado" ON public.orcamento_itens
  FOR SELECT USING (
    public.is_member_of(auth.uid(), condominio_id)
    AND EXISTS (
      SELECT 1 FROM public.orcamentos o
       WHERE o.id = orcamento_id AND o.status = 'aprovado'
    )
  );

-- Só pelas funções: o que estas verificam — que o ano base tem dados, que o
-- orçamento aprovado não se reescreve — não se verifica numa política.
REVOKE INSERT, UPDATE, DELETE ON public.orcamentos FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.orcamento_itens FROM authenticated, anon;
GRANT SELECT ON public.orcamentos TO authenticated;
GRANT SELECT ON public.orcamento_itens TO authenticated;


-- ============================================================
-- O REALIZADO DO ANO BASE
-- ============================================================
-- A base de cada rubrica. Sai das despesas pagas, pela data do movimento —
-- regime de caixa, o mesmo do balancete, para que a planilha e a prestação de
-- contas falem do mesmo dinheiro.

CREATE OR REPLACE FUNCTION public.realizado_por_categoria(
  _condominio_id uuid,
  _ano integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'ano', _ano,
      'total', COALESCE(sum(x.valor), 0),
      -- Despesa sem categoria não entra em rubrica nenhuma, mas tem de
      -- aparecer: senão o total da planilha fica abaixo do que se gastou e
      -- ninguém percebe porquê.
      'sem_categoria', COALESCE(
        (SELECT sum(d.valor) FROM public.despesas d
          WHERE d.condominio_id = _condominio_id
            AND d.categoria_id IS NULL
            AND extract(year FROM d.data) = _ano), 0),
      'categorias', COALESCE(jsonb_agg(jsonb_build_object(
          'categoria_id', x.categoria_id,
          'nome', x.nome,
          'valor', x.valor) ORDER BY x.valor DESC), '[]'::jsonb)
    )
    FROM (
      SELECT c.id AS categoria_id, c.nome, COALESCE(sum(d.valor), 0) AS valor
        FROM public.categorias_financeiras c
        LEFT JOIN public.despesas d
          ON d.categoria_id = c.id
         AND d.condominio_id = _condominio_id
         AND extract(year FROM d.data) = _ano
       WHERE c.condominio_id = _condominio_id
         AND c.tipo = 'despesa'
         AND c.ativo
       GROUP BY c.id, c.nome
    ) x
  );
END;
$$;

REVOKE ALL ON FUNCTION public.realizado_por_categoria(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realizado_por_categoria(uuid, integer) TO authenticated;


-- ============================================================
-- CRIAR
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_orcamento(
  _condominio_id uuid,
  _ano integer,
  _ano_base integer,
  _inadimplencia numeric DEFAULT 0,
  _fundo_reserva numeric DEFAULT 0,
  _premissas text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _ano_base >= _ano THEN
    RAISE EXCEPTION 'ano_base_invalido'
      USING HINT = 'O ano base é o ano de onde sai o realizado, e tem de ser anterior ao ano orçado.';
  END IF;

  INSERT INTO public.orcamentos (
    condominio_id, ano, ano_base, inadimplencia_prevista,
    fundo_reserva_percentual, premissas, criado_por
  ) VALUES (
    _condominio_id, _ano, _ano_base, COALESCE(_inadimplencia, 0),
    COALESCE(_fundo_reserva, 0), NULLIF(trim(COALESCE(_premissas, '')), ''), _uid
  ) RETURNING id INTO _id;

  -- Uma rubrica por categoria de despesa activa, com o realizado do ano base
  -- já lá. Entram também as categorias que não tiveram movimento: o síndico
  -- pode querer orçar uma obra que ainda não existiu.
  INSERT INTO public.orcamento_itens (
    orcamento_id, condominio_id, categoria_id, realizado_base,
    indice, percentual, valor_previsto, ordem
  )
  SELECT _id, _condominio_id, c.id, COALESCE(r.valor, 0),
         'manual', 0, COALESCE(r.valor, 0), c.ordem
    FROM public.categorias_financeiras c
    LEFT JOIN (
      SELECT d.categoria_id, sum(d.valor) AS valor
        FROM public.despesas d
       WHERE d.condominio_id = _condominio_id
         AND extract(year FROM d.data) = _ano_base
       GROUP BY d.categoria_id
    ) r ON r.categoria_id = c.id
   WHERE c.condominio_id = _condominio_id
     AND c.tipo = 'despesa'
     AND c.ativo;

  GET DIAGNOSTICS _n = ROW_COUNT;

  IF _n = 0 THEN
    RAISE EXCEPTION 'sem_categorias_de_despesa'
      USING HINT = 'Crie as categorias de despesa antes de montar o orçamento — são elas as rubricas.';
  END IF;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, _uid, 'orcamento_criado', 'orcamentos', _id,
          jsonb_build_object('ano', _ano, 'ano_base', _ano_base, 'rubricas', _n));

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_orcamento(uuid, integer, integer, numeric, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_orcamento(uuid, integer, integer, numeric, numeric, text)
  TO authenticated;


-- ============================================================
-- EDITAR
-- ============================================================
-- O aprovado não se reescreve. Foi aprovado em assembleia, e um orçamento que
-- muda depois da aprovação não prova nada — que é precisamente aquilo para
-- que serve.

CREATE OR REPLACE FUNCTION public.atualizar_orcamento(
  _orcamento_id uuid,
  _inadimplencia numeric DEFAULT NULL,
  _fundo_reserva numeric DEFAULT NULL,
  _premissas text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orcamentos%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _o FROM public.orcamentos WHERE id = _orcamento_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'orcamento_nao_encontrado'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _o.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _o.status = 'aprovado' THEN RAISE EXCEPTION 'orcamento_aprovado_imutavel'; END IF;

  UPDATE public.orcamentos
     SET inadimplencia_prevista = COALESCE(_inadimplencia, inadimplencia_prevista),
         fundo_reserva_percentual = COALESCE(_fundo_reserva, fundo_reserva_percentual),
         premissas = COALESCE(NULLIF(trim(COALESCE(_premissas, '')), ''), premissas)
   WHERE id = _orcamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_orcamento(uuid, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_orcamento(uuid, numeric, numeric, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.atualizar_item_orcamento(
  _item_id uuid,
  _indice public.indice_reajuste,
  _percentual numeric,
  _valor_previsto numeric DEFAULT NULL,
  _observacao text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _i public.orcamento_itens%ROWTYPE;
  _status public.orcamento_status;
  _valor numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _i FROM public.orcamento_itens WHERE id = _item_id;
  IF _i.id IS NULL THEN RAISE EXCEPTION 'rubrica_nao_encontrada'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _i.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status INTO _status FROM public.orcamentos WHERE id = _i.orcamento_id;
  IF _status = 'aprovado' THEN RAISE EXCEPTION 'orcamento_aprovado_imutavel'; END IF;

  -- Sem valor explícito, aplica-se o percentual à base. Com valor explícito,
  -- é esse que vale: há rubricas que não se projectam por índice nenhum — uma
  -- obra que não se repete, um contrato novo já assinado.
  _valor := COALESCE(_valor_previsto, round(_i.realizado_base * (1 + _percentual / 100.0), 2));

  IF _valor < 0 THEN RAISE EXCEPTION 'valor_negativo'; END IF;

  UPDATE public.orcamento_itens
     SET indice = _indice,
         percentual = _percentual,
         valor_previsto = _valor,
         observacao = NULLIF(trim(COALESCE(_observacao, '')), '')
   WHERE id = _item_id;

  RETURN _valor;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_item_orcamento(uuid, public.indice_reajuste, numeric, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_item_orcamento(uuid, public.indice_reajuste, numeric, numeric, text)
  TO authenticated;


-- ============================================================
-- A CONTA
-- ============================================================
-- Da despesa prevista até à quota mensal. A provisão de inadimplência entra
-- como divisor e não como soma — ver o cabeçalho, com a aritmética.

CREATE OR REPLACE FUNCTION public.resumo_orcamento(_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orcamentos%ROWTYPE;
  _despesa numeric;
  _fundo numeric;
  _necessidade numeric;
  _arrecadar numeric;
  _mensal numeric;
  _taxa_actual numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _o FROM public.orcamentos WHERE id = _orcamento_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'orcamento_nao_encontrado'; END IF;

  IF NOT (public.pode_gerir_financeiro(_uid, _o.condominio_id)
          OR (_o.status = 'aprovado' AND public.is_member_of(_uid, _o.condominio_id))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(sum(valor_previsto), 0) INTO _despesa
    FROM public.orcamento_itens WHERE orcamento_id = _orcamento_id;

  _fundo := round(_despesa * _o.fundo_reserva_percentual / 100.0, 2);
  _necessidade := _despesa + _fundo;
  _arrecadar := round(_necessidade / (1 - _o.inadimplencia_prevista / 100.0), 2);
  _mensal := round(_arrecadar / 12.0, 2);

  -- O que as unidades pagam hoje, para se ver o salto que a assembleia vai
  -- ter de aprovar. Um orçamento que sobe 40% e não o diz é uma assembleia
  -- perdida.
  SELECT COALESCE(sum(u.taxa_mensal), 0) INTO _taxa_actual
    FROM public.unidades u WHERE u.condominio_id = _o.condominio_id;

  RETURN jsonb_build_object(
    'ano', _o.ano,
    'ano_base', _o.ano_base,
    'status', _o.status,
    'despesa_prevista', _despesa,
    'fundo_reserva', _fundo,
    'fundo_reserva_percentual', _o.fundo_reserva_percentual,
    'necessidade', _necessidade,
    'inadimplencia_prevista', _o.inadimplencia_prevista,
    -- A diferença entre dividir e somar. É o que falta em caixa quando se soma.
    'provisao_inadimplencia', round(_arrecadar - _necessidade, 2),
    'a_arrecadar', _arrecadar,
    'arrecadacao_mensal', _mensal,
    'realizado_base', (
      SELECT COALESCE(sum(realizado_base), 0)
        FROM public.orcamento_itens WHERE orcamento_id = _orcamento_id),
    'taxa_mensal_actual', _taxa_actual,
    'variacao_percentual', CASE
      WHEN _taxa_actual > 0 THEN round((_mensal / _taxa_actual - 1) * 100, 2)
      ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resumo_orcamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_orcamento(uuid) TO authenticated;


-- A quota de cada unidade, pela fração ideal (art. 1.336, I).
--
-- Separado do resumo de propósito: `ratear_por_fracao_ideal` recusa quando
-- alguma unidade não tem fração ideal preenchida, e essa recusa não pode
-- derrubar o ecrã inteiro do orçamento — só a parte que depende dela.

CREATE OR REPLACE FUNCTION public.quotas_do_orcamento(_orcamento_id uuid)
RETURNS TABLE(
  unidade_id uuid,
  bloco text,
  numero text,
  fracao_ideal numeric,
  taxa_actual numeric,
  quota_mensal numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orcamentos%ROWTYPE;
  _mensal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _o FROM public.orcamentos WHERE id = _orcamento_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'orcamento_nao_encontrado'; END IF;

  IF NOT (public.pode_gerir_financeiro(_uid, _o.condominio_id)
          OR (_o.status = 'aprovado' AND public.is_member_of(_uid, _o.condominio_id))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _mensal := ((public.resumo_orcamento(_orcamento_id))->>'arrecadacao_mensal')::numeric;

  RETURN QUERY
    SELECT u.id, u.bloco, u.numero, u.fracao_ideal, u.taxa_mensal, r.valor
      FROM public.ratear_por_fracao_ideal(_o.condominio_id, _mensal) r
      JOIN public.unidades u ON u.id = r.unidade_id
     ORDER BY u.bloco NULLS FIRST, u.numero;
END;
$$;

REVOKE ALL ON FUNCTION public.quotas_do_orcamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quotas_do_orcamento(uuid) TO authenticated;


-- ============================================================
-- APROVAR
-- ============================================================
-- Art. 1.350: é a assembleia que aprova, não o síndico. Por isso pede-se a
-- assembleia — e exige-se que esteja encerrada, porque um orçamento aprovado
-- numa assembleia que ainda decorre não foi aprovado em lado nenhum.

CREATE OR REPLACE FUNCTION public.aprovar_orcamento(
  _orcamento_id uuid,
  _assembleia_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orcamentos%ROWTYPE;
  _a public.assembleias%ROWTYPE;
  _itens int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _o FROM public.orcamentos WHERE id = _orcamento_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'orcamento_nao_encontrado'; END IF;
  IF NOT public.is_sindico(_uid, _o.condominio_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _o.status = 'aprovado' THEN RAISE EXCEPTION 'orcamento_ja_aprovado'; END IF;

  SELECT * INTO _a FROM public.assembleias WHERE id = _assembleia_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'assembleia_nao_encontrada'; END IF;
  IF _a.condominio_id <> _o.condominio_id THEN RAISE EXCEPTION 'condominio_incoerente'; END IF;
  IF _a.status <> 'encerrada' THEN
    RAISE EXCEPTION 'assembleia_nao_encerrada'
      USING HINT = 'O orçamento aprova-se com a assembleia encerrada. Encerre-a primeiro.';
  END IF;

  SELECT count(*) INTO _itens
    FROM public.orcamento_itens WHERE orcamento_id = _orcamento_id AND valor_previsto > 0;
  IF _itens = 0 THEN
    RAISE EXCEPTION 'orcamento_vazio'
      USING HINT = 'Nenhuma rubrica tem valor previsto. Não há orçamento para aprovar.';
  END IF;

  UPDATE public.orcamentos
     SET status = 'aprovado', assembleia_id = _assembleia_id,
         aprovado_em = now(), aprovado_por = _uid
   WHERE id = _orcamento_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_o.condominio_id, _uid, 'orcamento_aprovado', 'orcamentos', _orcamento_id,
          jsonb_build_object('ano', _o.ano, 'assembleia_id', _assembleia_id,
                             'resumo', public.resumo_orcamento(_orcamento_id)));
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_orcamento(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento(uuid, uuid) TO authenticated;


-- ============================================================
-- ORÇADO CONTRA REALIZADO
-- ============================================================
-- Sem isto a planilha é um papel de Janeiro. O previsto até ao mês é a quota
-- anual repartida pelos meses decorridos — não porque a despesa seja uniforme,
-- mas porque é a única repartição que não inventa sazonalidade que ninguém
-- declarou. O desvio lê-se com isso em mente.

CREATE OR REPLACE FUNCTION public.orcado_x_realizado(
  _orcamento_id uuid,
  _ate_mes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orcamentos%ROWTYPE;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _mes int;
  _fim date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _o FROM public.orcamentos WHERE id = _orcamento_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'orcamento_nao_encontrado'; END IF;

  IF NOT (public.pode_gerir_financeiro(_uid, _o.condominio_id)
          OR (_o.status = 'aprovado' AND public.is_member_of(_uid, _o.condominio_id))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Sem mês indicado: até ao mês corrente se o ano é o corrente, o ano todo se
  -- já passou, e zero se ainda não começou.
  _mes := COALESCE(_ate_mes, CASE
            WHEN _o.ano < extract(year FROM _hoje) THEN 12
            WHEN _o.ano > extract(year FROM _hoje) THEN 0
            ELSE extract(month FROM _hoje)::int
          END);
  IF _mes < 0 OR _mes > 12 THEN RAISE EXCEPTION 'periodo_invalido'; END IF;

  _fim := CASE WHEN _mes = 0 THEN make_date(_o.ano, 1, 1) - 1
               ELSE (make_date(_o.ano, _mes, 1) + interval '1 month - 1 day')::date END;

  RETURN (
    SELECT jsonb_build_object(
      'ano', _o.ano,
      'ate_mes', _mes,
      'previsto_ano', COALESCE(sum(x.previsto_ano), 0),
      'previsto_ate_mes', COALESCE(sum(x.previsto_ate_mes), 0),
      'realizado', COALESCE(sum(x.realizado), 0),
      'desvio', COALESCE(sum(x.realizado) - sum(x.previsto_ate_mes), 0),
      'rubricas', COALESCE(jsonb_agg(jsonb_build_object(
          'categoria_id', x.categoria_id,
          'nome', x.nome,
          'previsto_ano', x.previsto_ano,
          'previsto_ate_mes', x.previsto_ate_mes,
          'realizado', x.realizado,
          'desvio', x.realizado - x.previsto_ate_mes
        ) ORDER BY (x.realizado - x.previsto_ate_mes) DESC), '[]'::jsonb)
    )
    FROM (
      SELECT i.categoria_id,
             c.nome,
             i.valor_previsto AS previsto_ano,
             round(i.valor_previsto * _mes / 12.0, 2) AS previsto_ate_mes,
             COALESCE((
               SELECT sum(d.valor) FROM public.despesas d
                WHERE d.condominio_id = _o.condominio_id
                  AND d.categoria_id = i.categoria_id
                  AND d.data >= make_date(_o.ano, 1, 1)
                  AND d.data <= _fim), 0) AS realizado
        FROM public.orcamento_itens i
        JOIN public.categorias_financeiras c ON c.id = i.categoria_id
       WHERE i.orcamento_id = _orcamento_id
    ) x
  );
END;
$$;

REVOKE ALL ON FUNCTION public.orcado_x_realizado(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcado_x_realizado(uuid, integer) TO authenticated;


-- ============================================================
-- 20261105200000_indices_economicos.sql
-- ============================================================

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


-- ============================================================
-- 20261105210000_fluxo_de_caixa.sql
-- ============================================================

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



-- ============================================================
-- CONFERIR
-- ============================================================
-- Tem de devolver 3 tabelas e 11 funções.

SELECT 'tabelas' AS o_que, count(*) AS quantas
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('orcamentos', 'orcamento_itens', 'indices_economicos')
UNION ALL
SELECT 'funções', count(*)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('criar_orcamento', 'atualizar_orcamento', 'atualizar_item_orcamento',
                     'resumo_orcamento', 'quotas_do_orcamento', 'aprovar_orcamento',
                     'orcado_x_realizado', 'realizado_por_categoria',
                     'registrar_indices', 'acumulado_12m', 'indices_para_orcamento');
