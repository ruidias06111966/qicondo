-- ============================================================
-- CONTABILIDADE: PLANO DE CONTAS E ANEXOS DE COMPROVAÇÃO
-- ============================================================
--
-- Gerado a partir de `supabase/migrations/`, sem uma linha alterada:
--
--   20261105230000  plano de contas
--   20261105240000  anexos de comprovação e prestação de contas por conta
--
-- COMO CORRER
--
--   Supabase -> SQL Editor -> New query -> colar tudo -> Run
--
-- A primeira parte altera a tabela `categorias_financeiras` que já existe
-- (acrescenta `codigo`, `conta_pai_id` e `sintetica`) e não apaga nada. A
-- segunda cria a tabela `anexos`, o tipo `anexo_tipo` e o bucket
-- `comprovantes-condo`.
--
-- Correr duas vezes pára no `CREATE TYPE public.anexo_tipo`, que já existe. Se
-- isso acontecer, é sinal de que já estava aplicado — não é estrago.
--
-- DEPOIS DE CORRER
--
-- Abra Financeiro -> Plano de contas e clique em «Montar plano padrão». O
-- plano não se cria sozinho: as categorias que já existem são codificadas e
-- mantêm o nome e os lançamentos, e só o que falta é criado. É por isso que é
-- um botão e não parte desta migração.
--
-- A consulta de conferência está no rodapé.
-- ============================================================


-- ============================================================
-- 20261105230000_plano_de_contas.sql
-- ============================================================

-- ============================================================
-- Plano de contas
--
-- A decisão: a conta contábil é a categoria financeira, com código e
-- hierarquia. Não há duas árvores.
--
-- A alternativa era uma tabela `plano_contas` nova e um mapeamento
-- `categorias_financeiras.conta_id`. Rejeitada: o orçamento, o balancete e o
-- orçado×realizado já agrupam por categoria. Uma segunda árvore obrigava a
-- remapear os três, e a manter duas classificações alinhadas à mão — que é
-- exactamente onde a contabilidade de condomínio costuma divergir do
-- financeiro.
--
-- Do que falta à categoria para ser conta contábil:
--
--   codigo       '2.2.01' — ordena, agrupa e sobrevive a renomear a conta.
--                Opcional: uma categoria sem código continua a funcionar.
--   conta_pai_id o grupo a que pertence.
--   sintetica    conta que agrupa e NÃO aceita lançamento. É o que impede
--                lançar em "2 DESPESAS" e perder o detalhe.
--
-- O nível não é guardado: conta-se pelos pontos do código. Guardá-lo seria
-- mais um campo a poder divergir do pai.
-- ============================================================

ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS conta_pai_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sintetica boolean NOT NULL DEFAULT false;

-- Parcial: quem não tem código não colide com ninguém.
CREATE UNIQUE INDEX IF NOT EXISTS categorias_codigo_unico
  ON public.categorias_financeiras (condominio_id, codigo)
  WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_pai
  ON public.categorias_financeiras (conta_pai_id);

-- O código é só dígitos e pontos, e não começa nem acaba em ponto. Sem isto,
-- a contagem de pontos que dá o nível passa a mentir.
ALTER TABLE public.categorias_financeiras
  DROP CONSTRAINT IF EXISTS categoria_codigo_formato;
ALTER TABLE public.categorias_financeiras
  ADD CONSTRAINT categoria_codigo_formato
  CHECK (codigo IS NULL OR codigo ~ '^[0-9]+(\.[0-9]+)*$');

-- ------------------------------------------------------------
-- Coerência do pai.
--
-- Um pai noutro condomínio, de outro tipo, analítico, ou a própria conta: tudo
-- isto passa pelo CHECK e pela chave estrangeira, e nenhum deles é um plano de
-- contas válido. Daí o gatilho.
--
-- Ciclos: não se verifica a cadeia inteira, verifica-se que o pai não é
-- descendente da conta. Com três níveis é o mesmo, e é O(profundidade).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_conta_pai()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _pai public.categorias_financeiras;
  _cursor uuid;
  _saltos int := 0;
BEGIN
  IF NEW.conta_pai_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.conta_pai_id = NEW.id THEN
    RAISE EXCEPTION 'conta_pai_invalida'
      USING HINT = 'Uma conta não pode ser pai de si mesma.';
  END IF;

  SELECT * INTO _pai FROM public.categorias_financeiras WHERE id = NEW.conta_pai_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conta_pai_invalida' USING HINT = 'A conta superior não existe.';
  END IF;

  IF _pai.condominio_id <> NEW.condominio_id THEN
    RAISE EXCEPTION 'conta_pai_invalida'
      USING HINT = 'A conta superior é de outro condomínio.';
  END IF;

  IF _pai.tipo <> NEW.tipo THEN
    RAISE EXCEPTION 'conta_pai_invalida'
      USING HINT = 'Uma conta de receita não pode ficar sob um grupo de despesa, nem o contrário.';
  END IF;

  IF NOT _pai.sintetica THEN
    RAISE EXCEPTION 'conta_pai_invalida'
      USING HINT = 'Só uma conta sintética (de grupo) pode ter contas abaixo.';
  END IF;

  -- O pai não pode descender da conta.
  _cursor := _pai.conta_pai_id;
  WHILE _cursor IS NOT NULL AND _saltos < 32 LOOP
    IF _cursor = NEW.id THEN
      RAISE EXCEPTION 'conta_pai_invalida'
        USING HINT = 'Isso fecharia um ciclo no plano de contas.';
    END IF;
    SELECT conta_pai_id INTO _cursor
      FROM public.categorias_financeiras WHERE id = _cursor;
    _saltos := _saltos + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conta_pai ON public.categorias_financeiras;
CREATE TRIGGER trg_conta_pai
  BEFORE INSERT OR UPDATE OF conta_pai_id, tipo, condominio_id
  ON public.categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.validar_conta_pai();

