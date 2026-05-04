-- =========================================================
-- FASE 7: WhatsApp oficial + Bot + CNAB
-- =========================================================

-- ===== ENUMS =====
CREATE TYPE wa_direcao AS ENUM ('entrada','saida');
CREATE TYPE wa_msg_status AS ENUM ('pendente','enviada','entregue','lida','falha','recebida');
CREATE TYPE wa_msg_tipo AS ENUM ('texto','template','interativo','midia','localizacao','sistema');
CREATE TYPE wa_intent AS ENUM ('menu','segunda_via_boleto','status_reserva','abrir_ocorrencia','confirmar_visitante','desconhecido');

CREATE TYPE cnab_banco AS ENUM ('sicoob','itau','bradesco','bb','caixa','santander','generico');
CREATE TYPE cnab_remessa_status AS ENUM ('gerada','enviada','processada','erro');
CREATE TYPE cnab_evento_tipo AS ENUM ('liquidacao','baixa','rejeicao','protesto','outros');

-- ===== CONFIG WHATSAPP =====
CREATE TABLE public.wa_config (
  condominio_id UUID PRIMARY KEY,
  ativo BOOLEAN NOT NULL DEFAULT false,
  phone_number_id TEXT,
  business_account_id TEXT,
  display_phone TEXT,
  webhook_verify_token TEXT,
  app_secret TEXT,
  template_segunda_via TEXT DEFAULT 'segunda_via_boleto',
  template_visitante TEXT DEFAULT 'visitante_chegou',
  template_encomenda TEXT DEFAULT 'encomenda_chegou',
  template_reserva_status TEXT DEFAULT 'reserva_status',
  saudacao TEXT DEFAULT 'Olá! Sou o assistente virtual do seu condomínio.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_config ENABLE ROW LEVEL SECURITY;

-- Bloqueia leitura via PostgREST: só server functions com service role.
CREATE POLICY "wa_config sem leitura direta"
  ON public.wa_config FOR SELECT TO authenticated USING (false);
CREATE POLICY "Síndico insere wa_config"
  ON public.wa_config FOR INSERT TO authenticated
  WITH CHECK (is_sindico(auth.uid(), condominio_id));
CREATE POLICY "Síndico atualiza wa_config"
  ON public.wa_config FOR UPDATE TO authenticated
  USING (is_sindico(auth.uid(), condominio_id))
  WITH CHECK (is_sindico(auth.uid(), condominio_id));
CREATE POLICY "Síndico deleta wa_config"
  ON public.wa_config FOR DELETE TO authenticated
  USING (is_sindico(auth.uid(), condominio_id));

CREATE TRIGGER wa_config_touch BEFORE UPDATE ON public.wa_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== CONVERSAS =====
CREATE TABLE public.wa_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  telefone TEXT NOT NULL,
  unidade_id UUID,
  user_id UUID,
  nome TEXT,
  ultimo_contato TIMESTAMPTZ NOT NULL DEFAULT now(),
  janela_24h_expira TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (condominio_id, telefone)
);
ALTER TABLE public.wa_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores veem conversas" ON public.wa_conversas
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));
CREATE POLICY "Gestores gerenciam conversas" ON public.wa_conversas
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

CREATE TRIGGER wa_conversas_touch BEFORE UPDATE ON public.wa_conversas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== MENSAGENS =====
CREATE TABLE public.wa_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.wa_conversas(id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL,
  direcao wa_direcao NOT NULL,
  tipo wa_msg_tipo NOT NULL DEFAULT 'texto',
  texto TEXT,
  payload JSONB,
  wa_message_id TEXT,
  status wa_msg_status NOT NULL DEFAULT 'pendente',
  erro TEXT,
  contexto TEXT,
  contexto_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  lido_em TIMESTAMPTZ
);
CREATE INDEX wa_mensagens_conversa_idx ON public.wa_mensagens(conversa_id, created_at DESC);
CREATE INDEX wa_mensagens_wa_id_idx ON public.wa_mensagens(wa_message_id) WHERE wa_message_id IS NOT NULL;
ALTER TABLE public.wa_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores veem mensagens" ON public.wa_mensagens
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR has_role(auth.uid(), condominio_id, 'porteiro'::app_role));

