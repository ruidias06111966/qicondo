-- ============================================================
-- Agendamento do processamento da fila de e-mail
--
-- A migração `email_infra` criou as filas, o DLQ e as RPCs, mas deixou o
-- agendamento de fora: era aplicado pela ferramenta da Lovable através da
-- Management API, fora do controlo de versões. Sem ele nada drena as filas e
-- nenhum e-mail chega a sair — incluindo os de confirmação de conta.
--
-- Esta migração traz esse agendamento para o repositório. O job chama a rota
-- /api/email/queue-process da aplicação, que é quem fala com o fornecedor.
--
-- Antes de o job funcionar é preciso registar dois segredos no vault (uma vez,
-- por ambiente) — ver README, secção "Fila de e-mail":
--
--   SELECT vault.create_secret('https://app.exemplo.com', 'app_base_url');
--   SELECT vault.create_secret('<service_role_key>', 'email_queue_service_role_key');
--
-- Os segredos ficam no vault, e não em texto no agendamento, porque
-- `cron.job.command` é legível por qualquer role com acesso ao schema cron.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Dispara o processamento da fila, mas só quando há trabalho para fazer.
--
-- SECURITY DEFINER para poder ler o vault; o search_path é fixado para que a
-- função não possa ser desviada por objectos criados num schema de utilizador.
CREATE OR REPLACE FUNCTION public.processar_fila_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, pgmq
AS $$
DECLARE
  _base_url TEXT;
  _service_key TEXT;
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
  SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';

  IF _base_url IS NULL OR _service_key IS NULL THEN
    RAISE WARNING 'processar_fila_email: segredos app_base_url/email_queue_service_role_key em falta no vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(_base_url, '/') || '/api/email/queue-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.processar_fila_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.processar_fila_email() TO service_role;

-- Reagenda de forma idempotente: correr a migração duas vezes não duplica o job.
DO $$
DECLARE
  _jid BIGINT;
BEGIN
  SELECT jobid INTO _jid FROM cron.job WHERE jobname = 'process-email-queue';
  IF _jid IS NOT NULL THEN
    PERFORM cron.unschedule(_jid);
  END IF;
END $$;

-- A cada 10 segundos: um e-mail de confirmação de conta que demore um minuto a
-- chegar já custa registos.
SELECT cron.schedule(
  'process-email-queue',
  '10 seconds',
  $$SELECT public.processar_fila_email();$$
);
