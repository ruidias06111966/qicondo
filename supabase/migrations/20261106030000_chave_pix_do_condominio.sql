-- ============================================================
-- A chave Pix do condomínio
--
-- PORQUE É QUE ISTO BASTA
--
-- O Pix "copia e cola" não é uma integração: é um formato de dados. O BR Code
-- monta-se a partir da chave, do nome e da cidade do recebedor, e quem paga
-- transfere directamente para a conta do condomínio. Não há credencial de
-- banco, não há conta intermediária, e o dinheiro nunca passa pela
-- plataforma — que é o que a página de preços promete por escrito.
--
-- Esta migração guarda a chave e o seu tipo. O gerador do payload está em
-- `src/lib/pix/brcode.ts`, verificado contra os dois exemplos do «Manual de
-- Padrões para Iniciação do Pix» do BACEN.
--
-- O QUE ISTO NÃO FAZ
--
-- Não dá baixa automática. O Pix estático não notifica ninguém: o dinheiro
-- entra na conta do condomínio e a cobrança continua em aberto até alguém a
-- liquidar. É por isso que o `pix_txid` existe (ver abaixo) e é por isso que
-- o caminho previsto para a confirmação é o comprovante anexado à cobrança,
-- pelo módulo de anexos.
--
-- PORQUE É QUE A VALIDAÇÃO ESTÁ AQUI E NÃO SÓ NO ECRÃ
--
-- Uma chave Pix errada não falha: gera um QR Code que o banco recusa sem
-- explicação, ou — pior — que paga a outra pessoa. O síndico descobre pelo
-- condómino, dias depois. A convenção do projecto é que a autorização real é
-- o RLS e não a interface; o mesmo raciocínio vale para a integridade de um
-- dado que move dinheiro.
-- ============================================================

-- ------------------------------------------------------------
-- Tipo da chave
-- ------------------------------------------------------------
-- O DICT aceita cinco formas. O tipo é guardado em separado porque a
-- validação de cada uma é diferente e porque o ecrã precisa de saber qual
-- máscara mostrar — inferi-lo da forma da chave seria adivinhar (um CPF e uma
-- conta de telefone sem o prefixo são ambos onze dígitos).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chave_pix_tipo') THEN
    CREATE TYPE public.chave_pix_tipo AS ENUM ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria');
  END IF;
END $$;

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS chave_pix_tipo public.chave_pix_tipo;

COMMENT ON COLUMN public.condominios.chave_pix IS
  'Chave Pix do condomínio, na forma em que o DICT a conhece. É para aqui que '
  'o dinheiro das cobranças vai; a plataforma não intermedeia.';
COMMENT ON COLUMN public.condominios.chave_pix_tipo IS
  'Forma da chave. Guardado em separado porque não se infere com segurança: '
  'um CPF e um telefone sem prefixo são ambos onze dígitos.';

-- ------------------------------------------------------------
-- Coerência entre a chave e o tipo
-- ------------------------------------------------------------
-- As duas colunas andam juntas: ou ambas preenchidas, ou ambas vazias. Uma
-- chave sem tipo não se sabe validar, e um tipo sem chave não serve para nada.
ALTER TABLE public.condominios
  DROP CONSTRAINT IF EXISTS condominios_chave_pix_completa;
ALTER TABLE public.condominios
  ADD CONSTRAINT condominios_chave_pix_completa CHECK (
    (chave_pix IS NULL AND chave_pix_tipo IS NULL)
    OR (chave_pix IS NOT NULL AND chave_pix_tipo IS NOT NULL)
  );

-- O comprimento máximo vem da norma: o template 26 do BR Code cabe em 99
-- caracteres e, sem informação adicional, sobram 77 para a chave (nota 22 do
-- manual do BACEN). Uma chave maior do que isso não cabe num QR Code válido.
ALTER TABLE public.condominios
  DROP CONSTRAINT IF EXISTS condominios_chave_pix_cabe_no_brcode;
ALTER TABLE public.condominios
  ADD CONSTRAINT condominios_chave_pix_cabe_no_brcode CHECK (
    chave_pix IS NULL OR length(chave_pix) BETWEEN 1 AND 77
  );