-- ===== ESTADO DO BOT =====
CREATE TABLE public.wa_bot_estado (
  conversa_id UUID PRIMARY KEY REFERENCES public.wa_conversas(id) ON DELETE CASCADE,
  intent wa_intent NOT NULL DEFAULT 'menu',
  passo TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_bot_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sem leitura direta wa_bot_estado"
  ON public.wa_bot_estado FOR SELECT TO authenticated USING (false);

CREATE TRIGGER wa_bot_estado_touch BEFORE UPDATE ON public.wa_bot_estado
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- CNAB
-- =========================================================
CREATE TABLE public.cnab_config (
  condominio_id UUID PRIMARY KEY,
  banco cnab_banco NOT NULL DEFAULT 'sicoob',
  cedente_nome TEXT,
  cedente_documento TEXT,
  agencia TEXT,
  conta TEXT,
  conta_dv TEXT,
  carteira TEXT,
  convenio TEXT,
  variacao TEXT,
  proximo_nosso_numero BIGINT NOT NULL DEFAULT 1,
  proximo_sequencial BIGINT NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cnab_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Síndico/Contador veem cnab_config" ON public.cnab_config
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));
CREATE POLICY "Síndico/Contador gerenciam cnab_config" ON public.cnab_config
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

CREATE TRIGGER cnab_config_touch BEFORE UPDATE ON public.cnab_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cnab_remessas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  banco cnab_banco NOT NULL,
  sequencial BIGINT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  total_titulos INT NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status cnab_remessa_status NOT NULL DEFAULT 'gerada',
  conteudo TEXT,
  gerada_por UUID,
  gerada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviada_em TIMESTAMPTZ,
  observacoes TEXT
);
CREATE INDEX cnab_remessas_cond_idx ON public.cnab_remessas(condominio_id, gerada_em DESC);
ALTER TABLE public.cnab_remessas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Síndico/Contador veem remessas" ON public.cnab_remessas
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));
CREATE POLICY "Síndico/Contador gerenciam remessas" ON public.cnab_remessas
  FOR ALL TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id))
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

CREATE TABLE public.cnab_remessa_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id UUID NOT NULL REFERENCES public.cnab_remessas(id) ON DELETE CASCADE,
  cobranca_id UUID NOT NULL,
  nosso_numero TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  vencimento DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (remessa_id, cobranca_id)
);
CREATE INDEX cnab_remessa_itens_cob_idx ON public.cnab_remessa_itens(cobranca_id);
ALTER TABLE public.cnab_remessa_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Síndico/Contador veem itens remessa" ON public.cnab_remessa_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cnab_remessas r WHERE r.id = remessa_id
      AND (is_sindico(auth.uid(), r.condominio_id) OR is_contador(auth.uid(), r.condominio_id))
  ));

CREATE TABLE public.cnab_retornos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL,
  banco cnab_banco NOT NULL,
  nome_arquivo TEXT NOT NULL,
  total_eventos INT NOT NULL DEFAULT 0,
  valor_total_liquidado NUMERIC(14,2) NOT NULL DEFAULT 0,
  conteudo TEXT,
  importado_por UUID,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cnab_retornos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Síndico/Contador veem retornos" ON public.cnab_retornos
  FOR SELECT TO authenticated
  USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));
