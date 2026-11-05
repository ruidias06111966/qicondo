-- ============================================================
-- Anexos de comprovação
--
-- O que o síndico tem de poder provar, lançamento a lançamento:
--
--   a despesa existiu   → nota fiscal ou recibo
--   a despesa foi paga  → comprovante de pagamento
--   a receita entrou    → comprovante de depósito, extracto, recibo
--
-- Uma tabela polimórfica e não uma coluna por entidade: um lançamento tem N
-- documentos (nota + comprovante + contrato), e uma coluna `anexo_url` por
-- tabela — que é o que existia — só guarda um e não diz de que tipo é.
--
-- Sem chave estrangeira para a entidade, porque `entidade_id` aponta para
-- quatro tabelas. O que a FK daria fica nos gatilhos: um valida que a entidade
-- existe e é do mesmo condomínio, os outros apagam os anexos quando o
-- lançamento desaparece.
--
-- Limitação conhecida: apagar a linha não apaga o ficheiro no Storage. O
-- ficheiro fica órfão no bucket até a limpeza do lado da aplicação. Preferi
-- isto a um gatilho que escreve em `storage.objects` a partir do `public`.
-- ============================================================

CREATE TYPE public.anexo_tipo AS ENUM (
  'nota_fiscal',
  'recibo',
  'comprovante_pagamento',
  'boleto',
  'contrato',
  'extrato_bancario',
  'outro'
);

CREATE TABLE public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,

  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  tipo public.anexo_tipo NOT NULL DEFAULT 'outro',

  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,

  -- Dados do documento, para o anexo valer como prova sem ser aberto: é o que
  -- permite conferir que a nota é do valor e da data que o lançamento diz.
  documento_numero text,
  documento_data date,
  valor numeric(14,2),
  observacao text,

  enviado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT anexo_entidade_conhecida
    CHECK (entidade IN ('despesa', 'pagamento', 'cobranca', 'infracao')),
  CONSTRAINT anexo_caminho_unico UNIQUE (storage_path),
  CONSTRAINT anexo_tamanho_positivo
    CHECK (tamanho_bytes IS NULL OR tamanho_bytes > 0),
  CONSTRAINT anexo_valor_nao_negativo
    CHECK (valor IS NULL OR valor >= 0)
);

CREATE INDEX idx_anexos_entidade ON public.anexos (condominio_id, entidade, entidade_id);
CREATE INDEX idx_anexos_tipo ON public.anexos (condominio_id, tipo);

-- ------------------------------------------------------------
-- A entidade tem de existir e ser do mesmo condomínio.
--
-- Isto é o que a chave estrangeira faria se `entidade_id` apontasse para uma
-- tabela só. Sem isto, um anexo pode ficar pendurado num id inexistente, ou —
-- pior — num lançamento de outro condomínio, e aparecer na prestação de contas
-- errada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_anexo_entidade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _cond uuid;
BEGIN
  CASE NEW.entidade
    WHEN 'despesa'  THEN SELECT condominio_id INTO _cond FROM public.despesas  WHERE id = NEW.entidade_id;
    WHEN 'pagamento' THEN SELECT condominio_id INTO _cond FROM public.pagamentos WHERE id = NEW.entidade_id;
    WHEN 'cobranca' THEN SELECT condominio_id INTO _cond FROM public.cobrancas  WHERE id = NEW.entidade_id;
    WHEN 'infracao' THEN SELECT condominio_id INTO _cond FROM public.infracoes  WHERE id = NEW.entidade_id;
    ELSE RAISE EXCEPTION 'anexo_entidade_desconhecida';
  END CASE;

  IF _cond IS NULL THEN
    RAISE EXCEPTION 'anexo_lancamento_nao_encontrado'
      USING HINT = format('Nenhum lançamento do tipo "%s" com esse identificador.', NEW.entidade);
  END IF;

  IF _cond <> NEW.condominio_id THEN
    RAISE EXCEPTION 'anexo_de_outro_condominio'
      USING HINT = 'O lançamento pertence a outro condomínio.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_anexo_entidade
  BEFORE INSERT OR UPDATE OF entidade, entidade_id, condominio_id ON public.anexos
  FOR EACH ROW EXECUTE FUNCTION public.validar_anexo_entidade();

-- ------------------------------------------------------------
-- Apagado o lançamento, vão os anexos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_anexos_do_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.anexos
   WHERE entidade = TG_ARGV[0] AND entidade_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('despesa');
CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('pagamento');
CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('cobranca');
CREATE TRIGGER trg_limpar_anexos AFTER DELETE ON public.infracoes
  FOR EACH ROW EXECUTE FUNCTION public.limpar_anexos_do_lancamento('infracao');

