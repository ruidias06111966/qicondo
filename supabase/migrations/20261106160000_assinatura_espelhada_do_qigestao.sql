-- ============================================================
-- A assinatura, espelhada do QiGestão
--
-- A REGRA
--
-- O QiGestão é o livro oficial de quem pagou. O QiCond guarda uma cópia com
-- data e obedece. Nenhum sistema decide sozinho.
--
-- As colunas `plano`, `assinatura_inicio`, `assinatura_fim`, `valor_mensal` e
-- `suspenso` já existiam em `condominios` e eram uma segunda contabilidade:
-- preenchidas à mão, sem ninguém as confrontar com as faturas. Passam a ser
-- cache, e as colunas novas dizem de onde a cópia veio e quando.
--
-- PORQUE É QUE A TOLERÂNCIA EXISTE
--
-- O caso doloroso não é o condomínio que deve e continua a trabalhar: é o que
-- JÁ PAGOU e fica bloqueado porque o QiCond não conseguiu perguntar ao
-- QiGestão se o pagamento entrou. Um bloqueio velho é o erro perigoso, porque
-- pune quem está em dia e ninguém no QiCond tem como desfazê-lo.
--
-- Por isso um estado de bloqueio EXPIRA. Passados sete dias sem conseguir
-- confirmar, o QiCond deixa de bloquear. Uma falha no sistema de cobrança não
-- pode derrubar os clientes de todos os sistemas ao mesmo tempo.
--
-- O QUE ISTO NÃO FAZ
--
-- Não mexe no RLS. O bloqueio é de interface, e é deliberado: os dados
-- financeiros de um condomínio são dele, e trancá-los na base por causa de uma
-- mensalidade em atraso é desproporcionado — ainda por cima a partir de uma
-- cópia que pode estar errada. O `suspenso` também nunca bloqueou nada no RLS;
-- era, e continua a ser, um sinalizador.
-- ============================================================

ALTER TABLE public.condominios
  -- O estado tal como o QiGestão o reporta: ativa, teste, pausada,
  -- inadimplente, cancelada. Fica como texto e não como enum de propósito: o
  -- vocabulário é do outro sistema, e um valor novo lá não deve partir uma
  -- gravação aqui.
  ADD COLUMN IF NOT EXISTS assinatura_status text,
  -- `false` quando o QiGestão não conhece esta instalação. Não é erro: um
  -- condomínio pode ser criado antes de a assinatura existir.
  ADD COLUMN IF NOT EXISTS assinatura_conhecida boolean,
  -- Quando a cópia foi obtida. É isto que faz a tolerância funcionar — sem a
  -- data, não há como saber se o bloqueio ainda é de confiança.
  ADD COLUMN IF NOT EXISTS assinatura_sincronizada_em timestamptz,
  -- A fatura em aberto, como o QiGestão a devolveu, para o ecrã de bloqueio
  -- mostrar o valor, o atraso e o link de pagamento com o Pix.
  ADD COLUMN IF NOT EXISTS assinatura_fatura jsonb,
  -- O id da assinatura lá, só para diagnóstico.
  ADD COLUMN IF NOT EXISTS assinatura_externa_id uuid;

COMMENT ON COLUMN public.condominios.assinatura_status IS
  'Cópia do status da assinatura no QiGestão. O livro oficial é lá; isto é cache.';
COMMENT ON COLUMN public.condominios.assinatura_sincronizada_em IS
  'Quando a cópia foi obtida. Um bloqueio com mais de sete dias deixa de valer: '
  'punir quem já pagou é pior do que deixar passar quem deve.';
COMMENT ON COLUMN public.condominios.assinatura_conhecida IS
  'false quando o QiGestão não conhece esta instalação. Não bloqueia.';

-- Os estados que o QiGestão usa hoje. Não é restrição fechada por acaso: um
-- valor desconhecido é gravado na mesma e tratado como "não bloqueia", porque
-- o QiCond não tem como adivinhar o que um estado novo significa.
ALTER TABLE public.condominios
  DROP CONSTRAINT IF EXISTS condominios_assinatura_status_formato;
ALTER TABLE public.condominios
  ADD CONSTRAINT condominios_assinatura_status_formato CHECK (
    assinatura_status IS NULL OR assinatura_status ~ '^[a-z_]{1,30}$'
  );

-- A sincronização percorre os condomínios por ordem de quem está mais
-- desactualizado, para que uma falha a meio não deixe sempre os mesmos para trás.
CREATE INDEX IF NOT EXISTS condominios_assinatura_sincronizada
  ON public.condominios (assinatura_sincronizada_em NULLS FIRST);
