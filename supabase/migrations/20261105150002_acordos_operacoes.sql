-- Criar, rescindir, e fechar quando pago.

-- ============================================================
-- CRIAR
-- ============================================================
-- Três efeitos na mesma transacção: as cobranças originais passam a
-- `em_acordo`, ficam congeladas em `acordo_itens`, e nascem as parcelas.
-- A dívida não é duplicada em momento nenhum — sai de um sítio e entra
-- noutro.

CREATE OR REPLACE FUNCTION public.criar_acordo(
  _condominio_id uuid,
  _unidade_id uuid,
  _cobranca_ids uuid[],
  _desconto numeric,
  _entrada numeric,
  _num_parcelas integer,
  _primeiro_vencimento date,
  _categoria_id uuid DEFAULT NULL,
  _autorizacao text DEFAULT NULL,
  _observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _calc jsonb;
  _acordo uuid;
  _numero int;
  _p jsonb;
  _it jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(_uid, _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Mesma função que a simulação: o que foi mostrado é o que fica gravado.
  _calc := public._acordo_calcular(_condominio_id, _unidade_id, _cobranca_ids,
                                   _desconto, _entrada, _num_parcelas, _primeiro_vencimento);

  SELECT COALESCE(max(a.numero), 0) + 1 INTO _numero
    FROM public.acordos a WHERE a.condominio_id = _condominio_id;

  INSERT INTO public.acordos (
    condominio_id, unidade_id, numero, data_acordo,
    valor_principal, valor_multa, valor_juros, valor_desconto,
    valor_entrada, valor_total, num_parcelas, autorizacao, observacoes, criado_por
  ) VALUES (
    _condominio_id, _unidade_id, _numero, (_calc->>'data_acordo')::date,
    (_calc->>'principal')::numeric, (_calc->>'multa')::numeric,
    (_calc->>'juros')::numeric, (_calc->>'desconto')::numeric,
    (_calc->>'entrada')::numeric, (_calc->>'total')::numeric,
    _num_parcelas, NULLIF(trim(COALESCE(_autorizacao, '')), ''),
    NULLIF(trim(COALESCE(_observacoes, '')), ''), _uid
  ) RETURNING id INTO _acordo;

  FOR _it IN SELECT * FROM jsonb_array_elements(_calc->'itens') LOOP
    INSERT INTO public.acordo_itens (acordo_id, cobranca_id, principal, multa, juros)
    VALUES (_acordo, (_it->>'cobranca_id')::uuid,
            (_it->>'principal')::numeric, (_it->>'multa')::numeric, (_it->>'juros')::numeric);
  END LOOP;

  UPDATE public.cobrancas
     SET status = 'em_acordo', acordo_id = _acordo
   WHERE id = ANY(_cobranca_ids);

  -- A entrada é a parcela 0, vencida à data do acordo. Assim passa pelo mesmo
  -- registo de pagamento das outras, em vez de ser um caso à parte no código
  -- e no extracto.
  IF (_calc->>'entrada')::numeric > 0 THEN
    INSERT INTO public.cobrancas (
      condominio_id, unidade_id, categoria_id, competencia, vencimento,
      valor, descricao, acordo_id, parcela_num, criado_por
    ) VALUES (
      _condominio_id, _unidade_id, _categoria_id,
      date_trunc('month', (_calc->>'data_acordo')::date)::date,
      (_calc->>'data_acordo')::date,
      (_calc->>'entrada')::numeric,
      format('Acordo %s — entrada', _numero),
      _acordo, 0, _uid
    );
  END IF;

  FOR _p IN SELECT * FROM jsonb_array_elements(_calc->'parcelas') LOOP
    INSERT INTO public.cobrancas (
      condominio_id, unidade_id, categoria_id, competencia, vencimento,
      valor, descricao, acordo_id, parcela_num, criado_por
    ) VALUES (
      _condominio_id, _unidade_id, _categoria_id,
      date_trunc('month', (_p->>'vencimento')::date)::date,
      (_p->>'vencimento')::date,
      (_p->>'valor')::numeric,
      format('Acordo %s — parcela %s/%s', _numero, _p->>'numero', _num_parcelas),
      _acordo, (_p->>'numero')::int, _uid
    );
  END LOOP;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, _uid, 'acordo_criado', 'acordos', _acordo,
          jsonb_build_object('numero', _numero,
                             'total', (_calc->>'total')::numeric,
                             'desconto', (_calc->>'desconto')::numeric,
                             'parcelas', _num_parcelas,
                             'cobrancas', array_length(_cobranca_ids, 1)));

  RETURN _acordo;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_acordo(uuid, uuid, uuid[], numeric, numeric, integer, date, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_acordo(uuid, uuid, uuid[], numeric, numeric, integer, date, uuid, text, text)
  TO authenticated;


-- ============================================================
-- RESCINDIR
-- ============================================================
-- O condómino deixou de pagar. As parcelas por liquidar são canceladas e o
-- que resta vira uma cobrança só, vencida à data da rescisão.
--
-- ESCOLHA DELIBERADA: as cobranças originais NÃO voltam ao estado anterior.
-- Ficam `em_acordo` como registo histórico, e a dívida segue na cobrança
-- nova.
--
-- A alternativa é repor as originais com os vencimentos de origem, e com
-- isso os juros a correr desde então. É mais dura para o devedor e tem
-- defesa jurídica, mas torna a conta impossível de auditar depois de
-- pagamentos parciais terem sido imputados ao acordo: não há forma não
-- arbitrária de decidir que parte de cada pagamento abateu que cobrança
-- original. Aqui a linha do tempo é uma só, e cada passo é verificável:
-- dívida -> acordo -> saldo do acordo.
--
-- Se a convenção do condomínio exigir o outro tratamento, muda-se aqui, com
-- uma regra explícita de imputação dos pagamentos já feitos.

CREATE OR REPLACE FUNCTION public.rescindir_acordo(
  _acordo_id uuid,
  _motivo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _a public.acordos%ROWTYPE;
  _saldo numeric;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _cat uuid;
  _nova uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _a FROM public.acordos WHERE id = _acordo_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'acordo_nao_encontrado'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _a.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _a.status <> 'ativo' THEN
    RAISE EXCEPTION 'acordo_nao_ativo'
      USING HINT = format('O acordo está %s.', _a.status);
  END IF;

  -- Inclui multa e juros das parcelas que já estavam elas próprias em atraso.
  SELECT COALESCE(sum(GREATEST(c.valor + c.multa + c.juros - c.desconto - c.valor_pago, 0)), 0)
    INTO _saldo
    FROM public.cobrancas c
   WHERE c.acordo_id = _acordo_id
     AND c.status IN ('pendente', 'vencida', 'parcial');

  SELECT c.categoria_id INTO _cat
    FROM public.cobrancas c
   WHERE c.acordo_id = _acordo_id AND c.categoria_id IS NOT NULL
   LIMIT 1;

  UPDATE public.cobrancas
     SET status = 'cancelada'
   WHERE acordo_id = _acordo_id
     AND status IN ('pendente', 'vencida', 'parcial');

  IF _saldo > 0 THEN
    INSERT INTO public.cobrancas (
      condominio_id, unidade_id, categoria_id, competencia, vencimento,
      valor, descricao, criado_por
    ) VALUES (
      _a.condominio_id, _a.unidade_id, _cat,
      date_trunc('month', _hoje)::date, _hoje, _saldo,
      format('Saldo do acordo %s rescindido', _a.numero), _uid
    ) RETURNING id INTO _nova;
  END IF;

  UPDATE public.acordos
     SET status = 'rescindido', rescindido_em = now(),
         rescisao_motivo = NULLIF(trim(COALESCE(_motivo, '')), '')
   WHERE id = _acordo_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_a.condominio_id, _uid, 'acordo_rescindido', 'acordos', _acordo_id,
          jsonb_build_object('numero', _a.numero, 'saldo', _saldo, 'motivo', _motivo));

  RETURN _nova;
END;
$$;

REVOKE ALL ON FUNCTION public.rescindir_acordo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rescindir_acordo(uuid, text) TO authenticated;


-- ============================================================
-- QUITAÇÃO AUTOMÁTICA
-- ============================================================
-- Paga a última parcela, o acordo fecha-se sozinho. Depender de alguém se
-- lembrar de o marcar deixaria acordos pagos a constar como activos, e um
-- acordo activo bloqueia as suas cobranças em `em_acordo` para sempre.

CREATE OR REPLACE FUNCTION public.acordo_fechar_se_quitado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acordo_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.acordos a
     SET status = 'quitado'
   WHERE a.id = NEW.acordo_id
     AND a.status = 'ativo'
     AND NOT EXISTS (
       SELECT 1 FROM public.cobrancas c
        WHERE c.acordo_id = a.id
          AND c.status IN ('pendente', 'vencida', 'parcial')
     );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_acordo_fechar_se_quitado ON public.cobrancas;
CREATE TRIGGER trg_acordo_fechar_se_quitado
  AFTER UPDATE OF status ON public.cobrancas
  FOR EACH ROW
  WHEN (NEW.acordo_id IS NOT NULL AND NEW.status = 'paga')
  EXECUTE FUNCTION public.acordo_fechar_se_quitado();
