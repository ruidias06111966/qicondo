-- Drop dependent view first
DROP VIEW IF EXISTS public.config_pagamento_safe;

-- Drop Mercado Pago columns
ALTER TABLE public.config_pagamento
  DROP COLUMN IF EXISTS mp_access_token,
  DROP COLUMN IF EXISTS mp_public_key,
  DROP COLUMN IF EXISTS mp_user_id,
  DROP COLUMN IF EXISTS mp_webhook_secret;

-- Add bank account columns for each condomínio
ALTER TABLE public.config_pagamento
  ADD COLUMN IF NOT EXISTS banco_nome text,
  ADD COLUMN IF NOT EXISTS banco_agencia text,
  ADD COLUMN IF NOT EXISTS banco_conta text,
  ADD COLUMN IF NOT EXISTS banco_tipo_conta text,
  ADD COLUMN IF NOT EXISTS banco_titular text,
  ADD COLUMN IF NOT EXISTS banco_cnpj text,
  ADD COLUMN IF NOT EXISTS instrucoes_boleto text;

-- Recreate safe view without MP fields
CREATE VIEW public.config_pagamento_safe
WITH (security_invoker = true) AS
SELECT
  condominio_id,
  CASE
    WHEN pix_chave IS NULL OR length(pix_chave) < 4 THEN NULL::text
    ELSE '****'::text || right(pix_chave, 4)
  END AS pix_chave_mascarada,
  multa_percentual,
  juros_dia_percentual,
  dias_envio_lembrete,
  ativo,
  banco_nome,
  banco_agencia,
  banco_tipo_conta,
  banco_titular,
  banco_cnpj,
  CASE
    WHEN banco_conta IS NULL OR length(banco_conta) < 2 THEN NULL::text
    ELSE '****' || right(banco_conta, 2)
  END AS banco_conta_mascarada,
  instrucoes_boleto,
  updated_at
FROM public.config_pagamento;