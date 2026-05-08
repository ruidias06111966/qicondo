CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE _jid INT;
BEGIN
  SELECT jobid INTO _jid FROM cron.job WHERE jobname = 'wa-drain-every-minute';
  IF _jid IS NOT NULL THEN PERFORM cron.unschedule(_jid); END IF;
END $$;

SELECT cron.schedule(
  'wa-drain-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--620466c0-e3a6-4835-b1d8-5091f677f993.lovable.app/api/public/wa-drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhZ3NpbGt2aXJjbm9pdGl1dHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzIxNjcsImV4cCI6MjA5MzQwODE2N30.mpCH1kNA9vpxfyGL38cCyWhomqsS9O2qHRbX8PZ6A0s'
    ),
    body := '{}'::jsonb
  );
  $$
);