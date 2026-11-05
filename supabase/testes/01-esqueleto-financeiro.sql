-- Extensão do esqueleto: o que o fluxo de caixa e o balancete tocam.
CREATE TYPE public.forma_pagamento AS ENUM ('pix','boleto','dinheiro','transferencia','cartao','outro');
CREATE TYPE public.cobranca_status AS ENUM ('pendente','paga','vencida','cancelada','parcial','em_acordo');

CREATE TABLE public.config_pagamento (
  condominio_id uuid PRIMARY KEY REFERENCES public.condominios(id) ON DELETE CASCADE,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  saldo_inicial_data date,
  multa_percentual numeric(5,2) NOT NULL DEFAULT 2,
  juros_dia_percentual numeric(5,4) NOT NULL DEFAULT 0.0333);

CREATE TABLE public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  competencia date, vencimento date NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0, valor_pago numeric(12,2) NOT NULL DEFAULT 0,
  multa numeric(12,2) NOT NULL DEFAULT 0, juros numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  descricao text, status public.cobranca_status NOT NULL DEFAULT 'pendente');

CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  valor numeric(12,2) NOT NULL,
  forma public.forma_pagamento,
  pago_em timestamptz NOT NULL DEFAULT now(),
  observacoes text);

-- O balancete chama-o; o saldo de abertura não depende dele, e é o saldo de
-- abertura que aqui se compara.
CREATE OR REPLACE FUNCTION public._encargos_devidos(
  _condominio_id uuid, _cobranca_id uuid, _referencia date)
RETURNS TABLE(cobranca_id uuid, multa numeric, juros numeric, dias_atraso int)
LANGUAGE sql STABLE AS $$ SELECT NULL::uuid, 0::numeric, 0::numeric, 0 WHERE false $$;

ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS fornecedor text;
ALTER TABLE public.categorias_financeiras ADD COLUMN IF NOT EXISTS fundo_reserva boolean NOT NULL DEFAULT false;
ALTER TABLE public.categorias_financeiras ADD COLUMN IF NOT EXISTS cor text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS forma public.forma_pagamento;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS anexo_url text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS acordo_id uuid;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS parcela_num integer;