-- ------------------------------------------------------------
-- Forma de cada tipo de chave
-- ------------------------------------------------------------
-- Não se valida o dígito verificador do CPF e do CNPJ aqui: isso é trabalho
-- de uma função, e o `validar_documento` do projecto já o faz onde é devido.
-- O que esta restrição apanha é a forma — e a forma é o que distingue uma
-- chave que o DICT pode conhecer de uma que seguramente não conhece.
--
-- O telefone segue o formato do DICT: `+55` seguido de DDD e número, sem
-- espaços nem pontuação. É a forma que tem de ir dentro do BR Code; uma chave
-- gravada como "(61) 99999-9999" gera um QR que não encontra ninguém.
ALTER TABLE public.condominios
  DROP CONSTRAINT IF EXISTS condominios_chave_pix_forma;
ALTER TABLE public.condominios
  ADD CONSTRAINT condominios_chave_pix_forma CHECK (
    chave_pix IS NULL
    OR CASE chave_pix_tipo
         WHEN 'cpf' THEN chave_pix ~ '^[0-9]{11}$'
         WHEN 'cnpj' THEN chave_pix ~ '^[0-9]{14}$'
         WHEN 'telefone' THEN chave_pix ~ '^\+55[0-9]{10,11}$'
         WHEN 'email' THEN chave_pix ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$'
                           AND length(chave_pix) <= 77
         -- A chave aleatória é um UUID em minúsculas, como o DICT a emite.
         WHEN 'aleatoria' THEN chave_pix ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         -- Sem este ELSE, um valor novo no enum cairia no NULL que o CASE
         -- devolve quando nada corresponde — e um CHECK que devolve NULL não é
         -- violado. Ou seja: acrescentar uma forma de chave ao enum abriria,
         -- em silêncio, a porta a qualquer texto nessa forma. Falhar é o
         -- comportamento certo: quem acrescenta o tipo acrescenta a regra.
         ELSE false
       END
  );

-- ------------------------------------------------------------
-- O identificador da transação na cobrança
-- ------------------------------------------------------------
-- O `txid` (campo 62-05 do BR Code) vai dentro do QR e, diz o manual na
-- secção 2.6.2, «deve ser retransmitido intacto pelo PSP do pagador». Hoje
-- não o conseguimos ler de volta, porque isso exige a API Pix do banco do
-- condomínio. Mas a secção 5.3.2 diz que a API devolve as transações com o
-- txid em questão — ou seja, o dia em que um condomínio ligar a API do banco
-- dele, a conciliação encontra os pagamentos antigos já identificados.
--
-- Guardá-lo agora custa uma coluna. Não o guardar custaria regenerar e
-- reenviar todos os QR Code mais tarde.
--
-- A norma permite 25 caracteres, só letras sem acento e dígitos — por isso
-- não serve o uuid da cobrança com hífenes, e não é o uuid que aqui fica.
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS pix_txid text;

COMMENT ON COLUMN public.cobrancas.pix_txid IS
  'Identificador levado no campo 62-05 do BR Code, para conciliação. Máximo '
  '25 caracteres, apenas [A-Za-z0-9], conforme a secção 2.6.2 do manual do '
  'BACEN.';

ALTER TABLE public.cobrancas
  DROP CONSTRAINT IF EXISTS cobrancas_pix_txid_forma;
ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_pix_txid_forma CHECK (
    pix_txid IS NULL OR pix_txid ~ '^[A-Za-z0-9]{1,25}$'
  );

-- Um txid repetido dentro do mesmo condomínio tornaria a conciliação
-- ambígua, que é precisamente o problema que o manual atribui ao recebedor na
-- secção 5.3.2: «a consistência dos pagamentos realizados por meio de QR
-- Codes estáticos fica totalmente a cargo do usuário recebedor».
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_pix_txid_unico
  ON public.cobrancas (condominio_id, pix_txid)
  WHERE pix_txid IS NOT NULL;

