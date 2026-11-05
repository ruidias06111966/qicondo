-- O estado `em_acordo` para as cobranças consolidadas num acordo.
--
-- Vai sozinho numa migração porque `ALTER TYPE ... ADD VALUE` não permite
-- usar o valor novo na mesma transacção. Separado, as migrações seguintes
-- podem referi-lo à vontade.
--
-- POR QUE UM ESTADO NOVO, E NÃO `cancelada`
--
-- A dívida não desapareceu: mudou de sítio. `cancelada` diria que nunca foi
-- devida, e isso é falso — passaria a faltar na história da unidade.
--
-- A escolha tem um efeito que vale por si: todas as consultas de
-- inadimplência filtram `status IN ('pendente','vencida','parcial')`. Como
-- `em_acordo` não está nessa lista, as cobranças consolidadas saem da
-- inadimplência sem que nenhuma dessas consultas precise de saber o que é um
-- acordo. A dívida passa a ser contada uma só vez, nas parcelas.

ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'em_acordo';
