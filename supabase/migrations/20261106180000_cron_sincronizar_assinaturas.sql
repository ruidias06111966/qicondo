-- Agendamento diário da sincronização de assinaturas com o QiGestão.
--
-- Mesmo molde dos restantes agendamentos: o `cron.job.command` chama uma
-- função, e é a função que lê os segredos do vault. O comando do cron é
-- legível por qualquer role com acesso ao schema `cron`, por isso nunca leva
-- segredo nenhum — é a convenção do projecto, e foi escrita depois de o cron
-- da fila de e-mail ter existido só no servidor e não no código.

CREATE OR REPLACE FUNCTION public.sincronizar_assinaturas_qigestao()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'net'
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
    RAISE WARNING 'sincronizar_assinaturas_qigestao: segredos app_base_url/cron_secret em falta no vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(_base_url, '/') || '/api/public/hooks/sincronizar-assinaturas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _cron_secret
    ),
    body    := '{}'::jsonb,
    -- A rota percorre até 200 condomínios, um pedido HTTP ao QiGestão por
    -- cada. Com três, é instantâneo; o limite generoso é para quando não for.
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_assinaturas_qigestao() FROM PUBLIC, anon, authenticated;

-- Às 7h47 de Brasília (10h47 UTC). O minuto não é redondo de propósito: a
-- esmagadora maioria dos agendamentos do mundo corre ao minuto zero, e a hora
-- cheia é onde a fila do servidor é maior.
--
-- Antes dos encargos de atraso (9h) e dos lembretes (12h), porque é a
-- sincronização que diz se um condomínio ainda pode trabalhar.
SELECT cron.schedule(
  'sincronizar-assinaturas-diario',
  '47 10 * * *',
  $$SELECT public.sincronizar_assinaturas_qigestao();$$
);
