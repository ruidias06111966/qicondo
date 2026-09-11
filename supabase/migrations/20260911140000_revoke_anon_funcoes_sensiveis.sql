-- ============================================================
-- Fecha o acesso de `anon` (e, onde não faz sentido, de `authenticated`)
-- às funções do schema public.
--
-- As migrações anteriores revogavam com `REVOKE ... FROM PUBLIC`, o que não
-- chega: o Supabase tem default privileges que concedem EXECUTE directamente a
-- `anon` e `authenticated` em cada função criada no schema public. Revogar de
-- PUBLIC não mexe nesses GRANTs directos, e o DO block de 20260506133836 ainda
-- voltou a conceder EXECUTE a `authenticated` em todas as SECURITY DEFINER.
--
-- O resultado, confirmado neste projecto antes desta migração:
--
--   enqueue_email          anon=true  -> qualquer pessoa com a chave publicável
--                                        enfileira e-mails a sair do nosso
--                                        domínio remetente
--   processar_fila_email   anon=true  } disparam pedidos HTTP a partir do
--   processar_fila_whatsapp anon=true } Postgres, sem limite
--   disparar_lembretes_cobranca anon=true
--   cnab_baixar_cobranca   authenticated=true -> dava baixa em qualquer
--                                        cobrança, sem verificar quem chama
--
-- Nenhuma destas é chamada pelo browser: a fila é do service_role e os
-- agendamentos correm no cron, que não passa por PostgREST.
-- ============================================================

-- 1) Funções de gatilho. Correm com os privilégios do dono da tabela; expô-las
--    como RPC nunca foi intencional.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.assinatura);
  END LOOP;
END $$;

-- 2) Infraestrutura de filas e agendamentos: só o service_role. O cron corre
--    como superuser e não precisa de GRANT.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'enqueue_email', 'read_email_batch', 'delete_email', 'move_to_dlq',
         'processar_fila_email', 'processar_fila_whatsapp',
         'disparar_lembretes_cobranca', 'enqueue_documento_comunicado',
         'cnab_baixar_cobranca'
       )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.assinatura);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.assinatura);
  END LOOP;
END $$;

-- 3) Restantes SECURITY DEFINER: exigem sessão iniciada. Os helpers (is_sindico,
--    has_role, ...) continuam acessíveis a `authenticated` porque são avaliados
--    dentro das políticas RLS no contexto de quem faz o pedido.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', r.assinatura);
  END LOOP;
END $$;

-- Nota sobre `pg_net`: o linter do Supabase assinala-o como instalado em
-- `public`, porque a migração de 2026-05-08 o criou sem schema, antes de
-- `email_infra` o pedir em `extensions`. Não é corrigível aqui — a extensão não
-- suporta `ALTER EXTENSION ... SET SCHEMA`, e recriá-la descartaria a fila
-- `net.http_request_queue`. As funções continuam a ser chamadas por `net.*`,
-- pelo que o impacto é de arrumação e não de acesso.