CREATE POLICY "Síndico/Contador inserem retornos" ON public.cnab_retornos
  FOR INSERT TO authenticated
  WITH CHECK (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

CREATE TABLE public.cnab_retorno_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retorno_id UUID NOT NULL REFERENCES public.cnab_retornos(id) ON DELETE CASCADE,
  cobranca_id UUID,
  nosso_numero TEXT,
  tipo cnab_evento_tipo NOT NULL,
  data_evento DATE,
  valor NUMERIC(14,2),
  motivo TEXT,
  pagamento_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cnab_retorno_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Síndico/Contador veem eventos retorno" ON public.cnab_retorno_eventos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cnab_retornos r WHERE r.id = retorno_id
      AND (is_sindico(auth.uid(), r.condominio_id) OR is_contador(auth.uid(), r.condominio_id))
  ));

-- =========================================================
-- RPC: próximo nosso_numero (alocação atômica em lote)
-- =========================================================
CREATE OR REPLACE FUNCTION public.cnab_alocar_nosso_numero(_condominio_id UUID, _quantidade INT)
RETURNS TABLE(inicio BIGINT, fim BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _ini BIGINT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (is_sindico(_uid, _condominio_id) OR is_contador(_uid, _condominio_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quantidade <= 0 THEN RAISE EXCEPTION 'quantidade_invalida'; END IF;

  UPDATE public.cnab_config
     SET proximo_nosso_numero = proximo_nosso_numero + _quantidade
   WHERE condominio_id = _condominio_id
   RETURNING proximo_nosso_numero - _quantidade INTO _ini;

  IF _ini IS NULL THEN RAISE EXCEPTION 'cnab_nao_configurado'; END IF;

  RETURN QUERY SELECT _ini, _ini + _quantidade - 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cnab_alocar_nosso_numero(UUID,INT) FROM anon;

-- =========================================================
-- RPC: alocar próximo sequencial de remessa
-- =========================================================
CREATE OR REPLACE FUNCTION public.cnab_proximo_sequencial(_condominio_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _seq BIGINT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (is_sindico(_uid, _condominio_id) OR is_contador(_uid, _condominio_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.cnab_config
     SET proximo_sequencial = proximo_sequencial + 1
   WHERE condominio_id = _condominio_id
   RETURNING proximo_sequencial - 1 INTO _seq;

  IF _seq IS NULL THEN RAISE EXCEPTION 'cnab_nao_configurado'; END IF;
  RETURN _seq;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cnab_proximo_sequencial(UUID) FROM anon;

-- =========================================================
-- RPC: dar baixa em cobrança via retorno (chamado pelo server processador)
-- =========================================================
CREATE OR REPLACE FUNCTION public.cnab_baixar_cobranca(
  _cobranca_id UUID, _valor NUMERIC, _data_pagamento DATE, _retorno_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cond UUID; _total NUMERIC; _pag_id UUID;
BEGIN
  SELECT condominio_id, (valor + multa + juros - desconto)
    INTO _cond, _total
    FROM public.cobrancas WHERE id = _cobranca_id;
  IF _cond IS NULL THEN RAISE EXCEPTION 'cobranca_nao_encontrada'; END IF;

  INSERT INTO public.pagamentos (condominio_id, cobranca_id, valor, forma, pago_em, observacoes)
  VALUES (_cond, _cobranca_id, _valor, 'boleto'::forma_pagamento,
          (_data_pagamento::timestamptz),
          'Baixa automática CNAB ' || _retorno_id::text)
  RETURNING id INTO _pag_id;

  UPDATE public.cobrancas
     SET valor_pago = valor_pago + _valor,
         status = CASE
           WHEN (valor_pago + _valor) >= _total THEN 'paga'::cobranca_status
           WHEN (valor_pago + _valor) > 0 THEN 'parcial'::cobranca_status
           ELSE status END,
         pago_em = CASE WHEN (valor_pago + _valor) >= _total
                        THEN _data_pagamento::timestamptz ELSE pago_em END
   WHERE id = _cobranca_id;

  RETURN _pag_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cnab_baixar_cobranca(UUID,NUMERIC,DATE,UUID) FROM anon, authenticated;