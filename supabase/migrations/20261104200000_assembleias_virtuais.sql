-- ============================================================
-- Assembleias virtuais
--
-- A Lei 14.309/2022 acrescentou ao Código Civil a permissão expressa para a
-- assembleia correr por meio electrónico, total ou parcialmente, salvo se a
-- convenção dispuser em contrário. Antes disso era contestado; depois dela é o
-- normal. Este módulo é isso: convocar, pôr a ordem do dia a votos, apurar
-- cada item pela maioria que a lei exige para aquela matéria, e fechar com uma
-- ata que registra tudo.
--
-- ------------------------------------------------------------
-- As quatro decisões jurídicas, e onde estão no código
--
-- 1. QUEM VOTA é o proprietário. O art. 1.335 atribui o direito de voto ao
--    *condômino*; o inquilino não vota. Lê-se de `unidade_moradores` com
--    `vinculo = 'proprietario'`.
--
--    E vota a UNIDADE, não a pessoa: dois proprietários da mesma unidade têm
--    um voto, não dois. Daí a chave única por (pauta, unidade).
--
-- 2. O PESO é proporcional à fração ideal — art. 1.352, parágrafo único: "os
--    votos serão proporcionais às frações ideais no solo e nas outras partes
--    comuns pertencentes a cada condômino, salvo disposição diversa da
--    convenção". É esse "salvo disposição diversa" que obriga a ser
--    configurável: `assembleias.peso_por_fracao`. Por omissão, a regra legal.
--
--    A escolha fica gravada em cada assembleia, não numa configuração global,
--    porque a ata tem de dizer por que regra foi apurada. Mudar a convenção
--    em Maio não pode reescrever o apuramento de Março.
--
-- 3. INADIMPLENTE NÃO VOTA. O art. 1.335, III dá o direito de "votar nas
--    deliberações da assembleia e delas participar, ESTANDO QUITE". A
--    verificação corre no momento do voto, contra as mesmas cobranças que o
--    motor de inadimplência mantém. Também é configurável por assembleia
--    (`exige_quitacao`), porque há convenções que dispensam, e porque o
--    síndico precisa de poder correr uma assembleia informativa sem a trava.
--
-- 4. CADA MATÉRIA TEM A SUA MAIORIA, E BASES DIFERENTES. É aqui que os
--    sistemas erram e as deliberações caem:
--
--      maioria dos presentes      art. 1.352       base: quem votou
--      maioria dos condôminos     art. 1.341, II   base: todos os elegíveis
--      dois terços                art. 1.351 e
--                                 art. 1.341, I    base: todos os elegíveis
--      três quartos               art. 1.337       base: todos os elegíveis
--      unanimidade                art. 1.351       base: todos os elegíveis
--
--    "Maioria dos presentes" conta sobre quem apareceu; "dois terços dos
--    condôminos" conta sobre o condomínio inteiro, e quem não vota conta
--    contra. Tratar os dois com o mesmo denominador aprova deliberações que
--    não foram aprovadas.
--
-- ------------------------------------------------------------
-- Quórum de instalação
--
-- Em primeira convocação o art. 1.352 exige presentes que representem pelo
-- menos metade das frações ideais. Em segunda, o art. 1.353 deixa deliberar
-- "com qualquer número". `quorum_instalacao` guarda essa fracção: 0,5 na
-- primeira, 0 na segunda. Sem quórum, a assembleia não apura — e a ata diz
-- que não apurou, em vez de inventar um resultado.
--
-- ------------------------------------------------------------
-- O que fica deliberadamente de fora, e porquê
--
--   * PROCURAÇÕES. O condômino pode fazer-se representar, e isso precisa de
--     documento, validação e limite de procurações por procurador. É um módulo
--     próprio, não um campo.
--   * SEGUNDA CONVOCAÇÃO AUTOMÁTICA. Aqui abre-se uma assembleia nova com
--     `quorum_instalacao` em 0. Automatizar a cadeia exige saber o que a
--     convenção manda sobre o intervalo.
--   * VIDEOCONFERÊNCIA. O sistema guarda o link; a chamada é no Meet ou no
--     Zoom. Construir vídeo aqui seria substituir ferramentas que já existem.
--   * ASSINATURA ELECTRÓNICA DA ATA. A ata fica gravada e imutável; assinar
--     com certificado é outra coisa.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assembleia_tipo') THEN
    CREATE TYPE public.assembleia_tipo AS ENUM ('ordinaria', 'extraordinaria');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assembleia_modo') THEN
    CREATE TYPE public.assembleia_modo AS ENUM ('virtual', 'presencial', 'hibrida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assembleia_status') THEN
    CREATE TYPE public.assembleia_status AS ENUM
      ('rascunho', 'convocada', 'em_curso', 'encerrada', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maioria_tipo') THEN
    CREATE TYPE public.maioria_tipo AS ENUM (
      'maioria_presentes',
      'maioria_condominos',
      'dois_tercos_condominos',
      'tres_quartos_condominos',
      'unanimidade'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voto_opcao') THEN
    CREATE TYPE public.voto_opcao AS ENUM ('sim', 'nao', 'abstencao');
  END IF;
END $$;

-- ------------------------------------------------------------
-- A assembleia.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assembleias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  tipo public.assembleia_tipo NOT NULL DEFAULT 'extraordinaria',
  modo public.assembleia_modo NOT NULL DEFAULT 'virtual',
  status public.assembleia_status NOT NULL DEFAULT 'rascunho',

  titulo text NOT NULL,
  edital text,
  local text,
  link_videoconferencia text,

  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,

  -- As regras de apuramento, gravadas aqui para a ata poder dizer por que
  -- regra foi apurada.
  peso_por_fracao boolean NOT NULL DEFAULT true,
  exige_quitacao boolean NOT NULL DEFAULT true,
  quorum_instalacao numeric(5,4) NOT NULL DEFAULT 0.5,

  convocada_em timestamptz,
  convocada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  encerrada_em timestamptz,
  encerrada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ata jsonb,

  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT janela_valida CHECK (fim > inicio),
  CONSTRAINT quorum_valido CHECK (quorum_instalacao >= 0 AND quorum_instalacao <= 1)
);

CREATE INDEX IF NOT EXISTS idx_assembleias_cond
  ON public.assembleias (condominio_id, inicio DESC);

-- ------------------------------------------------------------
-- Os itens da ordem do dia.
--
-- Cada um tem a sua maioria, porque cada matéria tem a sua. `aberta_em` e
-- `fechada_em` controlam quando se aceita voto: a votação de um item pode
-- abrir e fechar sem arrastar os outros.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assembleia_pautas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 1,
  titulo text NOT NULL,
  descricao text,
  maioria public.maioria_tipo NOT NULL DEFAULT 'maioria_presentes',
  aberta_em timestamptz,
  fechada_em timestamptz,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pautas_assembleia
  ON public.assembleia_pautas (assembleia_id, ordem);

-- ------------------------------------------------------------
-- Os votos.
--
-- Um por unidade e por item — é a unidade que vota, não a pessoa. `peso` e
-- `fracao_ideal` ficam gravados no momento do voto: se a fração for corrigida
-- depois, o apuramento daquela assembleia não se altera.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assembleia_votos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id uuid NOT NULL REFERENCES public.assembleia_pautas(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opcao public.voto_opcao NOT NULL,
  peso numeric(12,6) NOT NULL,
  fracao_ideal numeric(8,6),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT um_voto_por_unidade UNIQUE (pauta_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_votos_pauta ON public.assembleia_votos (pauta_id);

DROP TRIGGER IF EXISTS trg_assembleias_upd ON public.assembleias;
CREATE TRIGGER trg_assembleias_upd BEFORE UPDATE ON public.assembleias
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pautas_upd ON public.assembleia_pautas;
CREATE TRIGGER trg_pautas_upd BEFORE UPDATE ON public.assembleia_pautas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------
-- RLS
--
-- Mesma lição do balancete: a escrita não passa pelo cliente. Aqui ainda mais,
-- porque um UPDATE directo num voto ou num resultado é fraude na deliberação,
-- não um erro de dados. Só leitura, e só pelas funções abaixo.
-- ------------------------------------------------------------
ALTER TABLE public.assembleias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_pautas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_votos ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.assembleias FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.assembleia_pautas FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.assembleia_votos FROM authenticated, anon;

-- O síndico vê os rascunhos; o condómino vê a partir da convocação. Um edital
-- em rascunho não é uma convocação.
DROP POLICY IF EXISTS "Gestao ve assembleias" ON public.assembleias;
CREATE POLICY "Gestao ve assembleias"
  ON public.assembleias FOR SELECT TO authenticated
  USING (public.is_sindico(auth.uid(), condominio_id));

DROP POLICY IF EXISTS "Membros veem assembleias convocadas" ON public.assembleias;
CREATE POLICY "Membros veem assembleias convocadas"
  ON public.assembleias FOR SELECT TO authenticated
  USING (status <> 'rascunho' AND public.is_member_of(auth.uid(), condominio_id));

DROP POLICY IF EXISTS "Membros veem pautas" ON public.assembleia_pautas;
CREATE POLICY "Membros veem pautas"
  ON public.assembleia_pautas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assembleias a
     WHERE a.id = assembleia_id
       AND (public.is_sindico(auth.uid(), a.condominio_id)
            OR (a.status <> 'rascunho' AND public.is_member_of(auth.uid(), a.condominio_id)))
  ));

-- Os votos são nominais — a ata de condomínio registra quem votou como. Mas
-- enquanto a votação está aberta ninguém vê os dos outros: saber o parcial
-- influencia quem ainda não votou. Depois de fechada, todos os membros veem.
DROP POLICY IF EXISTS "Votos visiveis apos o fecho" ON public.assembleia_votos;
CREATE POLICY "Votos visiveis apos o fecho"
  ON public.assembleia_votos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assembleia_pautas p
      JOIN public.assembleias a ON a.id = p.assembleia_id
     WHERE p.id = pauta_id
       AND public.is_member_of(auth.uid(), a.condominio_id)
       AND p.fechada_em IS NOT NULL
  ));

