-- Convites: deixar de exigir o token em claro na base de dados.
--
-- `aceitar_convite(_token)` compara sempre `token_hash = sha256(_token)`, por isso
-- a coluna `token` nunca é lida para validar nada. Mantê-la obrigatória forçava a
-- aplicação a persistir o token legível — e qualquer administrador da empresa com
-- SELECT em `convites` conseguia reconstruir o link de convite de outra pessoa.
--
-- Esta migração é deliberadamente não destrutiva: os convites pendentes que já têm
-- token em claro continuam a funcionar (e expiram sozinhos em <= 7 dias). Apenas os
-- convites criados a partir daqui deixam de guardar o valor legível.
--
-- Para limpar também o histórico depois de os convites antigos expirarem:
--   UPDATE public.convites SET token = NULL WHERE token_hash IS NOT NULL;

ALTER TABLE public.convites ALTER COLUMN token DROP NOT NULL;

-- Backfill defensivo: nenhum convite deve ficar sem hash.
UPDATE public.convites
   SET token_hash = encode(digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL
   AND token IS NOT NULL;

-- O lookup de aceitação é feito pelo hash, não pelo token em claro.
CREATE INDEX IF NOT EXISTS idx_convites_token_hash ON public.convites(token_hash);