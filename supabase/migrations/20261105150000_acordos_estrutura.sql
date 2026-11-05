-- Acordos de parcelamento de dívida condominial. Estrutura.
--
-- O QUE É
--
-- O síndico e um condómino em atraso acordam liquidar a dívida em prestações.
-- O acordo consolida cobranças em aberto numa data, podendo abater encargos e
-- receber uma entrada, e gera as parcelas.
--
-- AS TRÊS DECISÕES QUE DEFINEM O DESENHO
--
-- 1. CADA PARCELA É UMA COBRANÇA. Não uma tabela nova de prestações. Assim a
--    parcela herda o sistema inteiro de graça: se atrasar, o motor cobra-lhe
--    multa e juros como a qualquer outra, entra na inadimplência, aceita
--    pagamento parcial com imputação pelo art. 354, e aparece no balancete
--    quando é recebida. Uma tabela paralela obrigaria a duplicar tudo isso, e
--    duas implementações da mesma regra divergem sempre.
--
-- 2. AS ORIGINAIS PASSAM A `em_acordo`, NÃO SÃO APAGADAS. A dívida muda de
--    sítio, e a história da unidade tem de a mostrar. Ver a migração do enum
--    para o efeito que isto tem na contagem.
--
-- 3. OS VALORES FICAM CONGELADOS EM `acordo_itens`. O motor calcula encargos
--    a partir do histórico de pagamentos; depois do acordo esse cálculo
--    deixa de descrever estas linhas. O que cada cobrança valia à data do
--    acordo tem de ficar gravado, senão não há como reconstituir a conta.
--
-- O ABATIMENTO
--
-- `valor_desconto` está limitado por CHECK a multa mais juros. Perdoar
-- principal é outra coisa: a despesa já foi rateada, e o que se perdoa a um
-- condómino é suportado pelos outros. Isso é deliberação de assembleia, não
-- acto de gestão — e, a existir, entra como tal e não disfarçado de acordo.
--
-- `autorizacao` existe para registar de quem foi a decisão de abater. Mesmo
-- dentro do limite, perdoar encargos dispõe de receita comum.

CREATE TYPE public.acordo_status AS ENUM ('ativo', 'quitado', 'rescindido', 'cancelado');

CREATE TABLE public.acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  data_acordo date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,

  -- A dívida consolidada, congelada à data do acordo.
  valor_principal numeric(14,2) NOT NULL,
  valor_multa numeric(14,2) NOT NULL,
  valor_juros numeric(14,2) NOT NULL,
  valor_desconto numeric(14,2) NOT NULL DEFAULT 0,
  valor_entrada numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL,

  num_parcelas integer NOT NULL,
  status public.acordo_status NOT NULL DEFAULT 'ativo',

  autorizacao text,
  observacoes text,
  rescindido_em timestamptz,
  rescisao_motivo text,

  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT acordo_numero_unico UNIQUE (condominio_id, numero),
  CONSTRAINT acordo_parcelas_validas CHECK (num_parcelas BETWEEN 1 AND 60),
  CONSTRAINT acordo_valores_nao_negativos CHECK (
    valor_principal >= 0 AND valor_multa >= 0 AND valor_juros >= 0
    AND valor_desconto >= 0 AND valor_entrada >= 0 AND valor_total >= 0
  ),
  CONSTRAINT acordo_desconto_so_sobre_encargos CHECK (valor_desconto <= valor_multa + valor_juros),
  CONSTRAINT acordo_total_coerente CHECK (
    valor_total = valor_principal + valor_multa + valor_juros - valor_desconto
  )
);

COMMENT ON TABLE public.acordos IS
  'Acordo de parcelamento de dívida de uma unidade. As cobranças consolidadas passam a em_acordo e as parcelas nascem como cobranças novas.';

CREATE TABLE public.acordo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  principal numeric(14,2) NOT NULL,
  multa numeric(14,2) NOT NULL,
  juros numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acordo_item_unico UNIQUE (acordo_id, cobranca_id)
);

-- A ligação da parcela ao acordo que a gerou. Parcela 0 é a entrada.
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS acordo_id uuid REFERENCES public.acordos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parcela_num integer;

CREATE INDEX IF NOT EXISTS idx_cobrancas_acordo ON public.cobrancas (acordo_id);
CREATE INDEX IF NOT EXISTS idx_acordos_condominio ON public.acordos (condominio_id);
CREATE INDEX IF NOT EXISTS idx_acordos_unidade ON public.acordos (unidade_id);
CREATE INDEX IF NOT EXISTS idx_acordo_itens_acordo ON public.acordo_itens (acordo_id);
CREATE INDEX IF NOT EXISTS idx_acordo_itens_cobranca ON public.acordo_itens (cobranca_id);

ALTER TABLE public.acordos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro vê acordos do condomínio" ON public.acordos
  FOR SELECT USING (public.pode_gerir_financeiro(auth.uid(), condominio_id));

CREATE POLICY "Morador vê acordos da sua unidade" ON public.acordos
  FOR SELECT USING (public.is_morador_da_unidade(auth.uid(), unidade_id));

CREATE POLICY "Itens seguem o acordo" ON public.acordo_itens
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.acordos a
     WHERE a.id = acordo_itens.acordo_id
       AND (public.pode_gerir_financeiro(auth.uid(), a.condominio_id)
            OR public.is_morador_da_unidade(auth.uid(), a.unidade_id))
  ));

-- Sem escrita directa, nem para o síndico. Um acordo só existe se as
-- cobranças originais tiverem mudado de estado e as parcelas tiverem
-- nascido, tudo na mesma transacção. Uma linha inserida à mão seria um
-- acordo sem parcelas, ou com a dívida contada duas vezes. As funções
-- garantem o conjunto; uma política não consegue exprimir isso.
REVOKE INSERT, UPDATE, DELETE ON public.acordos FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.acordo_itens FROM authenticated, anon;
GRANT SELECT ON public.acordos TO authenticated;
GRANT SELECT ON public.acordo_itens TO authenticated;

CREATE TRIGGER touch_acordos BEFORE UPDATE ON public.acordos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