-- ------------------------------------------------------------
-- Os dados do Pix de uma cobrança
-- ------------------------------------------------------------
-- Devolve tudo o que o gerador do BR Code precisa, numa chamada, e atribui o
-- txid na primeira vez que a cobrança é apresentada para pagamento.
--
-- O txid deriva do id da cobrança: os 25 primeiros caracteres hexadecimais do
-- uuid sem hífenes. É determinístico de propósito — se a coluna se perder,
-- reconstrói-se — e a norma não deixa usar o uuid como está, porque o campo
-- 62-05 só aceita letras e dígitos (secção 2.6.2). Vinte e cinco dígitos
-- hexadecimais são cem bits: dentro de um condomínio a colisão não acontece, e
-- o índice único está lá para o caso de o esquema mudar um dia.
--
-- Esta função ESCREVE, por isso é VOLATILE. Não é zelo: a `carta_cobranca`
-- nasceu `STABLE` com um INSERT no corpo e nunca funcionou — o Postgres
-- recusa com «INSERT is not allowed in a non-volatile function» em todas as
-- chamadas, e isso só se descobriu quando lhe escrevemos uma bateria.
CREATE OR REPLACE FUNCTION public.pix_da_cobranca(_cobranca_id uuid)
RETURNS TABLE (
  chave text,
  chave_tipo public.chave_pix_tipo,
  recebedor text,
  cidade text,
  -- `centavos` é o que vai no QR. As três colunas seguintes são a sua
  -- composição, para o ecrã poder escrever «R$ 450,00 + R$ 9,00 de multa +
  -- R$ 1,50 de juros» em vez de um total sem explicação — num condomínio, um
  -- valor que o condómino não sabe decompor é uma discussão na assembleia.
  centavos bigint,
  principal numeric,
  multa numeric,
  juros numeric,
  txid text,
  descricao text
)

LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cob record;
  _condo record;
  _txid text;
  _multa numeric;
  _juros numeric;
  _devido numeric;
  -- A mesma referência que o motor de inadimplência usa. O fuso é explícito
  -- porque `now()::date` no servidor daria o dia seguinte entre as 21h e a
  -- meia-noite de Brasília, e aí a multa do QR não bateria com a do ecrã.
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- O `acordo_id` não entra nesta leitura de propósito. As parcelas de um
  -- acordo são cobranças com `acordo_id` preenchido e estado `pendente` — são
  -- precisamente as que se querem pagar. O que exclui a dívida renegociada é
  -- o estado `em_acordo` da cobrança original, logo abaixo, e não o vínculo.
  SELECT c.id, c.condominio_id, c.unidade_id, c.valor, c.desconto, c.valor_pago,
         c.status, c.descricao, c.pix_txid
    INTO _cob
    FROM public.cobrancas c
   WHERE c.id = _cobranca_id;

  IF _cob.id IS NULL THEN
    RAISE EXCEPTION 'cobranca_nao_encontrada';
  END IF;

  -- Quem pode ver o Pix de uma cobrança: quem gere o financeiro do condomínio
  -- ou o morador da própria unidade. Um morador de outra unidade não tem nada
  -- que ver com esta dívida — e o valor a pagar diz-lhe quanto o vizinho deve.
  IF NOT (
    public.pode_gerir_financeiro(auth.uid(), _cob.condominio_id)
    OR public.is_morador_da_unidade(auth.uid(), _cob.unidade_id)
  ) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  -- Os estados em aberto são três, não um. Escrevi primeiro
  -- `status <> 'pendente'` e isso recusava exactamente os casos em que o QR
  -- mais faz falta: uma cobrança `vencida` é a que se quer cobrar, e uma
  -- `parcial` tem saldo. A lista é a mesma que a `divida_da_unidade` usa, de
  -- propósito — duas noções diferentes de "em aberto" no mesmo sistema
  -- acabam em dois números diferentes no mesmo ecrã.
  --
  -- `em_acordo` fica de fora com intenção: a dívida foi renegociada e quem
  -- paga paga as parcelas do acordo. Gerar QR da cobrança original fá-lo-ia
  -- pagar uma dívida que já não existe nessa forma.
  IF _cob.status NOT IN ('pendente', 'vencida', 'parcial') THEN
    RAISE EXCEPTION 'cobranca_nao_esta_em_aberto';
  END IF;

  SELECT cd.nome, cd.cidade, cd.chave_pix, cd.chave_pix_tipo
    INTO _condo
    FROM public.condominios cd
   WHERE cd.id = _cob.condominio_id;

  IF _condo.chave_pix IS NULL THEN
    RAISE EXCEPTION 'chave_pix_nao_configurada';
  END IF;

  -- A cidade é obrigatória no BR Code (campo 60) e o condomínio pode não a
  -- ter preenchida. Falhar aqui, com o nome do campo, é melhor do que gerar um
  -- QR Code com a cidade vazia e deixar o banco recusá-lo em silêncio.
  IF _condo.cidade IS NULL OR btrim(_condo.cidade) = '' THEN
    RAISE EXCEPTION 'cidade_do_condominio_nao_preenchida';
  END IF;

  _txid := _cob.pix_txid;
  IF _txid IS NULL THEN
    _txid := substr(replace(_cobranca_id::text, '-', ''), 1, 25);
    UPDATE public.cobrancas SET pix_txid = _txid WHERE id = _cobranca_id;
  END IF;

  -- O valor do QR é o que se deve HOJE, e não o principal da cobrança.
  --
  -- A multa e os juros vêm do `_encargos_devidos`, que os calcula à data, e
  -- não das colunas `multa` e `juros` da cobrança. Essa distinção não é
  -- cosmética: as colunas guardam o último valor que o motor gravou, e usá-las
  -- foi o defeito que o PR «A inadimplência mostrava o último valor gravado,
  -- não o devido» corrigiu. Um QR com o principal de uma cobrança vencida
  -- cobra menos do que se deve, e a cobrança não fica quitada; com o valor
  -- gravado há três semanas, cobra o de há três semanas.
  --
  -- O principal usa a mesma expressão da `divida_da_unidade`:
  -- `GREATEST(valor - desconto - valor_pago, 0)`. O `GREATEST` importa numa
  -- cobrança `parcial` em que já se pagou mais do que o principal.
  SELECT COALESCE(e.multa, 0), COALESCE(e.juros, 0)
    INTO _multa, _juros
    FROM public._encargos_devidos(_cob.condominio_id, _cobranca_id, _hoje) e;

  _devido := GREATEST(_cob.valor - COALESCE(_cob.desconto, 0) - COALESCE(_cob.valor_pago, 0), 0)
             + COALESCE(_multa, 0) + COALESCE(_juros, 0);

  -- Um saldo nulo com a cobrança ainda em aberto é incoerência de dados, não
  -- um caso de uso. Um QR de zero reais é recusado pelo banco e o síndico
  -- ficaria sem saber porquê.
  IF _devido <= 0 THEN
    RAISE EXCEPTION 'cobranca_sem_saldo_a_pagar';
  END IF;

  RETURN QUERY SELECT
    _condo.chave_pix,
    _condo.chave_pix_tipo,
    _condo.nome,
    _condo.cidade,
    -- O BR Code quer centavos inteiros. O arredondamento é explícito para que
    -- não haja vírgula flutuante entre a dívida e o QR: um cêntimo a menos
    -- não quita nada.
    (round(_devido * 100))::bigint,
    GREATEST(_cob.valor - COALESCE(_cob.desconto, 0) - COALESCE(_cob.valor_pago, 0), 0),
    COALESCE(_multa, 0),
    COALESCE(_juros, 0),
    _txid,
    _cob.descricao;
END;
$$;

-- `REVOKE ALL ... FROM PUBLIC, anon` e não `REVOKE EXECUTE ... FROM anon`: uma
-- função nasce com EXECUTE concedido a PUBLIC, e revogar só a `anon` não lhe
-- toca. Foi o defeito que a migração 20261105250000 teve de corrigir em
-- dezasseis funções.
REVOKE ALL ON FUNCTION public.pix_da_cobranca(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pix_da_cobranca(uuid) TO authenticated;