-- ------------------------------------------------------------
-- Conta sintética não aceita lançamento.
--
-- Isto é regra de dados, não de interface: a interface esconde a conta do
-- selector, mas quem chama a API directamente contorna a interface. Daí o
-- gatilho nas três tabelas que apontam para uma categoria.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recusar_conta_sintetica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _sintetica boolean;
  _nome text;
BEGIN
  IF NEW.categoria_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sintetica, nome INTO _sintetica, _nome
    FROM public.categorias_financeiras WHERE id = NEW.categoria_id;

  IF COALESCE(_sintetica, false) THEN
    RAISE EXCEPTION 'conta_sintetica_nao_aceita_lancamento'
      USING HINT = format('"%s" é conta de grupo. Escolha uma das contas abaixo dela.', _nome);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recusar_sintetica ON public.cobrancas;
CREATE TRIGGER trg_recusar_sintetica
  BEFORE INSERT OR UPDATE OF categoria_id ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.recusar_conta_sintetica();

DROP TRIGGER IF EXISTS trg_recusar_sintetica ON public.despesas;
CREATE TRIGGER trg_recusar_sintetica
  BEFORE INSERT OR UPDATE OF categoria_id ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.recusar_conta_sintetica();

DROP TRIGGER IF EXISTS trg_recusar_sintetica ON public.orcamento_itens;
CREATE TRIGGER trg_recusar_sintetica
  BEFORE INSERT OR UPDATE OF categoria_id ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recusar_conta_sintetica();

