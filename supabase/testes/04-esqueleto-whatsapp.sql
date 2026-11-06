-- Extensão do esqueleto: as conversas do WhatsApp e o `audit_log`.
-- Vai depois de 00, 01 e 02 — a bateria do comprovante precisa dos anexos, que
-- precisam da camada contábil.

-- Reduzida ao que a autorização por telefone usa. No esquema real tem nome,
-- datas de contacto e a janela de 24 horas da Meta; nada disso decide nada aqui.
CREATE TABLE public.wa_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  user_id uuid,
  UNIQUE (condominio_id, telefone));

-- O `audit_log` real tem FK para `auth.users`; aqui não, porque o esqueleto não
-- tem o schema `auth` com utilizadores a sério e o que se quer conferir é que a
-- linha é escrita com os campos certos.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid REFERENCES public.condominios(id) ON DELETE CASCADE,
  user_id uuid,
  acao text NOT NULL,
  entidade text,
  entidade_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now());
