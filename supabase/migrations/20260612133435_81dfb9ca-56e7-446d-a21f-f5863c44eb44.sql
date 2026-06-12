DROP POLICY IF EXISTS "Sistema escreve auditoria" ON public.audit_log;
-- Sem política de INSERT para 'authenticated'. SECURITY DEFINER functions
-- continuam a poder escrever pois correm com privilégios do owner e bypass RLS.
-- service_role mantém o GRANT ALL existente.