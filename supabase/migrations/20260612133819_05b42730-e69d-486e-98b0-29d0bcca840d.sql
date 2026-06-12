-- Remove a política de UPDATE permissiva do morador.
-- A avaliação continua a ser feita exclusivamente via função SECURITY DEFINER
-- public.avaliar_ocorrencia(_ocorrencia_id, _nota, _comentario), que valida
-- autor, intervalo de nota e estado da ocorrência.
DROP POLICY IF EXISTS "Morador avalia própria ocorrência" ON public.ocorrencias;