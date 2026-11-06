-- ============================================================
-- Comprovante de pagamento pelo WhatsApp
--
-- O LAÇO QUE FALTAVA FECHAR
--
-- O PIX estático não avisa ninguém. O condómino lê o QR, paga, e o dinheiro
-- entra na conta do condomínio sem que o sistema saiba. Quem dá a baixa é o
-- síndico, a olhar para o extracto, à mão — e entre o pagamento e a baixa a
-- cobrança continua a constar como vencida, a multa continua a correr e o
-- condómino continua a receber lembretes de uma dívida que já pagou.
--
-- O comprovante, porém, existe: está no telefone de quem pagou, dois segundos
-- depois de pagar. Até aqui, se ele o mandasse pelo WhatsApp, o webhook
-- ignorava-o — só tratava mensagens de texto. Era o documento mais útil do
-- processo a cair no chão.
--
-- Isto não dá a baixa automática, e é de propósito. Um comprovante é uma
-- imagem: pode ser de outro mês, de outro beneficiário, ou de mais nada. A
-- baixa continua a ser um acto do síndico, com o extracto ao lado. O que isto
-- muda é que ele deixa de a fazer às cegas: abre a cobrança e tem lá o
-- documento, com a data, o valor e o número de quem o mandou.
--
-- AUTORIZAÇÃO
--
-- Aqui não há `auth.uid()`: quem chama é o webhook, com a chave de serviço, em
-- nome de um número de telefone. A autorização é o vínculo — o número tem de
-- estar numa conversa deste condomínio e essa conversa tem de estar ligada à
-- unidade da cobrança. Sem isso, qualquer número que o condomínio já conheça
-- podia pendurar documentos nas cobranças de qualquer vizinho.
-- ============================================================

-- ------------------------------------------------------------
-- Quando o comprovante chegou. Não é "está pago": é "há papel à espera de
-- conferência". A distinção é o que separa esta coluna de um `status`.
-- ------------------------------------------------------------
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS comprovante_recebido_em timestamptz;

COMMENT ON COLUMN public.cobrancas.comprovante_recebido_em IS
  'Quando o último comprovante chegou pelo WhatsApp. Não implica pagamento: implica documento à espera de conferência.';

CREATE INDEX IF NOT EXISTS idx_cobrancas_comprovante_pendente
  ON public.cobrancas (condominio_id, comprovante_recebido_em DESC)
  WHERE comprovante_recebido_em IS NOT NULL;

-- ------------------------------------------------------------
-- Tecto de documentos por cobrança.
--
-- O ficheiro vem de fora, de um número que o condomínio conhece mas não
-- controla. Sem tecto, um telefone avariado a reenviar a mesma foto enche o
-- bucket e a conta vem no fim do mês. Cinco é o que cabe num caso legítimo:
-- o comprovante, uma segunda via mais legível, e margem para erro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_comprovante_whatsapp(
  _condominio_id uuid,
  _cobranca_id uuid,
  _telefone text,
  _storage_path text,
  _nome_arquivo text,
  _mime_type text DEFAULT NULL,
  _tamanho_bytes bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cob record;
  _conversa record;
  _quantos int;
  _id uuid;
  _tel text := regexp_replace(COALESCE(_telefone, ''), '\D', '', 'g');
BEGIN
  IF _tel = '' THEN
    RAISE EXCEPTION 'telefone_invalido'
      USING HINT = 'Sem número não há vínculo, e sem vínculo não há autorização.';
  END IF;

  SELECT id, condominio_id, unidade_id, status, competencia
    INTO _cob
    FROM public.cobrancas
   WHERE id = _cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cobranca_nao_encontrada';
  END IF;

  IF _cob.condominio_id <> _condominio_id THEN
    RAISE EXCEPTION 'cobranca_de_outro_condominio'
      USING HINT = 'A cobrança não é deste condomínio.';
  END IF;

  -- O vínculo. É isto que faz o papel da RLS onde não há utilizador.
  SELECT id, unidade_id INTO _conversa
    FROM public.wa_conversas
   WHERE condominio_id = _condominio_id
     AND telefone = _tel;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversa_desconhecida'
      USING HINT = 'Este número não tem conversa aberta neste condomínio.';
  END IF;

  IF _conversa.unidade_id IS NULL THEN
    RAISE EXCEPTION 'numero_sem_unidade'
      USING HINT = 'O número não está vinculado a nenhuma unidade. O síndico tem de o vincular primeiro.';
  END IF;

  IF _conversa.unidade_id <> _cob.unidade_id THEN
    RAISE EXCEPTION 'cobranca_de_outra_unidade'
      USING HINT = 'A cobrança é de outra unidade. Cada número só comprova o que é da sua.';
  END IF;

  -- Comprovar uma cobrança cancelada ou já paga não é erro do condómino, mas
  -- também não produz trabalho para ninguém. Recusa-se com a razão à vista.
  IF _cob.status NOT IN ('pendente', 'vencida', 'parcial') THEN
    RAISE EXCEPTION 'cobranca_nao_comprovavel'
      USING HINT = format('A cobrança está %s.', _cob.status);
  END IF;

  SELECT count(*) INTO _quantos
    FROM public.anexos
   WHERE entidade = 'cobranca'
     AND entidade_id = _cobranca_id
     AND tipo = 'comprovante_pagamento';

  IF _quantos >= 5 THEN
    RAISE EXCEPTION 'comprovantes_demais'
      USING HINT = 'Esta cobrança já tem cinco comprovantes. Fale com o síndico.';
  END IF;

  IF _storage_path IS NULL OR btrim(_storage_path) = '' THEN
    RAISE EXCEPTION 'anexo_sem_caminho';
  END IF;

  -- A mesma regra do `registrar_anexo`: o caminho decide quem lê no Storage,
  -- por isso tem de começar pelo condomínio que o registo diz.
  IF split_part(_storage_path, '/', 1) <> _condominio_id::text THEN
    RAISE EXCEPTION 'anexo_caminho_invalido'
      USING HINT = 'O caminho no Storage tem de começar pelo id do condomínio.';
  END IF;

  INSERT INTO public.anexos (
    condominio_id, entidade, entidade_id, tipo,
    storage_path, nome_arquivo, mime_type, tamanho_bytes,
    observacao, enviado_por
  ) VALUES (
    _condominio_id, 'cobranca', _cobranca_id, 'comprovante_pagamento',
    btrim(_storage_path), btrim(_nome_arquivo), _mime_type, _tamanho_bytes,
    -- `enviado_por` fica NULL de propósito: não foi um utilizador autenticado
    -- da aplicação, foi um número. Quem foi fica aqui, por extenso, porque é
    -- a única forma de o síndico saber de onde veio o documento.
    format('Enviado pelo WhatsApp por %s', _tel),
    NULL
  )
  RETURNING id INTO _id;

  UPDATE public.cobrancas
     SET comprovante_recebido_em = now()
   WHERE id = _cobranca_id;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, entidade_id, metadata)
  VALUES (_condominio_id, NULL, 'comprovante_recebido_whatsapp', 'cobrancas', _cobranca_id,
          jsonb_build_object(
            'anexo_id', _id,
            'telefone', _tel,
            'competencia', _cob.competencia,
            'mime_type', _mime_type,
            'tamanho_bytes', _tamanho_bytes
          ));

  RETURN _id;
