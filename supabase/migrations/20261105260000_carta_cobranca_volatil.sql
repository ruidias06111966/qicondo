-- ============================================================
-- A carta de cobrança nunca funcionou
--
-- A função está declarada `STABLE` e grava no `audit_log`. O PostgreSQL
-- recusa:
--
--   ERROR:  INSERT is not allowed in a non-volatile function
--
-- Não é um caso de fronteira: é **todas** as vezes. Quem clicasse em «gerar
-- carta» apanhava um erro, sempre, desde que a funcionalidade existe. Passou
-- despercebido porque a migração nunca foi exercida contra uma base a sério —
-- a bateria `supabase/testes/certidoes-e-infracoes.sql`, que a apanhou, é
-- desta altura.
--
-- PORQUÊ VOLÁTIL E NÃO TIRAR O REGISTO
--
-- A alternativa era apagar o INSERT e deixar a função `STABLE`. Mas o registo
-- de que uma carta foi emitida, para que unidade, por quem e por que valor é
-- precisamente o que se quer poder provar mais tarde: a carta é o passo que
-- antecede a cobrança judicial, e a data em que foi emitida conta.
--
-- O que se perde ao tornar a função volátil é a possibilidade de o
-- planeador a avaliar uma vez só por consulta. Numa função que se chama uma
-- vez por carta, a troca não custa nada.
--
-- O corpo é o mesmo, linha por linha. Só muda `STABLE` para `VOLATILE`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.carta_cobranca(
  _unidade_id uuid,
  _prazo_dias integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cond uuid;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _divida jsonb;
  _c record;
  _u record;
  _donos jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _prazo_dias IS NULL OR _prazo_dias < 1 OR _prazo_dias > 90 THEN
    RAISE EXCEPTION 'prazo_invalido' USING HINT = 'Entre 1 e 90 dias.';
  END IF;

  SELECT u.condominio_id INTO _cond FROM public.unidades u WHERE u.id = _unidade_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'unidade_nao_encontrada'; END IF;

  IF NOT public.pode_gerir_financeiro(_uid, _cond) THEN RAISE EXCEPTION 'forbidden'; END IF;

  _divida := public.divida_da_unidade(_unidade_id);

  IF (_divida->>'total')::numeric <= 0 THEN
    RAISE EXCEPTION 'sem_divida'
      USING HINT = 'Esta unidade não tem valores em aberto. Não há o que cobrar.';
  END IF;

  SELECT c.nome, c.cnpj, c.endereco, c.cidade, c.estado, c.cep
    INTO _c FROM public.condominios c WHERE c.id = _cond;

  SELECT u.bloco, u.numero INTO _u FROM public.unidades u WHERE u.id = _unidade_id;

  SELECT COALESCE(jsonb_agg(p.nome_completo ORDER BY m.created_at), '[]'::jsonb)
    INTO _donos
    FROM public.unidade_moradores m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.unidade_id = _unidade_id AND m.vinculo = 'proprietario';

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_cond, _uid, 'carta_cobranca_gerada', 'unidades', _unidade_id,
          jsonb_build_object('total', (_divida->>'total')::numeric, 'prazo_dias', _prazo_dias));

  RETURN jsonb_build_object(
    'emitida_em', _hoje,
    'prazo_dias', _prazo_dias,
    'vence_em', _hoje + _prazo_dias,
    'condominio', jsonb_build_object(
      'nome', _c.nome, 'cnpj', _c.cnpj, 'endereco', _c.endereco,
      'cidade', _c.cidade, 'estado', _c.estado, 'cep', _c.cep),
    'unidade', jsonb_build_object('bloco', _u.bloco, 'numero', _u.numero),
    'proprietarios', _donos,
    'divida', _divida
  );
END;
$$;

REVOKE ALL ON FUNCTION public.carta_cobranca(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carta_cobranca(uuid, integer) TO authenticated;
