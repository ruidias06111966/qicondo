
-- Enums
CREATE TYPE public.tipo_lancamento AS ENUM ('receita', 'despesa');
CREATE TYPE public.cobranca_status AS ENUM ('pendente', 'paga', 'vencida', 'cancelada', 'parcial');
CREATE TYPE public.forma_pagamento AS ENUM ('pix', 'boleto', 'dinheiro', 'transferencia', 'cartao', 'outro');

-- Categorias financeiras
CREATE TABLE public.categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo public.tipo_lancamento NOT NULL,
  cor TEXT DEFAULT '#10B981',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(condominio_id, nome)
);

-- Cobranças (recebíveis por unidade)
CREATE TABLE public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  competencia DATE NOT NULL,
  vencimento DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0,
  multa NUMERIC(12,2) NOT NULL DEFAULT 0,
  juros NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  status public.cobranca_status NOT NULL DEFAULT 'pendente',
  mp_payment_id TEXT,
  mp_qr_code TEXT,
  mp_qr_code_base64 TEXT,
  mp_ticket_url TEXT,
  pago_em TIMESTAMPTZ,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cobrancas_cond ON public.cobrancas(condominio_id);
CREATE INDEX idx_cobrancas_unid ON public.cobrancas(unidade_id);
CREATE INDEX idx_cobrancas_status ON public.cobrancas(status);
CREATE INDEX idx_cobrancas_venc ON public.cobrancas(vencimento);

-- Pagamentos
CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  forma public.forma_pagamento NOT NULL DEFAULT 'pix',
  pago_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  comprovante_url TEXT,
  observacoes TEXT,
  mp_payment_id TEXT,
  registrado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pagamentos_cond ON public.pagamentos(condominio_id);
CREATE INDEX idx_pagamentos_cob ON public.pagamentos(cobranca_id);

-- Despesas
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  fornecedor TEXT,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  forma public.forma_pagamento,
  anexo_url TEXT,
  registrado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_despesas_cond ON public.despesas(condominio_id);

-- Configuração de pagamento por condomínio
CREATE TABLE public.config_pagamento (
  condominio_id UUID PRIMARY KEY REFERENCES public.condominios(id) ON DELETE CASCADE,
  mp_access_token TEXT,
  mp_public_key TEXT,
  mp_user_id TEXT,
  pix_chave TEXT,
  multa_percentual NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  juros_dia_percentual NUMERIC(5,4) NOT NULL DEFAULT 0.0333,
  dias_envio_lembrete INT NOT NULL DEFAULT 3,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers updated_at
CREATE TRIGGER trg_categorias_upd BEFORE UPDATE ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cobrancas_upd BEFORE UPDATE ON public.cobrancas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_despesas_upd BEFORE UPDATE ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_config_pag_upd BEFORE UPDATE ON public.config_pagamento FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: contador
CREATE OR REPLACE FUNCTION public.is_contador(_user_id UUID, _condominio_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, _condominio_id, 'contador'::public.app_role)
$$;

-- Helper: morador é dono da unidade
CREATE OR REPLACE FUNCTION public.is_morador_da_unidade(_user_id UUID, _unidade_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unidade_moradores
    WHERE user_id = _user_id AND unidade_id = _unidade_id
  )
$$;

-- RLS
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_pagamento ENABLE ROW LEVEL SECURITY;

-- Categorias
CREATE POLICY "Membros veem categorias" ON public.categorias_financeiras FOR SELECT TO authenticated USING (is_member_of(auth.uid(), condominio_id));
CREATE POLICY "Síndico/Contador gerenciam categorias" ON public.categorias_financeiras FOR ALL TO authenticated USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id)) WITH CHECK (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

-- Cobranças
CREATE POLICY "Síndico/Contador veem todas cobranças" ON public.cobrancas FOR SELECT TO authenticated USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));
CREATE POLICY "Morador vê próprias cobranças" ON public.cobrancas FOR SELECT TO authenticated USING (is_morador_da_unidade(auth.uid(), unidade_id));
CREATE POLICY "Síndico/Contador gerenciam cobranças" ON public.cobrancas FOR ALL TO authenticated USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id)) WITH CHECK (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

-- Pagamentos
CREATE POLICY "Síndico/Contador veem pagamentos" ON public.pagamentos FOR SELECT TO authenticated USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));
CREATE POLICY "Morador vê próprios pagamentos" ON public.pagamentos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.id = pagamentos.cobranca_id AND is_morador_da_unidade(auth.uid(), c.unidade_id))
);
CREATE POLICY "Síndico/Contador gerenciam pagamentos" ON public.pagamentos FOR ALL TO authenticated USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id)) WITH CHECK (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

-- Despesas
CREATE POLICY "Síndico/Contador veem despesas" ON public.despesas FOR SELECT TO authenticated USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));
CREATE POLICY "Síndico/Contador gerenciam despesas" ON public.despesas FOR ALL TO authenticated USING (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id)) WITH CHECK (is_sindico(auth.uid(), condominio_id) OR is_contador(auth.uid(), condominio_id));

