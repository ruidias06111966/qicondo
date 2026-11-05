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
