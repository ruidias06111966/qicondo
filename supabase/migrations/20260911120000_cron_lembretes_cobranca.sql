-- ============================================================
-- Agendamento dos lembretes de cobrança
--
-- A rota /api/public/hooks/lembretes-cobranca existe desde sempre e exige
-- CRON_SECRET, mas nenhuma migração a agendava — ou seja, nenhum lembrete de
-- cobrança chegou a ser enviado. Este agendamento fecha essa lacuna.
--
-- Corre uma vez por dia, às 12:00 UTC = 09:00 em Brasília (UTC-3, sem horário
-- de verão desde 2019).
--
-- O horário não é arbitrário: a rota calcula "hoje" e "início de hoje" com o
-- relógio do servidor, que no Worker é UTC. Às 12:00 UTC o dia civil já
-- coincide nos dois fusos. Antecipar para antes das 03:00 UTC faria a rota
-- trabalhar sobre o dia seguinte ao de Brasília e desalinhar as datas de
-- vencimento — ao mexer neste horário, ter isso em conta.
--
-- Correr duas vezes no mesmo dia é seguro: antes de enfileirar, a rota procura
-- uma notificação já criada hoje para a mesma cobrança e telefone, e salta-a.
--
-- Requer os segredos `app_base_url` e `cron_secret` no vault, os mesmos que a
-- fila de WhatsApp usa (ver README).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.disparar_lembretes_cobranca()
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
    RAISE WARNING 'disparar_lembretes_cobranca: segredos app_base_url/cron_secret em falta no vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(_base_url, '/') || '/api/public/hooks/lembretes-cobranca',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _cron_secret
    ),
    body    := '{}'::jsonb,
    -- Percorre todas as empresas com automação activa, daí o limite mais
    -- generoso do que nas restantes rotas agendadas.
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disparar_lembretes_cobranca() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disparar_lembretes_cobranca() TO service_role;

DO $$
DECLARE
  _jid BIGINT;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'lembretes-cobranca-diario' LOOP
    PERFORM cron.unschedule(_jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'lembretes-cobranca-diario',
  '0 12 * * *',
  $$SELECT public.disparar_lembretes_cobranca();$$
);