-- ============================================================
-- O plano padrão
--
-- Três níveis: grupo, subgrupo, conta. É o que um condomínio de facto usa —
-- quatro níveis acabam sempre com o último vazio.
--
-- Os `aliases` são os nomes que o sistema já criava no `semearCategoriasPadrao`
-- antigo. Uma categoria que se chame assim e ainda não tenha código é adoptada
-- como esta conta: fica com o código e o pai, e **mantém o nome que tem**. Os
-- lançamentos antigos continuam a apontar para a mesma linha, porque é a mesma
-- linha.
--
-- Nada é apagado nem renomeado. Se o nome padrão colidir com uma categoria que
-- já tem lançamentos, a conta nova entra com o código no nome e as duas
-- coexistem — é feio e é visível, que é melhor do que silenciosamente juntar
-- duas coisas diferentes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.semear_plano_contas(_condominio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r record;
  _pai_codigo text;
  _pai_id uuid;
  _linha public.categorias_financeiras;
  _nome text;
  _usos bigint;
  _criadas int := 0;
  _adotadas int := 0;
  _com_sufixo int := 0;
  _ordem int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR _r IN
    SELECT * FROM (VALUES
      -- código,    nome,                                           tipo,                              sintética, fundo, cor,       aliases
      ('1',        'RECEITAS',                                      'receita'::public.tipo_lancamento, true,  false, '#059669', ARRAY[]::text[]),
      ('1.1',      'Receitas ordinárias',                           'receita', true,  false, '#10B981', ARRAY[]::text[]),
      ('1.1.01',   'Taxa condominial',                              'receita', false, false, '#10B981', ARRAY['Taxa condominial','Taxa de condomínio','Quota ordinária']),
      ('1.1.02',   'Rateio de consumo individualizado',             'receita', false, false, '#34D399', ARRAY[]::text[]),
      ('1.2',      'Fundo de reserva',                              'receita', true,  false, '#14B8A6', ARRAY[]::text[]),
      ('1.2.01',   'Contribuição para fundo de reserva',            'receita', false, true,  '#14B8A6', ARRAY['Fundo de reserva']),
      ('1.3',      'Receitas acessórias',                           'receita', true,  false, '#F59E0B', ARRAY[]::text[]),
      ('1.3.01',   'Multa e juros de mora',                         'receita', false, false, '#F59E0B', ARRAY['Multas e juros','Multa e juros']),
      ('1.3.02',   'Multa por infração',                            'receita', false, false, '#F97316', ARRAY['Multas por infração']),
      ('1.3.03',   'Uso de áreas comuns',                           'receita', false, false, '#3B82F6', ARRAY['Taxa de uso de áreas','Aluguel de áreas comuns','Salão de festas']),
      ('1.3.04',   'Receitas financeiras',                          'receita', false, false, '#0EA5E9', ARRAY['Rendimento de aplicação']),
      ('1.3.09',   'Outras receitas',                               'receita', false, false, '#8B5CF6', ARRAY['Outras receitas']),
      ('1.4',      'Receitas extraordinárias',                      'receita', true,  false, '#A855F7', ARRAY[]::text[]),
      ('1.4.01',   'Quota extraordinária',                          'receita', false, false, '#A855F7', ARRAY[]::text[]),
      ('1.4.02',   'Rateio de obras',                               'receita', false, false, '#C084FC', ARRAY[]::text[]),

      ('2',        'DESPESAS',                                      'despesa', true,  false, '#DC2626', ARRAY[]::text[]),
      ('2.1',      'Pessoal',                                       'despesa', true,  false, '#F97316', ARRAY[]::text[]),
      ('2.1.01',   'Salários e ordenados',                          'despesa', false, false, '#F97316', ARRAY['Salários e encargos','Salários','Folha de pagamento']),
      ('2.1.02',   'Encargos sociais (INSS e FGTS)',                'despesa', false, false, '#FB923C', ARRAY['Encargos sociais']),
      ('2.1.03',   'Benefícios (transporte, alimentação, saúde)',   'despesa', false, false, '#FDBA74', ARRAY['Benefícios']),
      ('2.1.04',   'Décimo terceiro e férias',                      'despesa', false, false, '#FCD34D', ARRAY['13º salário','Décimo terceiro']),
      ('2.1.05',   'Rescisões e indenizações',                      'despesa', false, false, '#FBBF24', ARRAY['Rescisões']),
      ('2.2',      'Consumos e concessionárias',                    'despesa', true,  false, '#3B82F6', ARRAY[]::text[]),
      ('2.2.01',   'Energia elétrica',                              'despesa', false, false, '#F59E0B', ARRAY['Energia','Energia elétrica','Luz']),
      ('2.2.02',   'Água e esgoto',                                 'despesa', false, false, '#3B82F6', ARRAY['Água','Água e esgoto','Saneamento']),
      ('2.2.03',   'Gás',                                           'despesa', false, false, '#60A5FA', ARRAY['Gás']),
      ('2.2.04',   'Telefone e internet',                           'despesa', false, false, '#93C5FD', ARRAY['Telefone','Internet']),
      ('2.3',      'Manutenção e conservação',                      'despesa', true,  false, '#EF4444', ARRAY[]::text[]),
      ('2.3.01',   'Elevadores',                                    'despesa', false, false, '#EF4444', ARRAY['Elevador','Elevadores']),
      ('2.3.02',   'Hidráulica, bombas e reservatórios',            'despesa', false, false, '#F87171', ARRAY['Hidráulica']),
      ('2.3.03',   'Portões, interfone e CFTV',                     'despesa', false, false, '#FCA5A5', ARRAY['Interfone','Portões','CFTV']),
      ('2.3.04',   'Jardinagem e paisagismo',                       'despesa', false, false, '#22C55E', ARRAY['Jardinagem','Jardim']),
      ('2.3.05',   'Piscina',                                       'despesa', false, false, '#06B6D4', ARRAY['Piscina']),
      ('2.3.06',   'Combate a incêndio e extintores',               'despesa', false, false, '#B91C1C', ARRAY['Extintores','Combate a incêndio']),
      ('2.3.07',   'Dedetização e limpeza de reservatório',          'despesa', false, false, '#84CC16', ARRAY['Dedetização']),
      ('2.3.08',   'Material de limpeza e consumo',                 'despesa', false, false, '#14B8A6', ARRAY['Material de limpeza']),
      ('2.3.09',   'Outras manutenções',                            'despesa', false, false, '#DC2626', ARRAY['Manutenção','Manutenções','Reparos']),
      ('2.4',      'Serviços terceirizados',                        'despesa', true,  false, '#8B5CF6', ARRAY[]::text[]),
      ('2.4.01',   'Portaria e vigilância',                          'despesa', false, false, '#8B5CF6', ARRAY['Segurança','Portaria','Vigilância']),
      ('2.4.02',   'Limpeza e conservação',                         'despesa', false, false, '#14B8A6', ARRAY['Limpeza']),
      ('2.4.03',   'Administradora',                                'despesa', false, false, '#EC4899', ARRAY['Administradora','Taxa de administração']),
      ('2.5',      'Administrativas',                               'despesa', true,  false, '#EC4899', ARRAY[]::text[]),
      ('2.5.01',   'Honorários contábeis',                          'despesa', false, false, '#EC4899', ARRAY['Contabilidade','Honorários contábeis']),
      ('2.5.02',   'Honorários advocatícios',                       'despesa', false, false, '#F472B6', ARRAY['Advogado','Assessoria jurídica']),
      ('2.5.03',   'Tarifas bancárias',                             'despesa', false, false, '#F9A8D4', ARRAY['Tarifas bancárias','Banco']),
      ('2.5.04',   'Material de escritório e cópias',               'despesa', false, false, '#A3A3A3', ARRAY['Material de escritório']),
      ('2.5.05',   'Software e sistemas',                           'despesa', false, false, '#6366F1', ARRAY['Software','Sistema']),
      ('2.5.06',   'Despesas de assembleia',                        'despesa', false, false, '#818CF8', ARRAY['Assembleia']),
      ('2.5.09',   'Outras administrativas',                        'despesa', false, false, '#C4B5FD', ARRAY['Administração']),
      ('2.6',      'Seguros e tributos',                            'despesa', true,  false, '#0891B2', ARRAY[]::text[]),
      ('2.6.01',   'Seguro do condomínio',                          'despesa', false, false, '#0891B2', ARRAY['Seguro','Seguros']),
      ('2.6.02',   'Tributos e taxas públicas',                     'despesa', false, false, '#0E7490', ARRAY['Tributos','Impostos','IPTU']),
      ('2.7',      'Obras e benfeitorias',                          'despesa', true,  false, '#B45309', ARRAY[]::text[]),
      ('2.7.01',   'Obras de reparação',                            'despesa', false, false, '#B45309', ARRAY['Obras']),
      ('2.7.02',   'Obras de melhoria',                             'despesa', false, false, '#D97706', ARRAY['Benfeitorias']),
      ('2.9',      'Outras despesas',                               'despesa', true,  false, '#64748B', ARRAY[]::text[]),
      ('2.9.01',   'Despesas diversas',                             'despesa', false, false, '#64748B', ARRAY['Outras despesas','Diversos'])
    ) AS t(codigo, nome, tipo, sintetica, fundo_reserva, cor, aliases)
    ORDER BY array_length(string_to_array(codigo, '.'), 1), string_to_array(codigo, '.')::int[]
  LOOP
    _ordem := _ordem + 1;

    -- Já existe esta conta? Nada a fazer. A função é idempotente.
    PERFORM 1 FROM public.categorias_financeiras
      WHERE condominio_id = _condominio_id AND codigo = _r.codigo;
    IF FOUND THEN CONTINUE; END IF;

    _pai_id := NULL;
    IF position('.' IN _r.codigo) > 0 THEN
      _pai_codigo := regexp_replace(_r.codigo, '\.[0-9]+$', '');
      SELECT id INTO _pai_id FROM public.categorias_financeiras
        WHERE condominio_id = _condominio_id AND codigo = _pai_codigo;
    END IF;

    -- Uma categoria antiga que seja esta conta com outro nome?
    _linha := NULL;
    IF array_length(_r.aliases, 1) IS NOT NULL THEN
      SELECT * INTO _linha FROM public.categorias_financeiras
        WHERE condominio_id = _condominio_id
          AND codigo IS NULL
          AND tipo = _r.tipo
          AND lower(nome) = ANY (ARRAY(SELECT lower(a) FROM unnest(_r.aliases) AS a))
        ORDER BY ordem, nome
        LIMIT 1;
    END IF;

    IF _linha.id IS NOT NULL THEN
      UPDATE public.categorias_financeiras
         SET codigo = _r.codigo,
             conta_pai_id = _pai_id,
             sintetica = _r.sintetica,
             ordem = _ordem,
             fundo_reserva = fundo_reserva OR _r.fundo_reserva
       WHERE id = _linha.id;
      _adotadas := _adotadas + 1;
      CONTINUE;
    END IF;

    -- Colisão de nome: a tabela tem UNIQUE(condominio_id, nome).
    _nome := _r.nome;
    _linha := NULL;
    SELECT * INTO _linha FROM public.categorias_financeiras
      WHERE condominio_id = _condominio_id AND lower(nome) = lower(_r.nome);

    IF _linha.id IS NOT NULL THEN
      SELECT (SELECT count(*) FROM public.cobrancas WHERE categoria_id = _linha.id)
           + (SELECT count(*) FROM public.despesas WHERE categoria_id = _linha.id)
           + (SELECT count(*) FROM public.orcamento_itens WHERE categoria_id = _linha.id)
        INTO _usos;

      IF _linha.codigo IS NULL AND _linha.tipo = _r.tipo AND _usos = 0 THEN
        UPDATE public.categorias_financeiras
           SET codigo = _r.codigo,
               conta_pai_id = _pai_id,
               sintetica = _r.sintetica,
               ordem = _ordem,
               fundo_reserva = fundo_reserva OR _r.fundo_reserva
         WHERE id = _linha.id;
        _adotadas := _adotadas + 1;
        CONTINUE;
      END IF;

      -- Tem lançamentos, ou é de outro tipo: não se toca.
      _nome := _r.nome || ' (' || _r.codigo || ')';
      _com_sufixo := _com_sufixo + 1;
    END IF;

    INSERT INTO public.categorias_financeiras
      (condominio_id, nome, tipo, cor, ordem, codigo, conta_pai_id, sintetica, fundo_reserva)
    VALUES
      (_condominio_id, _nome, _r.tipo, _r.cor, _ordem, _r.codigo, _pai_id, _r.sintetica, _r.fundo_reserva);
    _criadas := _criadas + 1;
  END LOOP;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, metadata)
  VALUES (_condominio_id, auth.uid(), 'semear_plano_contas', 'categorias_financeiras',
          jsonb_build_object('criadas', _criadas, 'adotadas', _adotadas, 'com_sufixo', _com_sufixo));

  RETURN jsonb_build_object(
    'criadas', _criadas,
    'adotadas', _adotadas,
    'com_sufixo', _com_sufixo
  );