DROP POLICY IF EXISTS "Proprio voto sempre visivel" ON public.assembleia_votos;
CREATE POLICY "Proprio voto sempre visivel"
  ON public.assembleia_votos FOR SELECT TO authenticated
  USING (public.is_morador_da_unidade(auth.uid(), unidade_id));

-- ------------------------------------------------------------
-- A unidade está em atraso?
--
-- Mesma base que o motor de inadimplência usa, mesma data de referência em São
-- Paulo. Separada numa função porque é a trava do art. 1.335, III e tem de
-- poder ser explicada a quem for recusado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unidade_inadimplente(
  _unidade_id uuid,
  _referencia date DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cobrancas c
     WHERE c.unidade_id = _unidade_id
       AND c.status IN ('pendente', 'vencida', 'parcial')
       AND c.vencimento < COALESCE(_referencia, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
       AND (c.valor + c.multa + c.juros - c.desconto - c.valor_pago) > 0
  )
$$;

REVOKE ALL ON FUNCTION public.unidade_inadimplente(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unidade_inadimplente(uuid, date) TO authenticated;

-- ------------------------------------------------------------
-- Quem pode votar nesta assembleia, e quem não pode e porquê.
--
-- Devolve TODAS as unidades do condomínio, com o peso e o motivo da
-- inelegibilidade quando há. O síndico precisa da lista inteira para saber com
-- o que conta, e o apuramento precisa do total elegível como denominador das
-- maiorias "dos condôminos".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.elegibilidade_assembleia(_assembleia_id uuid)
RETURNS TABLE(
  unidade_id uuid,
  bloco text,
  numero text,
  fracao_ideal numeric,
  peso numeric,
  elegivel boolean,
  motivo text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cond uuid;
  _peso_fracao boolean;
  _quitacao boolean;
BEGIN
  SELECT a.condominio_id, a.peso_por_fracao, a.exige_quitacao
    INTO _cond, _peso_fracao, _quitacao
    FROM public.assembleias a WHERE a.id = _assembleia_id;

  IF _cond IS NULL THEN RAISE EXCEPTION 'assembleia_nao_encontrada'; END IF;

  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_member_of(auth.uid(), _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT u.id,
         u.bloco,
         u.numero,
         u.fracao_ideal,
         CASE WHEN _peso_fracao THEN COALESCE(u.fracao_ideal, 0) ELSE 1 END::numeric,
         -- Sem fração preenchida não há peso, e sem peso não há voto que se
         -- possa apurar. Falha alto em vez de contar a unidade como zero.
         (NOT (_peso_fracao AND COALESCE(u.fracao_ideal, 0) <= 0))
           AND EXISTS (SELECT 1 FROM public.unidade_moradores m
                        WHERE m.unidade_id = u.id AND m.vinculo = 'proprietario')
           AND NOT (_quitacao AND public.unidade_inadimplente(u.id)),
         CASE
           WHEN _peso_fracao AND COALESCE(u.fracao_ideal, 0) <= 0
             THEN 'fração ideal não preenchida'
           WHEN NOT EXISTS (SELECT 1 FROM public.unidade_moradores m
                             WHERE m.unidade_id = u.id AND m.vinculo = 'proprietario')
             THEN 'sem proprietário registado'
           WHEN _quitacao AND public.unidade_inadimplente(u.id)
             THEN 'em atraso (art. 1.335, III)'
           ELSE NULL
         END
    FROM public.unidades u
   WHERE u.condominio_id = _cond
   ORDER BY u.bloco NULLS FIRST, u.numero;
END;
$$;

REVOKE ALL ON FUNCTION public.elegibilidade_assembleia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.elegibilidade_assembleia(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Gestão da assembleia: criar, pautar, convocar, abrir, fechar.
--
-- Tudo restrito ao síndico (`is_sindico`, que o admin herda). Convocar uma
-- assembleia e pôr matérias a votos não é gestão financeira — é a competência
-- do art. 1.348, e não se delega ao contador.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_assembleia(
  _condominio_id uuid,
  _titulo text,
  _tipo public.assembleia_tipo,
  _modo public.assembleia_modo,
  _inicio timestamptz,
  _fim timestamptz,
  _edital text DEFAULT NULL,
  _local text DEFAULT NULL,
  _link text DEFAULT NULL,
  _peso_por_fracao boolean DEFAULT true,
  _exige_quitacao boolean DEFAULT true,
  _quorum_instalacao numeric DEFAULT 0.5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_sindico(_uid, _condominio_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _fim <= _inicio THEN RAISE EXCEPTION 'janela_invalida'; END IF;

  INSERT INTO public.assembleias (condominio_id, titulo, tipo, modo, inicio, fim,
    edital, local, link_videoconferencia, peso_por_fracao, exige_quitacao,
    quorum_instalacao, criado_por)
  VALUES (_condominio_id, _titulo, _tipo, _modo, _inicio, _fim,
    _edital, _local, _link, _peso_por_fracao, _exige_quitacao,
    _quorum_instalacao, _uid)
  RETURNING id INTO _id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, _uid, 'assembleia_criada', 'assembleias', _id,
          jsonb_build_object('titulo', _titulo, 'inicio', _inicio));

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_assembleia(uuid, text, public.assembleia_tipo,
  public.assembleia_modo, timestamptz, timestamptz, text, text, text, boolean, boolean, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_assembleia(uuid, text, public.assembleia_tipo,
  public.assembleia_modo, timestamptz, timestamptz, text, text, text, boolean, boolean, numeric)
  TO authenticated;

-- Acrescenta um item à ordem do dia. Só antes da convocação: o edital tem de
-- levar a ordem do dia, e acrescentar matéria depois de convocar é convocar
-- para uma coisa e deliberar sobre outra.
CREATE OR REPLACE FUNCTION public.adicionar_pauta(
  _assembleia_id uuid,
  _titulo text,
  _maioria public.maioria_tipo,
  _descricao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _status public.assembleia_status;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.status INTO _cond, _status
    FROM public.assembleias a WHERE a.id = _assembleia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'assembleia_nao_encontrada'; END IF;
  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _status <> 'rascunho' THEN
    RAISE EXCEPTION 'assembleia_ja_convocada'
      USING HINT = 'A ordem do dia vai no edital e não pode crescer depois da convocação.';
  END IF;

  INSERT INTO public.assembleia_pautas (assembleia_id, titulo, descricao, maioria, ordem)
  VALUES (_assembleia_id, _titulo, _descricao, _maioria,
          COALESCE((SELECT max(p.ordem) + 1 FROM public.assembleia_pautas p
                     WHERE p.assembleia_id = _assembleia_id), 1))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.adicionar_pauta(uuid, text, public.maioria_tipo, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_pauta(uuid, text, public.maioria_tipo, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.remover_pauta(_pauta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _status public.assembleia_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.status INTO _cond, _status
    FROM public.assembleia_pautas p JOIN public.assembleias a ON a.id = p.assembleia_id
   WHERE p.id = _pauta_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'pauta_nao_encontrada'; END IF;
  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status <> 'rascunho' THEN RAISE EXCEPTION 'assembleia_ja_convocada'; END IF;

  DELETE FROM public.assembleia_pautas WHERE id = _pauta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remover_pauta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_pauta(uuid) TO authenticated;

-- Convoca: é aqui que a assembleia passa a existir para os condóminos.
--
-- Exige ordem do dia. Uma convocação sem matérias não convoca nada, e o art.
-- 1.354 manda que o edital diga sobre o que se vai deliberar.
CREATE OR REPLACE FUNCTION public.convocar_assembleia(_assembleia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _status public.assembleia_status;
  _inicio timestamptz;
  _pautas int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.status, a.inicio INTO _cond, _status, _inicio
    FROM public.assembleias a WHERE a.id = _assembleia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'assembleia_nao_encontrada'; END IF;
  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status <> 'rascunho' THEN RAISE EXCEPTION 'assembleia_ja_convocada'; END IF;

  SELECT count(*) INTO _pautas FROM public.assembleia_pautas WHERE assembleia_id = _assembleia_id;
  IF _pautas = 0 THEN
    RAISE EXCEPTION 'sem_ordem_do_dia'
      USING HINT = 'O edital tem de dizer sobre o que se vai deliberar.';
  END IF;

  IF _inicio <= now() THEN
    RAISE EXCEPTION 'inicio_no_passado'
      USING HINT = 'Convoque antes da data de início.';
  END IF;

  UPDATE public.assembleias
     SET status = 'convocada', convocada_em = now(), convocada_por = _uid
   WHERE id = _assembleia_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'assembleia_convocada', 'assembleias', _assembleia_id,
          jsonb_build_object('pautas', _pautas, 'inicio', _inicio,
                             'horas_de_antecedencia',
                             round(EXTRACT(EPOCH FROM (_inicio - now())) / 3600)));
END;
$$;

REVOKE ALL ON FUNCTION public.convocar_assembleia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convocar_assembleia(uuid) TO authenticated;

-- Abre a assembleia e, com ela, a votação de um item.
CREATE OR REPLACE FUNCTION public.abrir_votacao(_pauta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _assembleia uuid;
  _status public.assembleia_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.id, a.status INTO _cond, _assembleia, _status
    FROM public.assembleia_pautas p JOIN public.assembleias a ON a.id = p.assembleia_id
   WHERE p.id = _pauta_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'pauta_nao_encontrada'; END IF;
  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _status NOT IN ('convocada', 'em_curso') THEN
    RAISE EXCEPTION 'assembleia_nao_aberta'
      USING HINT = 'Convoque a assembleia antes de pôr matérias a votos.';
  END IF;

  IF _status = 'convocada' THEN
    UPDATE public.assembleias SET status = 'em_curso' WHERE id = _assembleia;
  END IF;

  UPDATE public.assembleia_pautas
     SET aberta_em = COALESCE(aberta_em, now()), fechada_em = NULL, resultado = NULL
   WHERE id = _pauta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.abrir_votacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_votacao(uuid) TO authenticated;

-- ------------------------------------------------------------
-- O VOTO.
--
-- Todas as travas num sítio só, pela ordem em que importam. Falha alto e com o
-- motivo: a quem é recusado o voto numa assembleia é devida a razão.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_voto(
  _pauta_id uuid,
  _unidade_id uuid,
  _opcao public.voto_opcao
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _status public.assembleia_status;
  _aberta timestamptz;
  _fechada timestamptz;
  _peso_fracao boolean;
  _quitacao boolean;
  _fracao numeric;
  _peso numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.status, p.aberta_em, p.fechada_em,
         a.peso_por_fracao, a.exige_quitacao
    INTO _cond, _status, _aberta, _fechada, _peso_fracao, _quitacao
    FROM public.assembleia_pautas p JOIN public.assembleias a ON a.id = p.assembleia_id
   WHERE p.id = _pauta_id;

  IF _cond IS NULL THEN RAISE EXCEPTION 'pauta_nao_encontrada'; END IF;

  -- A unidade é deste condomínio?
  SELECT u.fracao_ideal INTO _fracao
    FROM public.unidades u WHERE u.id = _unidade_id AND u.condominio_id = _cond;
  IF NOT FOUND THEN RAISE EXCEPTION 'unidade_de_outro_condominio'; END IF;

  -- Vota o proprietário. O art. 1.335 dá o voto ao condómino; o inquilino
  -- participa mas não delibera.
  IF NOT EXISTS (
    SELECT 1 FROM public.unidade_moradores m
     WHERE m.unidade_id = _unidade_id AND m.user_id = _uid AND m.vinculo = 'proprietario'
  ) THEN
    RAISE EXCEPTION 'nao_e_proprietario'
      USING HINT = 'Só o proprietário da unidade vota (Código Civil, art. 1.335).';
  END IF;

  IF _status <> 'em_curso' THEN RAISE EXCEPTION 'assembleia_nao_em_curso'; END IF;
  IF _aberta IS NULL THEN RAISE EXCEPTION 'votacao_nao_aberta'; END IF;
  IF _fechada IS NOT NULL THEN RAISE EXCEPTION 'votacao_encerrada'; END IF;

  IF _quitacao AND public.unidade_inadimplente(_unidade_id) THEN
    RAISE EXCEPTION 'inadimplente_nao_vota'
      USING HINT = 'O art. 1.335, III dá o direito de voto ao condómino que esteja quite.';
  END IF;

  _peso := CASE WHEN _peso_fracao THEN COALESCE(_fracao, 0) ELSE 1 END;

  IF _peso <= 0 THEN
    RAISE EXCEPTION 'sem_peso_de_voto'
      USING HINT = 'A fração ideal da unidade não está preenchida.';
  END IF;

  -- Mudar o voto enquanto a votação está aberta é legítimo; depois de fechada
  -- é impossível, porque a trava acima já recusou.
  INSERT INTO public.assembleia_votos (pauta_id, unidade_id, user_id, opcao, peso, fracao_ideal)
  VALUES (_pauta_id, _unidade_id, _uid, _opcao, _peso, _fracao)
  ON CONFLICT (pauta_id, unidade_id) DO UPDATE
    SET opcao = EXCLUDED.opcao,
        user_id = EXCLUDED.user_id,
        peso = EXCLUDED.peso,
        fracao_ideal = EXCLUDED.fracao_ideal,
        registrado_em = now();
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_voto(uuid, uuid, public.voto_opcao) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_voto(uuid, uuid, public.voto_opcao) TO authenticated;

-- ------------------------------------------------------------
-- APURAMENTO.
--
-- A parte que invalida deliberações quando está errada. Três bases diferentes,
-- e cada maioria usa a sua:
--
--   total_elegivel  todas as unidades que podiam votar. É o denominador das
--                   maiorias "dos condôminos" — quem não vota conta contra.
--   presentes       as que votaram. Numa assembleia virtual, votar é estar
--                   presente.
--   votos_validos   sim + não, sem abstenções. É o denominador da "maioria dos
--                   presentes": a abstenção é presença, não é voto.
--
-- O quórum de instalação é verificado primeiro. Sem ele não há deliberação, e
-- o resultado diz `sem_quorum` em vez de inventar uma aprovação.
--
-- Não grava: `fechar_votacao` é que grava. Assim o síndico pode ver o parcial
-- durante a votação sem o fixar.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apurar_pauta(_pauta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cond uuid;
  _assembleia uuid;
  _maioria public.maioria_tipo;
  _quorum numeric;
  _peso_fracao boolean;
  _total numeric;
  _unidades_elegiveis int;
  _sim numeric := 0;
  _nao numeric := 0;
  _abst numeric := 0;
  _presentes numeric;
  _validos numeric;
  _necessario numeric;
  _base text;
  _aprovado boolean;
  _tem_quorum boolean;
BEGIN
  SELECT a.condominio_id, a.id, p.maioria, a.quorum_instalacao, a.peso_por_fracao
    INTO _cond, _assembleia, _maioria, _quorum, _peso_fracao
    FROM public.assembleia_pautas p JOIN public.assembleias a ON a.id = p.assembleia_id
   WHERE p.id = _pauta_id;

  IF _cond IS NULL THEN RAISE EXCEPTION 'pauta_nao_encontrada'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_member_of(auth.uid(), _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(sum(e.peso), 0), count(*)::int
    INTO _total, _unidades_elegiveis
    FROM public.elegibilidade_assembleia(_assembleia) e
   WHERE e.elegivel;

  -- Só contam os votos de unidades elegíveis AGORA.
  --
  -- Sem este filtro, uma unidade que votou e depois caiu em atraso ficava fora
  -- do denominador e dentro do numerador: o primeiro teste desta função deu
  -- presentes de 1,0 contra um total elegível de 0,75 — 133% de presença. Um
  -- apuramento que não fecha consigo mesmo não se defende em assembleia
  -- nenhuma, mesmo que o resultado por acaso saísse certo.
  --
  -- A elegibilidade é apreciada no momento do apuramento, que é o momento em
  -- que a deliberação se toma. Enquanto a votação está aberta o parcial pode
  -- mover-se — se alguém regularizar, entra; se cair em atraso, sai. Quando
  -- `fechar_votacao` grava, fica fixo.
  SELECT COALESCE(sum(v.peso) FILTER (WHERE v.opcao = 'sim'), 0),
         COALESCE(sum(v.peso) FILTER (WHERE v.opcao = 'nao'), 0),
         COALESCE(sum(v.peso) FILTER (WHERE v.opcao = 'abstencao'), 0)
    INTO _sim, _nao, _abst
    FROM public.assembleia_votos v
   WHERE v.pauta_id = _pauta_id
     AND EXISTS (SELECT 1 FROM public.elegibilidade_assembleia(_assembleia) e
                  WHERE e.unidade_id = v.unidade_id AND e.elegivel);

  _presentes := _sim + _nao + _abst;
  _validos := _sim + _nao;

  -- Quórum de instalação: art. 1.352 em primeira convocação, dispensado na
  -- segunda (art. 1.353), e é isso que `quorum_instalacao = 0` expressa.
  _tem_quorum := _total > 0 AND _presentes >= _total * _quorum;

  CASE _maioria
    WHEN 'maioria_presentes' THEN
      _base := 'votos válidos dos presentes (art. 1.352)';
      _necessario := _validos / 2;
      _aprovado := _validos > 0 AND _sim > _necessario;
    WHEN 'maioria_condominos' THEN
      _base := 'todos os condóminos elegíveis (art. 1.341, II)';
      _necessario := _total / 2;
      _aprovado := _sim > _necessario;
    WHEN 'dois_tercos_condominos' THEN
      _base := 'dois terços dos condóminos elegíveis (art. 1.351)';
      _necessario := _total * 2 / 3;
      _aprovado := _sim >= _necessario;
    WHEN 'tres_quartos_condominos' THEN
      _base := 'três quartos dos condóminos elegíveis (art. 1.337)';
      _necessario := _total * 3 / 4;
      _aprovado := _sim >= _necessario;
    WHEN 'unanimidade' THEN
      _base := 'unanimidade dos condóminos elegíveis (art. 1.351)';
      _necessario := _total;
      _aprovado := _total > 0 AND _sim >= _total;
  END CASE;

  IF NOT _tem_quorum THEN
    _aprovado := false;
  END IF;

  RETURN jsonb_build_object(
    'maioria', _maioria,
    'base', _base,
    'peso_por_fracao', _peso_fracao,
    'total_elegivel', _total,
    'unidades_elegiveis', _unidades_elegiveis,
    'presentes', _presentes,
    'votos_validos', _validos,
    'sim', _sim,
    'nao', _nao,
    'abstencao', _abst,
    'necessario', _necessario,
    'quorum_exigido', _total * _quorum,
    'tem_quorum', _tem_quorum,
    'aprovado', _aprovado,
    'situacao', CASE WHEN NOT _tem_quorum THEN 'sem_quorum'
                     WHEN _aprovado THEN 'aprovado'
                     ELSE 'rejeitado' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apurar_pauta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apurar_pauta(uuid) TO authenticated;

-- Fecha a votação e fixa o resultado. A partir daqui os votos ficam visíveis a
-- todos os membros, que é como uma ata de condomínio funciona.
CREATE OR REPLACE FUNCTION public.fechar_votacao(_pauta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _fechada timestamptz;
  _res jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, p.fechada_em INTO _cond, _fechada
    FROM public.assembleia_pautas p JOIN public.assembleias a ON a.id = p.assembleia_id
   WHERE p.id = _pauta_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'pauta_nao_encontrada'; END IF;
  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _fechada IS NOT NULL THEN RAISE EXCEPTION 'votacao_ja_encerrada'; END IF;

  _res := public.apurar_pauta(_pauta_id);

  UPDATE public.assembleia_pautas
     SET fechada_em = now(), resultado = _res
   WHERE id = _pauta_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'votacao_encerrada', 'assembleia_pautas', _pauta_id, _res);

  RETURN _res;
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_votacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_votacao(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Encerra e grava a ata.
--
-- Mesma lógica do balancete: fotografia, não vista ao vivo. A ata registra a
-- regra de apuramento, quem estava elegível, quem votou e como, e o resultado
-- de cada item. Uma unidade que mude de proprietário no mês seguinte não pode
-- alterar a ata de hoje.
--
-- Fecha as votações que ainda estiverem abertas — uma assembleia encerrada com
-- item em aberto seria um item sem deliberação e sem registo de porquê.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encerrar_assembleia(_assembleia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _status public.assembleia_status;
  _p record;
  _ata jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.status INTO _cond, _status
    FROM public.assembleias a WHERE a.id = _assembleia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'assembleia_nao_encontrada'; END IF;
  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status = 'encerrada' THEN RAISE EXCEPTION 'assembleia_ja_encerrada'; END IF;
  IF _status NOT IN ('convocada', 'em_curso') THEN RAISE EXCEPTION 'assembleia_nao_aberta'; END IF;

  FOR _p IN
    SELECT p.id FROM public.assembleia_pautas p
     WHERE p.assembleia_id = _assembleia_id
       AND p.aberta_em IS NOT NULL AND p.fechada_em IS NULL
  LOOP
    PERFORM public.fechar_votacao(_p.id);
  END LOOP;

  SELECT jsonb_build_object(
    'assembleia', to_jsonb(a) - 'ata',
    'elegibilidade', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'unidade', COALESCE(e.bloco || '-', '') || e.numero,
               'fracao_ideal', e.fracao_ideal,
               'peso', e.peso,
               'elegivel', e.elegivel,
               'motivo', e.motivo) ORDER BY e.bloco, e.numero), '[]'::jsonb)
        FROM public.elegibilidade_assembleia(_assembleia_id) e),
    'pautas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'ordem', p.ordem,
               'titulo', p.titulo,
               'descricao', p.descricao,
               'maioria', p.maioria,
               'resultado', p.resultado,
               'votos', (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object(
                          'unidade', COALESCE(u.bloco || '-', '') || u.numero,
                          'opcao', v.opcao,
                          'peso', v.peso,
                          'em', v.registrado_em) ORDER BY u.bloco, u.numero), '[]'::jsonb)
                   FROM public.assembleia_votos v
                   JOIN public.unidades u ON u.id = v.unidade_id
                  WHERE v.pauta_id = p.id)
             ) ORDER BY p.ordem), '[]'::jsonb)
        FROM public.assembleia_pautas p WHERE p.assembleia_id = _assembleia_id)
  ) INTO _ata
  FROM public.assembleias a WHERE a.id = _assembleia_id;

  UPDATE public.assembleias
     SET status = 'encerrada', encerrada_em = now(), encerrada_por = _uid, ata = _ata
   WHERE id = _assembleia_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id)
  VALUES (_cond, _uid, 'assembleia_encerrada', 'assembleias', _assembleia_id);
END;
$$;

REVOKE ALL ON FUNCTION public.encerrar_assembleia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_assembleia(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_assembleia(_assembleia_id uuid, _motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _status public.assembleia_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.status INTO _cond, _status
    FROM public.assembleias a WHERE a.id = _assembleia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'assembleia_nao_encontrada'; END IF;
  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status = 'encerrada' THEN
    RAISE EXCEPTION 'assembleia_ja_encerrada'
      USING HINT = 'Uma assembleia encerrada tem ata e não se cancela.';
  END IF;

  UPDATE public.assembleias SET status = 'cancelada' WHERE id = _assembleia_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'assembleia_cancelada', 'assembleias', _assembleia_id,
          jsonb_build_object('motivo', _motivo));
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_assembleia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_assembleia(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- Guarda a integridade da ata, como no balancete: a camada que protege do
-- próprio código. Uma ata encerrada não se reescreve, e nenhum voto se altera
-- depois de a votação fechar.
--
-- Só INSERT e UPDATE, deliberadamente. A primeira versão guardava também o
-- DELETE, e com isso tornou impossível apagar um condomínio: o `ON DELETE
-- CASCADE` de `condominios` chega às unidades e daí aos votos, e o guard
-- recusava. Deixava a plataforma sem forma de remover um cliente — e sem
-- forma de cumprir um pedido de eliminação ao abrigo da LGPD.
--
-- A troca é favorável: o DELETE directo já está fora do alcance do cliente,
-- porque o privilégio de escrita está revogado de `authenticated` e `anon`.
-- O que o guard tem de impedir é a reescrita silenciosa de um resultado
-- apurado, e isso acontece por UPDATE, não por cascata.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_assembleias_integridade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'assembleias' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'encerrada' THEN
      RAISE EXCEPTION 'assembleia_encerrada_imutavel'
        USING HINT = 'A ata está gravada e não se altera.';
    END IF;
    RETURN NEW;
  END IF;

  -- assembleia_votos
  IF EXISTS (SELECT 1 FROM public.assembleia_pautas p
              WHERE p.id = NEW.pauta_id AND p.fechada_em IS NOT NULL) THEN
    RAISE EXCEPTION 'voto_apurado_imutavel'
      USING HINT = 'A votação deste item já foi apurada.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_assembleias_integridade() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assembleias_guard ON public.assembleias;
CREATE TRIGGER trg_assembleias_guard
  BEFORE UPDATE ON public.assembleias
  FOR EACH ROW EXECUTE FUNCTION public.guard_assembleias_integridade();

DROP TRIGGER IF EXISTS trg_votos_guard ON public.assembleia_votos;
CREATE TRIGGER trg_votos_guard
  BEFORE INSERT OR UPDATE ON public.assembleia_votos
  FOR EACH ROW EXECUTE FUNCTION public.guard_assembleias_integridade();