-- ------------------------------------------------------------
-- RLS
--
-- Quem gere o financeiro vê e mexe em tudo. O condómino vê os documentos das
-- cobranças e das infrações da sua unidade — é dele que se está a cobrar, e a
-- prova é a primeira coisa que pede.
-- ------------------------------------------------------------
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao financeira gere anexos"
  ON public.anexos FOR ALL TO authenticated
  USING (public.pode_gerir_financeiro(auth.uid(), condominio_id))
  WITH CHECK (public.pode_gerir_financeiro(auth.uid(), condominio_id));

CREATE POLICY "Condomino ve anexos da sua unidade"
  ON public.anexos FOR SELECT TO authenticated
  USING (
    public.is_member_of(auth.uid(), condominio_id)
    AND (
      (entidade = 'cobranca' AND EXISTS (
         SELECT 1 FROM public.cobrancas c
          WHERE c.id = anexos.entidade_id
            AND public.is_morador_da_unidade(auth.uid(), c.unidade_id)))
      OR
      (entidade = 'infracao' AND EXISTS (
         SELECT 1 FROM public.infracoes i
          WHERE i.id = anexos.entidade_id
            AND public.is_morador_da_unidade(auth.uid(), i.unidade_id)))
    )
  );

-- ------------------------------------------------------------
-- Storage
--
-- Layout: {condominio_id}/{entidade}/{entidade_id}/{ficheiro}
--
-- O primeiro segmento é o condomínio porque é por ele que a política decide, e
-- `storage.foldername(name)[1]` é o que ela tem à mão sem ir à base de dados.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-condo', 'comprovantes-condo', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Financeiro le comprovantes"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes-condo'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.pode_gerir_financeiro(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Escrito por extenso de propósito. A RLS da `anexos` aplica-se mesmo dentro da
-- expressão de uma política, e bastaria o EXISTS sobre `anexos` — mas depender
-- disso num sítio onde o erro é dar acesso a documentos de outra unidade é
-- confiança a mais num detalhe que não está à vista.
CREATE POLICY "Condomino le comprovantes da sua unidade"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes-condo'
    AND EXISTS (
      SELECT 1
        FROM public.anexos a
        LEFT JOIN public.cobrancas c
               ON a.entidade = 'cobranca' AND c.id = a.entidade_id
        LEFT JOIN public.infracoes i
               ON a.entidade = 'infracao' AND i.id = a.entidade_id
       WHERE a.storage_path = storage.objects.name
         AND public.is_member_of(auth.uid(), a.condominio_id)
         AND public.is_morador_da_unidade(
               auth.uid(),
               COALESCE(c.unidade_id, i.unidade_id)
             )
    )
  );

CREATE POLICY "Financeiro envia comprovantes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes-condo'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.pode_gerir_financeiro(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Financeiro apaga comprovantes"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes-condo'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.pode_gerir_financeiro(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ============================================================
-- Operações
-- ============================================================

