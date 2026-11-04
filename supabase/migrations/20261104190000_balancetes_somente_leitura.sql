-- ============================================================
-- Fecha a escrita directa em `balancetes`
--
-- `prestacao_de_contas` deu à tabela uma política `FOR ALL` para quem gere o
-- financeiro. Parecia simétrico com o resto do repositório — é o padrão de
-- `cobrancas`, `despesas` e `categorias_financeiras` — mas aqui está errado, e
-- destrói a única garantia que o módulo tem para dar.
--
-- O scanner de segurança apanhou. Confirmado nas duas condições necessárias:
--
--   * `authenticated` tem INSERT, UPDATE e DELETE na tabela (é o que a
--     configuração por omissão do Supabase concede).
--   * A política `FOR ALL` só verifica `pode_gerir_financeiro`.
--
-- Logo, qualquer síndico, admin, contador ou perfil financeiro podia, pelo
-- PostgREST e sem passar por função nenhuma:
--
--   UPDATE balancetes SET total_despesas = 0, saldo_final = ..., dados = ...
--    WHERE status = 'publicado';
--
-- ou inserir uma linha já `publicado` com totais inventados. O condómino veria
-- o documento alterado, a recusa `balancete_publicado` nunca correria, e não
-- ficaria uma linha no `audit_log`. O contador é muitas vezes um escritório
-- externo: é exactamente a pessoa a quem a prestação de contas não devia poder
-- ser reescrita em silêncio.
--
-- A fotografia só é uma fotografia se não puder ser pintada por cima.
--
-- ------------------------------------------------------------
-- Três camadas, porque uma só não basta
--
-- 1. REVOGAR o privilégio de tabela. É a barreira mais baixa e a que nenhuma
--    política futura pode reabrir por distracção: sem GRANT não há escrita,
--    haja a política que houver.
--
-- 2. TIRAR a política `FOR ALL`, ficando só as duas de leitura. A escrita passa
--    toda pelas funções SECURITY DEFINER, que correm como o dono e por isso
--    não precisam nem do GRANT nem de política.
--
-- 3. UM TRIGGER que guarda a invariante, corra quem correr. As camadas 1 e 2
--    protegem do cliente; esta protege do próprio código — de uma função
--    DEFINER nova, de uma migração distraída, de um `supabase db reset` que
--    reponha privilégios. É a regra de negócio escrita onde não pode ser
--    contornada.
-- ============================================================

-- ------------------------------------------------------------
-- 1 e 2: nem GRANT, nem política de escrita.
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.balancetes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.balancetes FROM anon;

DROP POLICY IF EXISTS "Gestao financeira gere balancetes" ON public.balancetes;

-- As duas de leitura ficam como estavam, e são recriadas aqui para esta
-- migração poder ser lida sozinha: quem gere vê tudo, o condómino vê o que
-- está publicado.
DROP POLICY IF EXISTS "Gestao financeira ve balancetes" ON public.balancetes;
CREATE POLICY "Gestao financeira ve balancetes"
  ON public.balancetes FOR SELECT TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id));

DROP POLICY IF EXISTS "Membros veem balancetes publicados" ON public.balancetes;
CREATE POLICY "Membros veem balancetes publicados"
  ON public.balancetes FOR SELECT TO authenticated
  USING (status = 'publicado' AND public.is_member_of(auth.uid(), condominio_id));

-- ------------------------------------------------------------
-- 3: a invariante, no nível mais baixo.
--
-- Duas regras, e nada mais do que isso:
--
--   * Um balancete nasce `rascunho`. Publicar é um acto à parte, que
--     `publicar_balancete` registra no `audit_log` — inserir uma linha já
--     publicada seria publicar sem rasto.
--
--   * Enquanto está `publicado`, os números e o documento não mudam. O que
--     pode mudar é o estado, porque `reabrir_balancete` tem de poder tirá-lo
--     da vista dos condóminos para ser corrigido — e isso também fica
--     registado. Depois de reaberto já é `rascunho`, e aí o fecho reescreve à
--     vontade.
--
-- Compatível com as três funções: `fechar_balancete` escreve sempre sobre
-- `rascunho`, `publicar_balancete` muda o estado a partir de `rascunho`, e
-- `reabrir_balancete` muda só o estado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_balancetes_integridade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'publicado' THEN
      RAISE EXCEPTION 'balancete_nasce_rascunho'
        USING HINT = 'Feche o período e publique com publicar_balancete().';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'publicado' AND (
       NEW.dados          IS DISTINCT FROM OLD.dados
    OR NEW.saldo_anterior IS DISTINCT FROM OLD.saldo_anterior
    OR NEW.total_receitas IS DISTINCT FROM OLD.total_receitas
    OR NEW.total_despesas IS DISTINCT FROM OLD.total_despesas
    OR NEW.saldo_final    IS DISTINCT FROM OLD.saldo_final
    OR NEW.inadimplencia  IS DISTINCT FROM OLD.inadimplencia
    OR NEW.observacoes    IS DISTINCT FROM OLD.observacoes
    OR NEW.periodo_inicio IS DISTINCT FROM OLD.periodo_inicio
    OR NEW.periodo_fim    IS DISTINCT FROM OLD.periodo_fim
    OR NEW.condominio_id  IS DISTINCT FROM OLD.condominio_id
  ) THEN
    RAISE EXCEPTION 'balancete_publicado_imutavel'
      USING HINT = 'Reabra o balancete antes de o alterar.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_balancetes_integridade() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_balancetes_guard ON public.balancetes;
-- `trg_balancetes_guard` corre antes de `trg_balancetes_upd` (os triggers com o
-- mesmo momento correm por ordem alfabética do nome, e "g" vem antes de "u").
-- Não que importe: a verificação compara colunas que o `touch_updated_at` não
-- toca.
CREATE TRIGGER trg_balancetes_guard
  BEFORE INSERT OR UPDATE ON public.balancetes
  FOR EACH ROW EXECUTE FUNCTION public.guard_balancetes_integridade();
