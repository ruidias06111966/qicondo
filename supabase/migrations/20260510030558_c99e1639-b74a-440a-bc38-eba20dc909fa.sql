ALTER TABLE public.config_pagamento
  ADD COLUMN IF NOT EXISTS wa_automacao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_dias_pre_vencimento integer[] NOT NULL DEFAULT ARRAY[3,1]::integer[],
  ADD COLUMN IF NOT EXISTS wa_dias_pos_vencimento integer[] NOT NULL DEFAULT ARRAY[1,7,15]::integer[],
  ADD COLUMN IF NOT EXISTS wa_template_lembrete text NOT NULL DEFAULT 'Olá {{nome}}! Sua taxa do condomínio da unidade {{unidade}} vence em {{vencimento}}. Valor: {{valor}}. Pague pelo PIX direto no app.',
  ADD COLUMN IF NOT EXISTS wa_template_vencida text NOT NULL DEFAULT 'Olá {{nome}}, identificamos que a taxa da unidade {{unidade}} venceu em {{vencimento}}. Saldo atual: {{valor}}. Por favor regularize via PIX no app.';