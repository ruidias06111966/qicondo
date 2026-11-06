-- ============================================================
-- A fila de e-mail passa a autenticar-se com o CRON_SECRET
--
-- O QUE CORREU MAL
--
-- O `processar_fila_email` mandava a chave `service_role` como segredo
-- partilhado para o `/api/email/queue-process`, e por isso havia uma cópia
-- dela no vault, em `email_queue_service_role_key`.
--
-- Ao rodar a chave do Supabase, essa cópia ficou para trás e o endpoint passou
-- a devolver 403. Não deu erro visível: a função sai mais cedo quando a fila
-- está vazia, por isso nem chega a fazer o pedido. Só o próximo e-mail de
-- confirmação de registo é que não teria saído.
--
-- PORQUE É QUE O CRON_SECRET É MELHOR
--
-- Os outros três endpoints internos — `wa-drain`, `lembretes-cobranca` e
-- `email/preview` — já se autenticavam assim. Este era o único fora do padrão,
-- e foi o único que a rotação partiu.
--
-- O CRON_SECRET não dá acesso a nada: prova que o pedido vem do agendamento, e
-- mais nada. Quem gere os dados continua a ser a chave de serviço, que a
-- aplicação lê da sua própria variável de ambiente e que nunca precisa de
-- estar no vault.
--
-- Com isto, a cópia da chave no vault deixa de ser precisa. Apaga-se no fim —
-- é menos um sítio de onde uma chave de privilégio total pode escapar, que era
-- o ponto da rotação.
--
-- O corpo é o de antes; muda o segredo que se lê e o que se envia.
-- ============================================================

CREATE OR REPLACE FUNCTION public.processar_fila_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, pgmq
AS $$
DECLARE
  _base_url TEXT;
  _cron_secret TEXT;
  _em_cooldown BOOLEAN;
  _pendentes BIGINT;
BEGIN
  -- Respeita a janela de espera imposta por um 429 do fornecedor.
  SELECT COALESCE(retry_after_until > now(), FALSE)
    INTO _em_cooldown
    FROM public.email_send_state
   WHERE id = 1;

  IF COALESCE(_em_cooldown, FALSE) THEN
    RETURN;
  END IF;

  -- Sem mensagens não vale a pena acordar a aplicação. As filas podem ainda não
  -- existir numa base acabada de criar, daí o tratamento de undefined_table.
  BEGIN
    SELECT (SELECT count(*) FROM pgmq.q_auth_emails)
         + (SELECT count(*) FROM pgmq.q_transactional_emails)
      INTO _pendentes;
  EXCEPTION
    WHEN undefined_table THEN RETURN;
  END;

  IF COALESCE(_pendentes, 0) = 0 THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _base_url
    FROM vault.decrypted_secrets WHERE name = 'app_base_url';
  SELECT decrypted_secret INTO _cron_secret
    FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  IF _base_url IS NULL OR _cron_secret IS NULL THEN
    RAISE WARNING 'processar_fila_email: segredos app_base_url/cron_secret em falta no vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(_base_url, '/') || '/api/email/queue-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _cron_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.processar_fila_email() FROM PUBLIC, anon, authenticated;
-- Mantém-se a concessão que a migração original dava.
GRANT EXECUTE ON FUNCTION public.processar_fila_email() TO service_role;

-- A cópia da chave de serviço no vault deixa de ter uso.
DO $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM vault.secrets WHERE name = 'email_queue_service_role_key';
  IF _id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = _id;
    RAISE NOTICE 'Segredo email_queue_service_role_key removido do vault.';
  END IF;
END $$;
