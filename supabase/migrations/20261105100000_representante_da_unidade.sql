-- Representante da unidade nas assembleias.
--
-- O PROBLEMA QUE ISTO FECHA
--
-- `registrar_voto` aceitava o voto de qualquer pessoa ligada à unidade com
-- `vinculo = 'proprietario'`, e gravava com
-- `ON CONFLICT (pauta_id, unidade_id) DO UPDATE`. Numa unidade com dois
-- coproprietários isso dava um resultado silenciosamente errado: ambos podiam
-- votar, o último sobrepunha o primeiro, e nenhum dos dois ficava a saber.
-- A acta registava a vontade de quem clicou mais tarde, não a da unidade.
--
-- O QUE A LEI DIZ
--
-- O art. 1.335, III dá o direito de voto ao condómino. Quando a unidade
-- pertence a mais de uma pessoa, há condomínio sobre a própria unidade, e o
-- art. 1.314 manda que os comproprietários exerçam em conjunto os direitos
-- sobre a coisa comum. A unidade continua a ter um voto só — o que varia é
-- quem o exerce. Na prática condominial resolve-se por designação: os
-- comproprietários indicam quem os representa, e a administração regista.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
-- 1. Coluna `representante` em `unidade_moradores`, com índice único parcial:
--    no máximo um representante por unidade. É a trava real — não depende de
--    a interface se portar bem.
-- 2. Só um proprietário pode ser representante (CHECK). O inquilino participa
--    da assembleia mas não delibera.
-- 3. Designação automática no caso comum: unidade com um único proprietário
--    não precisa de acto nenhum, o dono é o representante.
-- 4. Promoção automática quando o representante sai, para a unidade nunca
--    ficar sem quem a represente por descuido do cadastro.
-- 5. `definir_representante`, reservada ao síndico. A escolha é dos
--    comproprietários; o que a administração faz é registá-la. Se qualquer
--    coproprietário pudesse chamar a si a representação, bastava fazê-lo
--    minutos antes da votação para tomar a unidade ao outro.
-- 6. `registrar_voto` passa a exigir a representação.
-- 7. `elegibilidade_assembleia` passa a dizer, por unidade, se é este
--    utilizador que vota e quem é o representante — para a interface poder
--    explicar em vez de só recusar.
--
-- NOTA SOBRE `principal`
--
-- A coluna `principal` já existia e não é lida em lado nenhum. Não lhe dou
-- este significado de propósito: são coisas diferentes. `principal` é o morador
-- de contacto da unidade, que pode ser o inquilino; o representante tem de ser
-- proprietário. Numa unidade arrendada as duas apontam para pessoas distintas.


-- ============================================================
-- 1. ESTRUTURA
-- ============================================================

ALTER TABLE public.unidade_moradores
  ADD COLUMN IF NOT EXISTS representante boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.unidade_moradores.representante IS
  'Quem exerce o voto da unidade em assembleia (art. 1.335, III c/c art. 1.314). '
  'No máximo um por unidade, e sempre um proprietário.';

-- Só proprietário representa.
ALTER TABLE public.unidade_moradores
  DROP CONSTRAINT IF EXISTS unidade_moradores_representante_e_proprietario;

ALTER TABLE public.unidade_moradores
  ADD CONSTRAINT unidade_moradores_representante_e_proprietario
  CHECK (NOT representante OR vinculo = 'proprietario');

-- Um por unidade. Esta é a garantia que não depende da interface.
CREATE UNIQUE INDEX IF NOT EXISTS unidade_moradores_um_representante
  ON public.unidade_moradores (unidade_id)
  WHERE representante;


-- ============================================================
-- 2. BACKFILL
-- ============================================================
-- Unidades que já têm proprietário ficam com o mais antigo como representante.
-- É o critério menos arbitrário disponível: quem foi registado primeiro.
-- O síndico pode mudar a seguir com `definir_representante`.