-- O ficheiro sobe pelo Storage; esta função registra o que ele é. Separado de
-- propósito: o upload é do cliente para o Storage e não passa pela base de
-- dados, e um `storage_path` que não existe no bucket é um registo a menos mau
-- do que um ficheiro no bucket que ninguém sabe a que lançamento pertence.
CREATE OR REPLACE FUNCTION public.registrar_anexo(
  _condominio_id uuid,
  _entidade text,
  _entidade_id uuid,
  _tipo public.anexo_tipo,
  _storage_path text,
  _nome_arquivo text,
  _mime_type text DEFAULT NULL,
  _tamanho_bytes bigint DEFAULT NULL,
  _documento_numero text DEFAULT NULL,
  _documento_data date DEFAULT NULL,
  _valor numeric DEFAULT NULL,
  _observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _storage_path IS NULL OR btrim(_storage_path) = '' THEN
    RAISE EXCEPTION 'anexo_sem_caminho';
  END IF;

  -- O caminho tem de começar pelo condomínio, senão as políticas do Storage
  -- decidem sobre um condomínio e o registo diz outro.
  IF split_part(_storage_path, '/', 1) <> _condominio_id::text THEN
    RAISE EXCEPTION 'anexo_caminho_invalido'
      USING HINT = 'O caminho no Storage tem de começar pelo id do condomínio.';
  END IF;

  INSERT INTO public.anexos (
    condominio_id, entidade, entidade_id, tipo,
    storage_path, nome_arquivo, mime_type, tamanho_bytes,
    documento_numero, documento_data, valor, observacao, enviado_por
  ) VALUES (
    _condominio_id, _entidade, _entidade_id, _tipo,
    btrim(_storage_path), btrim(_nome_arquivo), _mime_type, _tamanho_bytes,
    nullif(btrim(_documento_numero), ''), _documento_data, _valor,
    nullif(btrim(_observacao), ''), auth.uid()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- Devolve o caminho para a aplicação apagar o ficheiro no Storage. Se não o
-- devolvesse, quem chama não saberia o que apagar.
CREATE OR REPLACE FUNCTION public.remover_anexo(_anexo_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a public.anexos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _a FROM public.anexos WHERE id = _anexo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'anexo_nao_encontrado'; END IF;

  IF NOT public.pode_gerir_financeiro(auth.uid(), _a.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.anexos WHERE id = _anexo_id;
  RETURN _a.storage_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_anexos(
  _condominio_id uuid,
  _entidade text,
  _entidade_id uuid
)
RETURNS TABLE (
  id uuid,
  tipo public.anexo_tipo,
  storage_path text,
  nome_arquivo text,
  mime_type text,
  tamanho_bytes bigint,
  documento_numero text,
  documento_data date,
  valor numeric,
  observacao text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _unidade uuid;
  _pode boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  _pode := public.pode_gerir_financeiro(auth.uid(), _condominio_id);

  -- SECURITY DEFINER passa por cima da RLS, por isso a mesma regra da política
  -- do condómino tem de estar aqui à mão.
  IF NOT _pode THEN
    IF _entidade = 'cobranca' THEN
      SELECT c.unidade_id INTO _unidade FROM public.cobrancas c
       WHERE c.id = _entidade_id AND c.condominio_id = _condominio_id;
    ELSIF _entidade = 'infracao' THEN
      SELECT i.unidade_id INTO _unidade FROM public.infracoes i
       WHERE i.id = _entidade_id AND i.condominio_id = _condominio_id;
    END IF;

    IF _unidade IS NULL
       OR NOT public.is_member_of(auth.uid(), _condominio_id)
       OR NOT public.is_morador_da_unidade(auth.uid(), _unidade) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  RETURN QUERY
  SELECT a.id, a.tipo, a.storage_path, a.nome_arquivo, a.mime_type,
         a.tamanho_bytes, a.documento_numero, a.documento_data, a.valor,
         a.observacao, a.created_at
    FROM public.anexos a
   WHERE a.condominio_id = _condominio_id
     AND a.entidade = _entidade
     AND a.entidade_id = _entidade_id
   ORDER BY a.tipo, a.created_at;
END;
$$;

-- ============================================================
-- Pendências documentais
--
-- A pergunta a que isto responde é a do conselho fiscal: "de tudo o que foi
-- pago neste período, o que é que não tem papel?".
--
-- Duas provas distintas, e faltam separadamente:
--
--   fiscal      nota fiscal ou recibo — prova que a despesa existiu
--   comprovante comprovante de pagamento ou extracto — prova que saiu dinheiro
--
-- Uma despesa com nota e sem comprovante não é a mesma falha que uma despesa
-- com comprovante e sem nota. A primeira é desorganização; a segunda é o que o
-- auditor marca a vermelho.
-- ============================================================
CREATE OR REPLACE FUNCTION public.pendencias_documentais(
  _condominio_id uuid,
  _inicio date,
  _fim date
)
RETURNS TABLE (
  despesa_id uuid,
  data date,
  fornecedor text,
  descricao text,
  valor numeric,
  conta_codigo text,
  conta_nome text,
  tem_fiscal boolean,
  tem_comprovante boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'periodo_invalido';
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.data,
         d.fornecedor,
         d.descricao,
         d.valor,
         cat.codigo,
         cat.nome,
         EXISTS (SELECT 1 FROM public.anexos a
                  WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                    AND a.tipo IN ('nota_fiscal', 'recibo')),
         EXISTS (SELECT 1 FROM public.anexos a
                  WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                    AND a.tipo IN ('comprovante_pagamento', 'extrato_bancario'))
    FROM public.despesas d
    LEFT JOIN public.categorias_financeiras cat ON cat.id = d.categoria_id
   WHERE d.condominio_id = _condominio_id
     AND d.data BETWEEN _inicio AND _fim
     AND NOT (
       EXISTS (SELECT 1 FROM public.anexos a
                WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                  AND a.tipo IN ('nota_fiscal', 'recibo'))
       AND
       EXISTS (SELECT 1 FROM public.anexos a
                WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                  AND a.tipo IN ('comprovante_pagamento', 'extrato_bancario'))
     )
   ORDER BY d.data, d.valor DESC;
END;
$$;

-- ============================================================
-- Prestação de contas por conta contábil
--
-- O balancete que já existia dá totais por categoria, numa lista plana. Isto
-- dá a árvore: cada grupo com o subtotal dos seus, e a contagem de quantos
-- lançamentos têm documento.
--
-- O subtotal do grupo vem de somar os descendentes, não de um campo guardado.
-- A CTE recursiva enumera os pares (antepassado, descendente) — incluindo cada
-- conta como descendente de si mesma, que é o que faz uma analítica aparecer
-- com o seu próprio valor.
--
-- A receita vem do pagamento e a conta vem da cobrança que ele liquidou, igual
-- ao `calcular_balancete`: um recebimento lançado à mão, sem cobrança, fica
-- sem conta e não entra na árvore. Aparece no balancete e não aqui, e é essa a
-- diferença entre caixa e contabilidade.
-- ============================================================
CREATE OR REPLACE FUNCTION public.prestacao_por_conta(
  _condominio_id uuid,
  _inicio date,
  _fim date
)
RETURNS TABLE (
  conta_id uuid,
  codigo text,
  nome text,
  tipo public.tipo_lancamento,
  nivel int,
  sintetica boolean,
  valor numeric,
  lancamentos int,
  documentados int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.pode_gerir_financeiro(auth.uid(), _condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'periodo_invalido';
  END IF;

  RETURN QUERY
  WITH RECURSIVE movimento AS (
    SELECT d.categoria_id AS conta_id,
           d.valor,
           EXISTS (SELECT 1 FROM public.anexos a
                    WHERE a.entidade = 'despesa' AND a.entidade_id = d.id
                      AND a.tipo IN ('nota_fiscal', 'recibo',
                                     'comprovante_pagamento', 'extrato_bancario')) AS documentado
      FROM public.despesas d
     WHERE d.condominio_id = _condominio_id
       AND d.data BETWEEN _inicio AND _fim

    UNION ALL

    SELECT c.categoria_id,
           p.valor,
           EXISTS (SELECT 1 FROM public.anexos a
                    WHERE a.entidade = 'pagamento' AND a.entidade_id = p.id
                      AND a.tipo IN ('comprovante_pagamento', 'recibo',
                                     'extrato_bancario'))
      FROM public.pagamentos p
      LEFT JOIN public.cobrancas c ON c.id = p.cobranca_id
     WHERE p.condominio_id = _condominio_id
       AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _inicio AND _fim
  ),
  folha AS (
    SELECT m.conta_id,
           sum(m.valor) AS valor,
           count(*)::int AS lancamentos,
           count(*) FILTER (WHERE m.documentado)::int AS documentados
      FROM movimento m
     WHERE m.conta_id IS NOT NULL
     GROUP BY m.conta_id
  ),
  arvore AS (
    SELECT c.id AS antepassado, c.id AS descendente, 0 AS profundidade
      FROM public.categorias_financeiras c
     WHERE c.condominio_id = _condominio_id

    UNION ALL

    SELECT a.antepassado, f.id, a.profundidade + 1
      FROM arvore a
      JOIN public.categorias_financeiras f ON f.conta_pai_id = a.descendente
     WHERE a.profundidade < 8
  )
  SELECT c.id,
         c.codigo,
         c.nome,
         c.tipo,
         COALESCE(array_length(string_to_array(c.codigo, '.'), 1), 3) AS nivel,
         c.sintetica,
         COALESCE(sum(fo.valor), 0)::numeric(14,2),
         COALESCE(sum(fo.lancamentos), 0)::int,
         COALESCE(sum(fo.documentados), 0)::int
    FROM public.categorias_financeiras c
    LEFT JOIN arvore a ON a.antepassado = c.id
    LEFT JOIN folha fo ON fo.conta_id = a.descendente
   WHERE c.condominio_id = _condominio_id
   GROUP BY c.id, c.codigo, c.nome, c.tipo, c.sintetica, c.ativo
  -- Uma conta desactivada sem movimento no período é ruído no relatório.
  HAVING c.ativo OR COALESCE(sum(fo.lancamentos), 0) > 0
   ORDER BY c.tipo,
            (string_to_array(c.codigo, '.')::int[]) NULLS LAST,
            c.nome;
END;
$$;

-- ------------------------------------------------------------
-- Permissões
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.registrar_anexo(uuid, text, uuid, public.anexo_tipo, text, text, text, bigint, text, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_anexo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_anexos(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pendencias_documentais(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestacao_por_conta(uuid, date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.registrar_anexo(uuid, text, uuid, public.anexo_tipo, text, text, text, bigint, text, date, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remover_anexo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_anexos(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pendencias_documentais(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prestacao_por_conta(uuid, date, date) FROM anon;

REVOKE EXECUTE ON FUNCTION public.validar_anexo_entidade() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.limpar_anexos_do_lancamento() FROM authenticated, anon;