END;
$$;

-- ------------------------------------------------------------
-- O plano, pela ordem em que se lê.
--
-- A ordenação é pelo código convertido em int[], não pelo texto: por texto,
-- '2.10' vem antes de '2.2'. Com um plano de dois dígitos ninguém nota, e
-- quando notar já tem o plano cheio.
--
-- `em_uso` é o que a interface precisa para saber se pode deixar desactivar
-- uma conta sem deixar lançamentos órfãos de classificação.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plano_de_contas(
  _condominio_id uuid,
  _incluir_inativas boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  codigo text,
  nome text,
  tipo public.tipo_lancamento,
  sintetica boolean,
  fundo_reserva boolean,
  cor text,
  ativo boolean,
  conta_pai_id uuid,
  nivel int,
  em_uso boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_member_of(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT c.id,
         c.codigo,
         c.nome,
         c.tipo,
         c.sintetica,
         c.fundo_reserva,
         c.cor,
         c.ativo,
         c.conta_pai_id,
         COALESCE(array_length(string_to_array(c.codigo, '.'), 1), 3) AS nivel,
         (EXISTS (SELECT 1 FROM public.cobrancas x WHERE x.categoria_id = c.id)
          OR EXISTS (SELECT 1 FROM public.despesas x WHERE x.categoria_id = c.id)
          OR EXISTS (SELECT 1 FROM public.orcamento_itens x WHERE x.categoria_id = c.id)) AS em_uso
    FROM public.categorias_financeiras c
   WHERE c.condominio_id = _condominio_id
     AND (_incluir_inativas OR c.ativo)
   ORDER BY c.tipo,
            (string_to_array(c.codigo, '.')::int[]) NULLS LAST,
            c.nome;
END;
$$;

-- ------------------------------------------------------------
-- Criar e alterar contas.
--
-- Nos updates, NULL quer dizer "não mexer". A consequência é que não há como
-- limpar o código ou o pai por aqui — e está bem assim: uma conta que já tem
-- lançamentos classificados não deve perder o lugar na árvore por descuido.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_conta(
  _condominio_id uuid,
  _nome text,
  _tipo public.tipo_lancamento,
  _codigo text DEFAULT NULL,
  _conta_pai_id uuid DEFAULT NULL,
  _sintetica boolean DEFAULT false,
  _fundo_reserva boolean DEFAULT false,
  _cor text DEFAULT '#64748B'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _ordem int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _nome IS NULL OR btrim(_nome) = '' THEN
    RAISE EXCEPTION 'nome_obrigatorio';
  END IF;

  IF _sintetica AND _fundo_reserva THEN
    RAISE EXCEPTION 'conta_invalida'
      USING HINT = 'Uma conta de grupo não é fundo de reserva; marque a conta que recebe a contribuição.';
  END IF;

  -- A ordem segue o pai, para a conta nova não aparecer no fim da lista.
  SELECT COALESCE(max(ordem), 0) + 1 INTO _ordem
    FROM public.categorias_financeiras
   WHERE condominio_id = _condominio_id
     AND conta_pai_id IS NOT DISTINCT FROM _conta_pai_id;

  INSERT INTO public.categorias_financeiras
    (condominio_id, nome, tipo, cor, ordem, codigo, conta_pai_id, sintetica, fundo_reserva)
  VALUES
    (_condominio_id, btrim(_nome), _tipo, _cor, _ordem, nullif(btrim(_codigo), ''),
     _conta_pai_id, _sintetica, _fundo_reserva)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_conta(
  _categoria_id uuid,
  _nome text DEFAULT NULL,
  _codigo text DEFAULT NULL,
  _conta_pai_id uuid DEFAULT NULL,
  _sintetica boolean DEFAULT NULL,
  _fundo_reserva boolean DEFAULT NULL,
  _cor text DEFAULT NULL,
  _ativo boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.categorias_financeiras;
  _em_uso boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _c FROM public.categorias_financeiras WHERE id = _categoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'conta_nao_encontrada'; END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _c.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Tornar sintética uma conta que já tem lançamentos esconderia os
  -- lançamentos de qualquer relatório que só olha para as analíticas.
  IF COALESCE(_sintetica, false) AND NOT _c.sintetica THEN
    SELECT EXISTS (SELECT 1 FROM public.cobrancas x WHERE x.categoria_id = _c.id)
        OR EXISTS (SELECT 1 FROM public.despesas x WHERE x.categoria_id = _c.id)
        OR EXISTS (SELECT 1 FROM public.orcamento_itens x WHERE x.categoria_id = _c.id)
      INTO _em_uso;
    IF _em_uso THEN
      RAISE EXCEPTION 'conta_em_uso'
        USING HINT = 'Esta conta já tem lançamentos; não pode passar a conta de grupo.';
    END IF;
  END IF;

  UPDATE public.categorias_financeiras
     SET nome          = COALESCE(nullif(btrim(_nome), ''), nome),
         codigo        = COALESCE(nullif(btrim(_codigo), ''), codigo),
         conta_pai_id  = COALESCE(_conta_pai_id, conta_pai_id),
         sintetica     = COALESCE(_sintetica, sintetica),
         fundo_reserva = COALESCE(_fundo_reserva, fundo_reserva),
         cor           = COALESCE(nullif(btrim(_cor), ''), cor),
         ativo         = COALESCE(_ativo, ativo)
   WHERE id = _categoria_id;
END;
$$;

-- Desactivar, nunca apagar: os lançamentos antigos ficam classificados.
CREATE OR REPLACE FUNCTION public.desativar_conta(_categoria_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.categorias_financeiras;
  _filhas int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _c FROM public.categorias_financeiras WHERE id = _categoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'conta_nao_encontrada'; END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _c.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO _filhas
    FROM public.categorias_financeiras
   WHERE conta_pai_id = _categoria_id AND ativo;

  IF _filhas > 0 THEN
    RAISE EXCEPTION 'conta_com_filhas'
      USING HINT = format('Tem %s conta(s) activa(s) abaixo. Desactive-as primeiro.', _filhas);
  END IF;

  UPDATE public.categorias_financeiras SET ativo = false WHERE id = _categoria_id;
END;
$$;

-- ------------------------------------------------------------
-- Permissões
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.semear_plano_contas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plano_de_contas(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_conta(uuid, text, public.tipo_lancamento, text, uuid, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_conta(uuid, text, text, uuid, boolean, boolean, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desativar_conta(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.semear_plano_contas(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.plano_de_contas(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_conta(uuid, text, public.tipo_lancamento, text, uuid, boolean, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_conta(uuid, text, text, uuid, boolean, boolean, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.desativar_conta(uuid) FROM anon;

-- As funções internas dos gatilhos não são para ninguém chamar à mão.
REVOKE EXECUTE ON FUNCTION public.validar_conta_pai() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recusar_conta_sintetica() FROM authenticated, anon;


-- ============================================================
-- 20261105240000_anexos_comprovacao.sql
-- ============================================================

-- ============================================================
-- Anexos de comprovação
--
-- O que o síndico tem de poder provar, lançamento a lançamento:
--
--   a despesa existiu   → nota fiscal ou recibo
--   a despesa foi paga  → comprovante de pagamento
--   a receita entrou    → comprovante de depósito, extracto, recibo
--
-- Uma tabela polimórfica e não uma coluna por entidade: um lançamento tem N
-- documentos (nota + comprovante + contrato), e uma coluna `anexo_url` por
-- tabela — que é o que existia — só guarda um e não diz de que tipo é.
--
-- Sem chave estrangeira para a entidade, porque `entidade_id` aponta para
-- quatro tabelas. O que a FK daria fica nos gatilhos: um valida que a entidade
-- existe e é do mesmo condomínio, os outros apagam os anexos quando o
-- lançamento desaparece.
--
-- Limitação conhecida: apagar a linha não apaga o ficheiro no Storage. O
-- ficheiro fica órfão no bucket até a limpeza do lado da aplicação. Preferi
-- isto a um gatilho que escreve em `storage.objects` a partir do `public`.
-- ============================================================

CREATE TYPE public.anexo_tipo AS ENUM (
  'nota_fiscal',
  'recibo',
  'comprovante_pagamento',
  'boleto',
  'contrato',
  'extrato_bancario',
  'outro'
);

CREATE TABLE public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,

  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  tipo public.anexo_tipo NOT NULL DEFAULT 'outro',

  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,

  -- Dados do documento, para o anexo valer como prova sem ser aberto: é o que
  -- permite conferir que a nota é do valor e da data que o lançamento diz.
  documento_numero text,
  documento_data date,
  valor numeric(14,2),
  observacao text,

  enviado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT anexo_entidade_conhecida
    CHECK (entidade IN ('despesa', 'pagamento', 'cobranca', 'infracao')),
  CONSTRAINT anexo_caminho_unico UNIQUE (storage_path),
  CONSTRAINT anexo_tamanho_positivo
    CHECK (tamanho_bytes IS NULL OR tamanho_bytes > 0),
  CONSTRAINT anexo_valor_nao_negativo
    CHECK (valor IS NULL OR valor >= 0)
);

CREATE INDEX idx_anexos_entidade ON public.anexos (condominio_id, entidade, entidade_id);
CREATE INDEX idx_anexos_tipo ON public.anexos (condominio_id, tipo);

-- ------------------------------------------------------------
-- A entidade tem de existir e ser do mesmo condomínio.
--
-- Isto é o que a chave estrangeira faria se `entidade_id` apontasse para uma
-- tabela só. Sem isto, um anexo pode ficar pendurado num id inexistente, ou —
-- pior — num lançamento de outro condomínio, e aparecer na prestação de contas
-- errada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_anexo_entidade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _cond uuid;
BEGIN
  CASE NEW.entidade
    WHEN 'despesa'  THEN SELECT condominio_id INTO _cond FROM public.despesas  WHERE id = NEW.entidade_id;
    WHEN 'pagamento' THEN SELECT condominio_id INTO _cond FROM public.pagamentos WHERE id = NEW.entidade_id;
    WHEN 'cobranca' THEN SELECT condominio_id INTO _cond FROM public.cobrancas  WHERE id = NEW.entidade_id;
    WHEN 'infracao' THEN SELECT condominio_id INTO _cond FROM public.infracoes  WHERE id = NEW.entidade_id;
    ELSE RAISE EXCEPTION 'anexo_entidade_desconhecida';
  END CASE;

  IF _cond IS NULL THEN
    RAISE EXCEPTION 'anexo_lancamento_nao_encontrado'
      USING HINT = format('Nenhum lançamento do tipo "%s" com esse identificador.', NEW.entidade);
  END IF;

  IF _cond <> NEW.condominio_id THEN
    RAISE EXCEPTION 'anexo_de_outro_condominio'
      USING HINT = 'O lançamento pertence a outro condomínio.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_anexo_entidade
  BEFORE INSERT OR UPDATE OF entidade, entidade_id, condominio_id ON public.anexos
  FOR EACH ROW EXECUTE FUNCTION public.validar_anexo_entidade();

-- ------------------------------------------------------------
-- Apagado o lançamento, vão os anexos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_anexos_do_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.anexos
   WHERE entidade = TG_ARGV[0] AND entidade_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('despesa');
CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('pagamento');
CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('cobranca');
CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.infracoes
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('infracao');

-- ------------------------------------------------------------
-- RLS
--
-- Quem gere o financeiro vê e mexe em tudo. O condómino vê os documentos das
-- cobranças e das infrações da sua unidade — é dele que se está a cobrar, e a
-- prova é a primeira coisa que pede.
-- ------------------------------------------------------------
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao financeira gere anexos"
  ON public.anexos FOR ALL TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id))
  WITH CHECK (public.pode_gerir_financeiro(auth.uid(), condominio_id));

CREATE POLICY "Condomino ve anexos da sua unidade"
  ON public.anexos FOR SELECT TO authenticated
  USING (
    public.is_member_of(auth.uid(), condominio_id)
    AND (
      (entidade = 'cobranca' AND EXISTS (
         SELECT 1 FROM public.cobrancas c
          WHERE c.id = anexos.entidade_id
            AND public.is_morador_da_unidade(auth.uid(), c.unidade_id)))
      OR
      (entidade = 'infracao' AND EXISTS (
         SELECT 1 FROM public.infracoes i
          WHERE i.id = anexos.entidade_id
            AND public.is_morador_da_unidade(auth.uid(), i.unidade_id)))
    )
  );

-- ------------------------------------------------------------
-- Storage
--
-- Layout: {condominio_id}/{entidade}/{entidade_id}/{ficheiro}
--
-- O primeiro segmento é o condomínio porque é por ele que a política decide, e
-- `storage.foldername(name)[1]` é o que ela tem à mão sem ir à base de dados.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-condo', 'comprovantes-condo', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Financeiro le comprovantes"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes-condo'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.pode_gerir_financeiro(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Escrito por extenso de propósito. A RLS da `anexos` aplica-se mesmo dentro da
-- expressão de uma política, e bastaria o EXISTS sobre `anexos` — mas depender
-- disso num sítio onde o erro é dar acesso a documentos de outra unidade é
-- confiança a mais num detalhe que não está à vista.
CREATE POLICY "Condomino le comprovantes da sua unidade"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes-condo'
    AND EXISTS (
      SELECT 1
        FROM public.anexos a
        LEFT JOIN public.cobrancas c
               ON a.entidade = 'cobranca' AND c.id = a.entidade_id
        LEFT JOIN public.infracoes i
               ON a.entidade = 'infracao' AND i.id = a.entidade_id
       WHERE a.storage_path = storage.objects.name
         AND public.is_member_of(auth.uid(), a.condominio_id)
         AND public.is_morador_da_unidade(
               auth.uid(),
               COALESCE(c.unidade_id, i.unidade_id)
             )
    )
  );

CREATE POLICY "Financeiro envia comprovantes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes-condo'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.pode_gerir_financeiro(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Financeiro apaga comprovantes"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes-condo'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.pode_gerir_financeiro(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ============================================================
-- Operações
-- ============================================================

-- O ficheiro sobe pelo Storage; esta função registra o que ele é. Separado de
-- propósito: o upload é do cliente para o Storage e não passa pela base de
-- dados, e um `storage_path` que não existe no bucket é um registo a menos mau
-- do que um ficheiro no bucket que ninguém sabe a que lançamento pertence.
CREATE OR REPLACE FUNCTION public.registrar_anexo(
  _condominio_id uuid,
  _entidade text,
  _entidade_id uuid,
  _tipo public.anexo_tipo,
  _storage_path text,
  _nome_arquivo text,
  _mime_type text DEFAULT NULL,
  _tamanho_bytes bigint DEFAULT NULL,
  _documento_numero text DEFAULT NULL,
  _documento_data date DEFAULT NULL,
  _valor numeric DEFAULT NULL,
  _observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _storage_path IS NULL OR btrim(_storage_path) = '' THEN
    RAISE EXCEPTION 'anexo_sem_caminho';
  END IF;

  -- O caminho tem de começar pelo condomínio, senão as políticas do Storage
  -- decidem sobre um condomínio e o registo diz outro.
  IF split_part(_storage_path, '/', 1) <> _condominio_id::text THEN
    RAISE EXCEPTION 'anexo_caminho_invalido'
      USING HINT = 'O caminho no Storage tem de começar pelo id do condomínio.';
  END IF;

  INSERT INTO public.anexos (
    condominio_id, entidade, entidade_id, tipo,
    storage_path, nome_arquivo, mime_type, tamanho_bytes,
    documento_numero, documento_data, valor, observacao, enviado_por
  ) VALUES (
    _condominio_id, _entidade, _entidade_id, _tipo,
    btrim(_storage_path), btrim(_nome_arquivo), _mime_type, _tamanho_bytes,
    nullif(btrim(_documento_numero), ''), _documento_data, _valor,
    nullif(btrim(_observacao), ''), auth.uid()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- Devolve o caminho para a aplicação apagar o ficheiro no Storage. Se não o
-- devolvesse, quem chama não saberia o que apagar.
CREATE OR REPLACE FUNCTION public.remover_anexo(_anexo_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a public.anexos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _a FROM public.anexos WHERE id = _anexo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'anexo_nao_encontrado'; END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _a.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.anexos WHERE id = _anexo_id;
  RETURN _a.storage_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_anexos(
  _condominio_id uuid,
  _entidade text,
  _entidade_id uuid
)
RETURNS TABLE (
  id uuid,
  tipo public.anexo_tipo,
  storage_path text,
  nome_arquivo text,
  mime_type text,
  tamanho_bytes bigint,
  documento_numero text,
  documento_data date,
  valor numeric,
  observacao text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _unidade uuid;
  _pode boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  _pode := public.pode_gerir_financeiro(auth.uid(), _condominio_id);

  -- SECURITY DEFINER passa por cima da RLS, por isso a mesma regra da política
  -- do condómino tem de estar aqui à mão.
  IF NOT _pode THEN
    IF _entidade = 'cobranca' THEN
      SELECT c.unidade_id INTO _unidade FROM public.cobrancas c
       WHERE c.id = _entidade_id AND c.condominio_id = _condominio_id;
    ELSIF _entidade = 'infracao' THEN
      SELECT i.unidade_id INTO _unidade FROM public.infracoes i
       WHERE i.id = _entidade_id AND i.condominio_id = _condominio_id;
    END IF;

    IF _unidade IS NULL
       OR NOT public.is_member_of(auth.uid(), _condominio_id)
       OR NOT public.is_morador_da_unidade(auth.uid(), _unidade) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  RETURN QUERY
  SELECT a.id, a.tipo, a.storage_path, a.nome_arquivo, a.mime_type,
         a.tamanho_bytes, a.documento_numero, a.documento_data, a.valor,
         a.observacao, a.created_at
    FROM public.anexos a
   WHERE a.condominio_id = _condominio_id
     AND a.entidade = _entidade
     AND a.entidade_id = _entidade_id
   ORDER BY a.tipo, a.created_at;
END;
$$;

-- ============================================================
-- Pendências documentais
--
-- A pergunta a que isto responde é a do conselho fiscal: "de tudo o que foi
-- pago neste período, o que é que não tem papel?".
--
-- Duas provas distintas, e faltam separadamente:
--
--   fiscal      nota fiscal ou recibo — prova que a despesa existiu
--   comprovante comprovante de pagamento ou extracto — prova que saiu dinheiro
--
-- Uma despesa com nota e sem comprovante não é a mesma falha que uma despesa
-- com comprovante e sem nota. A primeira é desorganização; a segunda é o que o
-- auditor marca a vermelho.
-- ============================================================
CREATE OR REPLACE FUNCTION public.pendencias_documentais(
  _condominio_id uuid,
  _inicio date,
  _fim date
)
RETURNS TABLE (
  despesa_id uuid,
  data date,
  fornecedor text,
  descricao text,
  valor numeric,
  conta_codigo text,
  conta_nome text,
  tem_fiscal boolean,
  tem_comprovante boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'periodo_invalido';
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.data,
         d.fornecedor,
         d.descricao,
         d.valor,
         cat.codigo,
         cat.nome,
         EXISTS (SELECT 1 FROM public.anexos a
                  WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                    AND a.tipo IN ('nota_fiscal', 'recibo')),
         EXISTS (SELECT 1 FROM public.anexos a
                  WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                    AND a.tipo IN ('comprovante_pagamento', 'extrato_bancario'))
    FROM public.despesas d
    LEFT JOIN public.categorias_financeiras cat ON cat.id = d.categoria_id
   WHERE d.condominio_id = _condominio_id
     AND d.data BETWEEN _inicio AND _fim
     AND NOT (
       EXISTS (SELECT 1 FROM public.anexos a
                WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                  AND a.tipo IN ('nota_fiscal', 'recibo'))
       AND
       EXISTS (SELECT 1 FROM public.anexos a
                WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                  AND a.tipo IN ('comprovante_pagamento', 'extrato_bancario'))
     )
   ORDER BY d.data, d.valor DESC;
END;
$$;

-- ============================================================
-- Prestação de contas por conta contábil
--
-- O balancete que já existia dá totais por categoria, numa lista plana. Isto
-- dá a árvore: cada grupo com o subtotal dos seus, e a contagem de quantos
-- lançamentos têm documento.
--
-- O subtotal do grupo vem de somar os descendentes, não de um campo guardado.
-- A CTE recursiva enumera os pares (antepassado, descendente) — incluindo cada
-- conta como descendente de si mesma, que é o que faz uma analítica aparecer
-- com o seu próprio valor.
--
-- A receita vem do pagamento e a conta vem da cobrança que ele liquidou, igual
-- ao `calcular_balancete`: um recebimento lançado à mão, sem cobrança, fica
-- sem conta e não entra na árvore. Aparece no balancete e não aqui, e é essa a
-- diferença entre caixa e contabilidade.
-- ============================================================
CREATE OR REPLACE FUNCTION public.prestacao_por_conta(
  _condominio_id uuid,
  _inicio date,
  _fim date
)
RETURNS TABLE (
  conta_id uuid,
  codigo text,
  nome text,
  tipo public.tipo_lancamento,
  nivel int,
  sintetica boolean,
  valor numeric,
  lancamentos int,
  documentados int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'periodo_invalido';
  END IF;

  RETURN QUERY
  WITH RECURSIVE movimento AS (
    SELECT d.categoria_id AS conta_id,
           d.valor,
           EXISTS (SELECT 1 FROM public.anexos a
                    WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                      AND a.tipo IN ('nota_fiscal', 'recibo',
                                     'comprovante_pagamento', 'extrato_bancario')) AS documentado
      FROM public.despesas d
     WHERE d.condominio_id = _condominio_id
       AND d.data BETWEEN _inicio AND _fim

    UNION ALL

    SELECT c.categoria_id,
           p.valor,
           EXISTS (SELECT 1 FROM public.anexos a
                    WHERE a.entidade = 'pagamento' AND a.entidade_id = p.id
                      AND a.tipo IN ('comprovante_pagamento', 'recibo',
                                     'extrato_bancario'))
      FROM public.pagamentos p
      LEFT JOIN public.cobrancas c ON c.id = p.cobranca_id
     WHERE p.condominio_id = _condominio_id
       AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _inicio AND _fim
  ),
  folha AS (
    SELECT m.conta_id,
           sum(m.valor) AS valor,
           count(*)::int AS lancamentos,
           count(*) FILTER (WHERE m.documentado)::int AS documentados
      FROM movimento m
     WHERE m.conta_id IS NOT NULL
     GROUP BY m.conta_id
  ),
  arvore AS (
    SELECT c.id AS antepassado, c.id AS descendente, 0 AS profundidade
      FROM public.categorias_financeiras c
     WHERE c.condominio_id = _condominio_id

    UNION ALL

    SELECT a.antepassado, f.id, a.profundidade + 1
      FROM arvore a
      JOIN public.categorias_financeiras f ON f.conta_pai_id = a.descendente
     WHERE a.profundidade < 8
  )
  SELECT c.id,
         c.codigo,
         c.nome,
         c.tipo,
         COALESCE(array_length(string_to_array(c.codigo, '.'), 1), 3) AS nivel,
         c.sintetica,
         COALESCE(sum(fo.valor), 0)::numeric(14,2),
         COALESCE(sum(fo.lancamentos), 0)::int,
         COALESCE(sum(fo.documentados), 0)::int
    FROM public.categorias_financeiras c
    LEFT JOIN arvore a ON a.antepassado = c.id
    LEFT JOIN folha fo ON fo.conta_id = a.descendente
   WHERE c.condominio_id = _condominio_id
   GROUP BY c.id, c.codigo, c.nome, c.tipo, c.sintetica, c.ativo
  -- Uma conta desactivada sem movimento no período é ruído no relatório.
  HAVING c.ativo OR COALESCE(sum(fo.lancamentos), 0) > 0
   ORDER BY c.tipo,
            (string_to_array(c.codigo, '.')::int[]) NULLS LAST,
            c.nome;
END;
$$;

-- ------------------------------------------------------------
-- Permissões
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.registrar_anexo(uuid, text, uuid, public.anexo_tipo, text, text, text, bigint, text, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_anexo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_anexos(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pendencias_documentais(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestacao_por_conta(uuid, date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.registrar_anexo(uuid, text, uuid, public.anexo_tipo, text, text, text, bigint, text, date, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remover_anexo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_anexos(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pendencias_documentais(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prestacao_por_conta(uuid, date, date) FROM anon;

REVOKE EXECUTE ON FUNCTION public.validar_anexo_entidade() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.limpar_anexos_do_lancamento() FROM authenticated, anon;


-- ---------- conferir ----------
-- Espera: 10 funções novas, 3 colunas novas na categoria, 1 tabela de anexos,
-- 1 bucket, 4 gatilhos de limpeza de anexos e 3 de recusa de conta sintética.

SELECT 'funções do plano de contas e dos anexos' AS o_que, count(*) AS quantas
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('semear_plano_contas', 'plano_de_contas', 'criar_conta',
                     'atualizar_conta', 'desativar_conta', 'registrar_anexo',
                     'remover_anexo', 'listar_anexos', 'pendencias_documentais',
                     'prestacao_por_conta')
UNION ALL
SELECT 'colunas novas na categoria financeira', count(*)
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'categorias_financeiras'
   AND column_name IN ('codigo', 'conta_pai_id', 'sintetica')
UNION ALL
SELECT 'tabela de anexos', count(*)
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name = 'anexos'
UNION ALL
SELECT 'bucket de comprovantes', count(*)
  FROM storage.buckets WHERE id = 'comprovantes-condo'
UNION ALL
SELECT 'gatilhos de limpeza de anexos', count(*)
  FROM pg_trigger WHERE tgname = 'trg_limpar_anexos' AND NOT tgisinternal
UNION ALL
SELECT 'gatilhos que recusam conta de grupo', count(*)
  FROM pg_trigger WHERE tgname = 'trg_recusar_sintetica' AND NOT tgisinternal;