UPDATE public.unidade_moradores m
   SET representante = true
  WHERE m.id IN (
    SELECT DISTINCT ON (x.unidade_id) x.id
      FROM public.unidade_moradores x
     WHERE x.vinculo = 'proprietario'
       AND NOT EXISTS (
         SELECT 1 FROM public.unidade_moradores r
          WHERE r.unidade_id = x.unidade_id AND r.representante
       )
     ORDER BY x.unidade_id, x.created_at, x.id
  );


-- ============================================================
-- 3. MANUTENÇÃO AUTOMÁTICA
-- ============================================================
-- Duas regras, para o cadastro não produzir unidades mudas:
--
--   a) o primeiro proprietário de uma unidade é representante sem acto nenhum;
--   b) se o representante sair ou deixar de ser proprietário, o mais antigo
--      dos restantes assume.
--
-- A alínea (b) existe porque a alternativa é pior: uma unidade sem
-- representante não vota, e ninguém dá por isso até ao dia da assembleia.

CREATE OR REPLACE FUNCTION public.unidade_moradores_antes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Deixar de ser proprietário tira a representação. Sem isto o CHECK
  -- rejeitava a alteração e o síndico não conseguia registar a venda.
  IF NEW.vinculo <> 'proprietario' THEN
    NEW.representante := false;
  END IF;

  -- Primeiro proprietário da unidade: representa, sem precisar de designação.
  --
  -- A mesma bandeira de `definir_representante` desliga isto. Sem ela, o
  -- UPDATE que larga o representante actual entrava aqui, via que a unidade
  -- tinha ficado sem nenhum, e repunha a linha que se estava a libertar —
  -- a designação nunca chegava a acontecer.
  IF NEW.vinculo = 'proprietario' AND NOT NEW.representante
     AND coalesce(current_setting('qicond.a_designar_representante', true), '') <> '1' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.unidade_moradores r
       WHERE r.unidade_id = NEW.unidade_id
         AND r.representante
         AND (TG_OP = 'INSERT' OR r.id <> NEW.id)
    ) THEN
      NEW.representante := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unidade_moradores_antes ON public.unidade_moradores;
CREATE TRIGGER trg_unidade_moradores_antes
  BEFORE INSERT OR UPDATE ON public.unidade_moradores
  FOR EACH ROW EXECUTE FUNCTION public.unidade_moradores_antes();


CREATE OR REPLACE FUNCTION public.unidade_moradores_repor_representante()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Só corre para a instrução de fora. Sem esta trava há recursão infinita:
  -- o UPDATE que este gatilho faz dispara o próprio gatilho, e um UPDATE que
  -- não afecta linha nenhuma dispara-o na mesma — um gatilho de statement
  -- corre mesmo com zero linhas. Não para sozinho; esgota a pilha.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  -- `definir_representante` desliga esta promoção enquanto troca o titular.
  -- Sem a trava, o UPDATE que larga o representante actual dispara este
  -- gatilho, que promove o coproprietário mais antigo; o UPDATE seguinte
  -- marcava o designado e colidia com o índice único. A promoção automática
  -- é para descuidos do cadastro, não para uma troca deliberada em curso.
  IF coalesce(current_setting('qicond.a_designar_representante', true), '') = '1' THEN
    RETURN NULL;
  END IF;

  -- Para cada unidade mexida que ficou sem representante mas ainda tem
  -- proprietário, promove o mais antigo.
  UPDATE public.unidade_moradores m
     SET representante = true
    WHERE m.id IN (
      SELECT DISTINCT ON (x.unidade_id) x.id
        FROM public.unidade_moradores x
       WHERE x.vinculo = 'proprietario'
         AND x.unidade_id IN (SELECT unidade_id FROM afetadas)
         AND NOT EXISTS (
           SELECT 1 FROM public.unidade_moradores r
            WHERE r.unidade_id = x.unidade_id AND r.representante
         )
       ORDER BY x.unidade_id, x.created_at, x.id
    );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_unidade_moradores_repor_del ON public.unidade_moradores;