END;
$$;

-- Só o webhook. Nem `anon` nem `authenticated`: um utilizador autenticado que
-- queira anexar um comprovante usa o `registrar_anexo`, que verifica o
-- `auth.uid()`. Esta função autoriza por número de telefone, o que só faz
-- sentido vindo de quem já validou a assinatura da Meta.
REVOKE ALL ON FUNCTION public.registrar_comprovante_whatsapp(uuid, uuid, text, text, text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_comprovante_whatsapp(uuid, uuid, text, text, text, text, bigint)
  TO service_role;

-- ------------------------------------------------------------
-- As cobranças com papel à espera de conferência.
--
-- É a lista de trabalho do síndico: o que chegou, há quanto tempo, e quanto
-- está em aberto.
--
-- A ordem é pelo PRIMEIRO comprovante da cobrança, não pelo último. Ordenar
-- pelo último punha no fim da fila quem reenviou o documento porque ainda não
-- tinha sido conferido — isto é, empurrava para trás exactamente quem está à
-- espera há mais tempo. As duas datas vão nas colunas, porque dizem coisas
-- diferentes: uma é "há quanto tempo isto espera", a outra "chegou coisa nova".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comprovantes_a_conferir(_condominio_id uuid)
RETURNS TABLE (
  cobranca_id uuid,
  unidade_id uuid,
  unidade text,
  -- `date`, não `text`: é o tipo real da coluna. Declarei-a `text` e o
  -- PostgreSQL recusou a função inteira — "structure of query does not match
  -- function result type". A bateria apanhou-o; em produção teria aparecido ao
  -- síndico na primeira vez que abrisse a lista.
  competencia date,
  vencimento date,
  em_aberto numeric,
  status public.cobranca_status,
  primeiro_comprovante_em timestamptz,
  comprovante_recebido_em timestamptz,
  comprovantes int
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

  RETURN QUERY
  SELECT c.id,
         c.unidade_id,
         COALESCE(nullif(btrim(concat_ws(' ', u.bloco, u.numero)), ''), u.numero),
         c.competencia,
         c.vencimento,
         (c.valor + c.multa + c.juros - c.desconto - c.valor_pago),
         c.status,
         p.primeiro,
         c.comprovante_recebido_em,
         p.quantos
    FROM public.cobrancas c
    JOIN public.unidades u ON u.id = c.unidade_id
    JOIN LATERAL (
      SELECT min(a.created_at) AS primeiro, count(*)::int AS quantos
        FROM public.anexos a
       WHERE a.entidade = 'cobranca'
         AND a.entidade_id = c.id
         AND a.tipo = 'comprovante_pagamento'
    ) p ON p.quantos > 0
   WHERE c.condominio_id = _condominio_id
     AND c.comprovante_recebido_em IS NOT NULL
     AND c.status IN ('pendente', 'vencida', 'parcial')
   ORDER BY p.primeiro;
END;
$$;

REVOKE ALL ON FUNCTION public.comprovantes_a_conferir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comprovantes_a_conferir(uuid) TO authenticated;
