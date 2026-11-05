-- Uma linha de um condomínio não pode apontar para coisa de outro.
--
-- O QUE ESTAVA ABERTO
--
-- A política "Síndico/Porteiro gerenciam ocorrências" é `FOR ALL` e o seu
-- `WITH CHECK` verifica só o `condominio_id`. O mesmo em `reservas`. Nada
-- impedia o síndico do condomínio A de gravar, por escrita directa via
-- PostgREST:
--
--   INSERT INTO ocorrencias (condominio_id, unidade_id, ...)
--   VALUES ('<A>', '<unidade do condomínio B>', ...)
--
-- As funções validam — `abrir_ocorrencia` recusa `unidade_invalida`,
-- `solicitar_reserva` idem — mas a escrita directa não passa por elas.
--
-- O QUE ISSO CUSTAVA
--
-- Não é fuga de dados de outro condomínio: o síndico de A não lê nada de B
-- por esta via. É escrita cruzada, e dá dois estragos reais:
--
--   - Uma reserva de A sobre uma área de B ocupa a agenda de B. O síndico de
--     B vê o horário bloqueado e não vê por quem.
--   - As políticas de leitura de `ocorrencia_comentarios` e
--     `ocorrencia_anexos` usam `is_morador_da_unidade(uid, o.unidade_id)`.
--     Uma ocorrência de A apontada a uma unidade de B fica visível ao morador
--     de B, com os comentários de A.
--
-- A CORREÇÃO
--
-- Um gatilho genérico, e não remendos nas políticas. Três razões:
--
--   1. O levantamento deu DEZANOVE pares assim no esquema, em quinze tabelas.
--      Eu só tinha encontrado dois, por acaso. Corrigir política a política
--      deixava os outros dezassete abertos, e cada tabela nova repetiria o
--      descuido.
--   2. Uma política só se aplica a quem passa pelo RLS. O gatilho aplica-se a
--      toda a escrita, incluindo a das funções `SECURITY DEFINER` — que é
--      exactamente onde o erro de programação mais passa despercebido.
--   3. A regra fica escrita uma vez. Uma tabela nova herda-a com uma linha.
--
-- CUSTO
--
-- Uma consulta por referência e por linha, cada uma uma busca por chave
-- primária. Nas tabelas onde isto corre em lote — `gerar_cobrancas_lote` num
-- condomínio de duzentas unidades — são quatrocentas buscas indexadas. É
-- barato, e a alternativa é confiar que nenhum caminho de escrita se engana.


CREATE OR REPLACE FUNCTION public.validar_coerencia_condominio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dados jsonb := to_jsonb(NEW);
  _cond uuid := (_dados->>'condominio_id')::uuid;
  _i int := 0;
  _col text;
  _tab text;
  _val uuid;
  _ok boolean;
BEGIN
  -- Sem condomínio na linha não há coerência a verificar.
  IF _cond IS NULL THEN RETURN NEW; END IF;

  -- Os argumentos vêm em pares: coluna local, tabela a que ela aponta.
  WHILE _i < TG_NARGS LOOP
    _col := TG_ARGV[_i];
    _tab := TG_ARGV[_i + 1];
    _val := (_dados->>_col)::uuid;

    IF _val IS NOT NULL THEN
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I x WHERE x.id = $1 AND x.condominio_id = $2)',
        _tab)
        INTO _ok USING _val, _cond;

      IF NOT _ok THEN
        RAISE EXCEPTION 'condominio_incoerente'
          USING HINT = format(
            '%s.%s aponta para um registo de %s que não pertence a este condomínio.',
            TG_TABLE_NAME, _col, _tab);
      END IF;
    END IF;

    _i := _i + 2;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validar_coerencia_condominio() IS
  'Gatilho genérico: recusa uma linha cujo condominio_id não bate com o das linhas que ela referencia. Argumentos em pares (coluna, tabela alvo).';


-- Um gatilho por tabela, com os pares que lhe cabem. A lista vem do
-- levantamento das chaves estrangeiras entre tabelas que ambas têm
-- `condominio_id`; está no cabeçalho a razão de serem todas e não só as duas
-- que eu tinha encontrado.

DROP TRIGGER IF EXISTS trg_coerencia ON public.acordos;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.acordos
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');

DROP TRIGGER IF EXISTS trg_coerencia ON public.area_bloqueios;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.area_bloqueios
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('area_id', 'areas_comuns');

DROP TRIGGER IF EXISTS trg_coerencia ON public.cobrancas;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'unidade_id', 'unidades', 'categoria_id', 'categorias_financeiras',
    'acordo_id', 'acordos');

DROP TRIGGER IF EXISTS trg_coerencia ON public.convites;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.convites
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');

DROP TRIGGER IF EXISTS trg_coerencia ON public.despesas;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'categoria_id', 'categorias_financeiras');

DROP TRIGGER IF EXISTS trg_coerencia ON public.encomendas;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.encomendas
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');

DROP TRIGGER IF EXISTS trg_coerencia ON public.notificacoes_whatsapp;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.notificacoes_whatsapp
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');

DROP TRIGGER IF EXISTS trg_coerencia ON public.ocorrencia_anexos;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.ocorrencia_anexos
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'ocorrencia_id', 'ocorrencias');

DROP TRIGGER IF EXISTS trg_coerencia ON public.ocorrencia_comentarios;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.ocorrencia_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'ocorrencia_id', 'ocorrencias');

DROP TRIGGER IF EXISTS trg_coerencia ON public.ocorrencias;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');

DROP TRIGGER IF EXISTS trg_coerencia ON public.pagamentos;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('cobranca_id', 'cobrancas');

DROP TRIGGER IF EXISTS trg_coerencia ON public.reservas;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'unidade_id', 'unidades', 'area_id', 'areas_comuns', 'cobranca_id', 'cobrancas');

DROP TRIGGER IF EXISTS trg_coerencia ON public.visitantes;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.visitantes
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');

DROP TRIGGER IF EXISTS trg_coerencia ON public.wa_conversas;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.wa_conversas
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio('unidade_id', 'unidades');

DROP TRIGGER IF EXISTS trg_coerencia ON public.wa_mensagens;
CREATE TRIGGER trg_coerencia BEFORE INSERT OR UPDATE ON public.wa_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.validar_coerencia_condominio(
    'conversa_id', 'wa_conversas');