CREATE TRIGGER trg_unidade_moradores_repor_del
  AFTER DELETE ON public.unidade_moradores
  REFERENCING OLD TABLE AS afetadas
  FOR EACH STATEMENT EXECUTE FUNCTION public.unidade_moradores_repor_representante();

DROP TRIGGER IF EXISTS trg_unidade_moradores_repor_upd ON public.unidade_moradores;
CREATE TRIGGER trg_unidade_moradores_repor_upd
  AFTER UPDATE ON public.unidade_moradores
  REFERENCING OLD TABLE AS afetadas
  FOR EACH STATEMENT EXECUTE FUNCTION public.unidade_moradores_repor_representante();


-- ============================================================
-- 4. DESIGNAÇÃO
-- ============================================================
-- Reservada ao síndico. A escolha é dos comproprietários — o que aqui se faz
-- é registá-la. Ver o cabeçalho para a razão de não a abrir ao coproprietário.

CREATE OR REPLACE FUNCTION public.definir_representante(
  _unidade_id uuid,
  _user_id uuid
)
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

  SELECT u.condominio_id INTO _cond
    FROM public.unidades u WHERE u.id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_nao_encontrada'; END IF;

  IF NOT public.is_sindico(_uid, _cond) THEN
    RAISE EXCEPTION 'forbidden'
      USING HINT = 'Só o síndico regista a designação de representante.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.unidade_moradores m
     WHERE m.unidade_id = _unidade_id
       AND m.user_id = _user_id
       AND m.vinculo = 'proprietario'
  ) THEN
    RAISE EXCEPTION 'nao_e_proprietario_da_unidade'
      USING HINT = 'O representante tem de ser proprietário da unidade.';
  END IF;

  -- Larga o anterior antes de marcar o novo: o índice único só admite um, e
  -- numa só instrução a ordem das linhas não é garantida.
  --
  -- A bandeira suspende a promoção automática entre os dois UPDATE. É local à
  -- transação (`set_config(..., true)`), por isso desaparece sozinha no fim,
  -- inclusive se algo rebentar pelo meio.
  PERFORM set_config('qicond.a_designar_representante', '1', true);

  UPDATE public.unidade_moradores
     SET representante = false
   WHERE unidade_id = _unidade_id AND representante AND user_id <> _user_id;

  UPDATE public.unidade_moradores
     SET representante = true
   WHERE unidade_id = _unidade_id AND user_id = _user_id;

  PERFORM set_config('qicond.a_designar_representante', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.definir_representante(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_representante(uuid, uuid) TO authenticated;


-- ============================================================
-- 5. O VOTO
-- ============================================================
-- Única alteração de fundo: deixa de bastar ser proprietário, passa a ser
-- preciso representar a unidade.

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
  _quem text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT a.condominio_id, a.status, p.aberta_em, p.fechada_em,
         a.peso_por_fracao, a.exige_quitacao
    INTO _cond, _status, _aberta, _fechada, _peso_fracao, _quitacao
    FROM public.assembleia_pautas p JOIN public.assembleias a ON a.id = p.assembleia_id
   WHERE p.id = _pauta_id;

  IF _cond IS NULL THEN RAISE EXCEPTION 'pauta_nao_encontrada'; END IF;

  SELECT u.fracao_ideal INTO _fracao
    FROM public.unidades u WHERE u.id = _unidade_id AND u.condominio_id = _cond;
  IF NOT FOUND THEN RAISE EXCEPTION 'unidade_de_outro_condominio'; END IF;

  -- Vota quem representa a unidade. O art. 1.335, III dá o voto ao condómino;
  -- com mais de um dono, o art. 1.314 manda exercer em conjunto, e a unidade
  -- continua a ter um voto só.
  IF NOT EXISTS (
    SELECT 1 FROM public.unidade_moradores m
     WHERE m.unidade_id = _unidade_id
       AND m.user_id = _uid
       AND m.vinculo = 'proprietario'
       AND m.representante
  ) THEN
    SELECT p.nome_completo INTO _quem
      FROM public.unidade_moradores m
      JOIN public.profiles p ON p.id = m.user_id
     WHERE m.unidade_id = _unidade_id AND m.representante;

    IF EXISTS (
      SELECT 1 FROM public.unidade_moradores m
       WHERE m.unidade_id = _unidade_id AND m.user_id = _uid
         AND m.vinculo = 'proprietario'
    ) THEN
      RAISE EXCEPTION 'nao_e_representante'
        USING HINT = COALESCE(
          'A unidade é representada por ' || _quem ||
          '. Para mudar, o síndico regista a designação dos comproprietários.',
          'A unidade ainda não tem representante designado. Peça ao síndico.');
    ELSE
      RAISE EXCEPTION 'nao_e_proprietario'
        USING HINT = 'Só o proprietário da unidade vota (Código Civil, art. 1.335).';
    END IF;
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


-- ============================================================
-- 6. ELEGIBILIDADE
-- ============================================================
-- A unidade continua elegível por ter proprietário — a representação não muda
-- isso, muda quem carrega no botão. Mas a interface precisa de saber, por
-- unidade, se é este utilizador que vota, para explicar em vez de só recusar.
--
-- `_elegibilidade_assembleia` fica como está: é a base do apuramento, e o
-- apuramento conta unidades, não pessoas.

DROP FUNCTION IF EXISTS public.elegibilidade_assembleia(uuid);

CREATE OR REPLACE FUNCTION public.elegibilidade_assembleia(_assembleia_id uuid)
RETURNS TABLE(unidade_id uuid, bloco text, numero text, fracao_ideal numeric,
              peso numeric, elegivel boolean, motivo text,
              pode_votar boolean, representante_nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cond uuid;
  _uid uuid := auth.uid();
BEGIN
  SELECT a.condominio_id INTO _cond FROM public.assembleias a WHERE a.id = _assembleia_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'assembleia_nao_encontrada'; END IF;
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_member_of(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT e.unidade_id, e.bloco, e.numero, e.fracao_ideal, e.peso, e.elegivel, e.motivo,
         EXISTS (SELECT 1 FROM public.unidade_moradores m
                  WHERE m.unidade_id = e.unidade_id
                    AND m.user_id = _uid
                    AND m.representante),
         (SELECT p.nome_completo FROM public.unidade_moradores m
            JOIN public.profiles p ON p.id = m.user_id
           WHERE m.unidade_id = e.unidade_id AND m.representante)
    FROM public._elegibilidade_assembleia(_assembleia_id) e
   WHERE public.is_sindico(_uid, _cond)
      OR public.is_morador_da_unidade(_uid, e.unidade_id);
END;
$$;

REVOKE ALL ON FUNCTION public.elegibilidade_assembleia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.elegibilidade_assembleia(uuid) TO authenticated;


-- ============================================================
-- 7. PROPRIETÁRIOS DE UMA UNIDADE
-- ============================================================
-- Para o síndico poder escolher o representante, precisa da lista de donos.
-- Reservada ao síndico do condomínio da unidade: a lista de proprietários de
-- uma unidade alheia não é assunto dos vizinhos.

CREATE OR REPLACE FUNCTION public.proprietarios_da_unidade(_unidade_id uuid)
RETURNS TABLE(user_id uuid, nome text, representante boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cond uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT u.condominio_id INTO _cond
    FROM public.unidades u WHERE u.id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_nao_encontrada'; END IF;

  IF NOT public.is_sindico(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT m.user_id, p.nome_completo, m.representante
    FROM public.unidade_moradores m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.unidade_id = _unidade_id
     AND m.vinculo = 'proprietario'
   ORDER BY m.created_at, m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.proprietarios_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proprietarios_da_unidade(uuid) TO authenticated;
