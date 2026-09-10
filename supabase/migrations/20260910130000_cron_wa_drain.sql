-- ============================================================
-- Correcção do agendamento que drena a fila de WhatsApp
--
-- O job `wa-drain-every-minute`, criado na migração de 2026-05-08, tinha três
-- problemas acumulados:
--
--   1. Apontava para `project--620466c0-….lovable.app`, o ambiente de
--      pré-visualização da Lovable, que deixa de existir quando o projeto sai
--      de lá.
--   2. Autenticava com o cabeçalho `apikey` e a chave anon, mas a rota
--      /api/public/wa-drain exige `Authorization: Bearer <CRON_SECRET>` ou
--      `x-cron-secret`. Nenhum dos dois era enviado, pelo que todas as
--      invocações recebiam 401 e a fila nunca chegou a ser drenada.
--   3. Trazia a chave embutida em texto no comando do job, e
--      `cron.job.command` é legível por qualquer role com acesso ao schema
--      `cron`.
--
-- Passa a seguir o mesmo padrão da fila de e-mail: uma função que lê as
-- credenciais do vault e chama a aplicação com o cabeçalho correcto.
--
-- Requer, além dos segredos já registados para o e-mail:
--
--   SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
-- (`app_base_url` é partilhado com a fila de e-mail; ver README.)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.processar_fila_whatsapp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  _base_url TEXT;
  _cron_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO _base_url
    FROM vault.decrypted_secrets WHERE name = 'app_base_url';
  SELECT decrypted_secret INTO _cron_secret
    FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  IF _base_url IS NULL OR _cron_secret IS NULL THEN
    RAISE WARNING 'processar_fila_whatsapp: segredos app_base_url/cron_secret em falta no vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(_base_url, '/') || '/api/public/wa-drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _cron_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.processar_fila_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.processar_fila_whatsapp() TO service_role;

-- Substitui o job antigo, que ficava a falhar em silêncio a cada minuto.
DO $$
DECLARE
  _jid BIGINT;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'wa-drain-every-minute' LOOP
    PERFORM cron.unschedule(_jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'wa-drain-every-minute',
  '* * * * *',
  $$SELECT public.processar_fila_whatsapp();$$
);