-- Config pagamento - apenas síndico
CREATE POLICY "Síndico vê config pagamento" ON public.config_pagamento FOR SELECT TO authenticated USING (is_sindico(auth.uid(), condominio_id));
CREATE POLICY "Síndico gerencia config pagamento" ON public.config_pagamento FOR ALL TO authenticated USING (is_sindico(auth.uid(), condominio_id)) WITH CHECK (is_sindico(auth.uid(), condominio_id));

-- Função: gerar cobranças em lote
CREATE OR REPLACE FUNCTION public.gerar_cobrancas_lote(
  _condominio_id UUID,
  _categoria_id UUID,
  _competencia DATE,
  _vencimento DATE,
  _descricao TEXT,
  _usar_taxa_unidade BOOLEAN,
  _valor_padrao NUMERIC
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _count INT := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (is_sindico(_uid, _condominio_id) OR is_contador(_uid, _condominio_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.cobrancas (condominio_id, unidade_id, categoria_id, competencia, vencimento, valor, descricao, criado_por, status)
  SELECT
    _condominio_id,
    u.id,
    _categoria_id,
    _competencia,
    _vencimento,
    CASE WHEN _usar_taxa_unidade AND u.taxa_mensal IS NOT NULL AND u.taxa_mensal > 0 THEN u.taxa_mensal ELSE _valor_padrao END,
    _descricao,
    _uid,
    'pendente'
  FROM public.unidades u
  WHERE u.condominio_id = _condominio_id
    AND NOT EXISTS (
      SELECT 1 FROM public.cobrancas c
      WHERE c.unidade_id = u.id
        AND c.competencia = _competencia
        AND c.categoria_id IS NOT DISTINCT FROM _categoria_id
    );

  GET DIAGNOSTICS _count = ROW_COUNT;

  INSERT INTO public.audit_log (condominio_id, user_id, acao, entidade, metadata)
  VALUES (_condominio_id, _uid, 'cobrancas_geradas', 'cobrancas', jsonb_build_object('count', _count, 'competencia', _competencia));

  RETURN _count;
END;
$$;

-- Função: marcar cobrança como paga (manual)
CREATE OR REPLACE FUNCTION public.registrar_pagamento_manual(
  _cobranca_id UUID,
  _valor NUMERIC,
  _forma public.forma_pagamento,
  _pago_em TIMESTAMPTZ,
  _observacoes TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cond UUID;
  _valor_total NUMERIC;
  _valor_pago_acum NUMERIC;
  _pag_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT condominio_id, (valor + multa + juros - desconto) INTO _cond, _valor_total
  FROM public.cobrancas WHERE id = _cobranca_id;

  IF _cond IS NULL THEN RAISE EXCEPTION 'cobranca_nao_encontrada'; END IF;
  IF NOT (is_sindico(_uid, _cond) OR is_contador(_uid, _cond)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.pagamentos (condominio_id, cobranca_id, valor, forma, pago_em, observacoes, registrado_por)
  VALUES (_cond, _cobranca_id, _valor, _forma, _pago_em, _observacoes, _uid)
  RETURNING id INTO _pag_id;

  UPDATE public.cobrancas
  SET valor_pago = valor_pago + _valor,
      status = CASE
        WHEN (valor_pago + _valor) >= _valor_total THEN 'paga'::cobranca_status
        WHEN (valor_pago + _valor) > 0 THEN 'parcial'::cobranca_status
        ELSE status
      END,
      pago_em = CASE WHEN (valor_pago + _valor) >= _valor_total THEN _pago_em ELSE pago_em END
  WHERE id = _cobranca_id;

  RETURN _pag_id;
END;
$$;
