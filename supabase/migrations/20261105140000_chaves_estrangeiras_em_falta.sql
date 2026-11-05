-- Trinta chaves estrangeiras em falta, em dezoito tabelas.
--
-- COMO APARECEU
--
-- A percorrer o primeiro uso, apaguei o condomínio de teste e reparei que a
-- ocorrência, a reserva e a área comum tinham sobrevivido. A ocorrência ficou
-- com `condominio_id` a apontar para uma linha que já não existia. Isso só
-- acontece quando não há chave estrangeira nenhuma: uma chave a sério teria
-- propagado o apagamento ou recusado a operação.
--
-- O QUE ISTO CUSTA
--
-- 1. LGPD. Apagar um condomínio deixava para trás as suas ocorrências,
--    reservas, documentos, encomendas, visitantes, conversas de WhatsApp e
--    configurações. O direito ao apagamento não se cumpria, e ninguém dava
--    por isso porque a operação não dava erro.
--
-- 2. Integridade. Nada impedia gravar uma linha com um `condominio_id`,
--    `unidade_id` ou `cobranca_id` inexistente. Um erro de código ou uma
--    chamada mal formada criava lixo silencioso que depois aparece como
--    linhas fantasma em listagens e relatórios.
--
-- A REGRA APLICADA
--
-- Coluna obrigatória (`NOT NULL`) leva `ON DELETE CASCADE`: a linha não faz
-- sentido sem o pai, por isso vai com ele. Coluna que admite vazio leva
-- `ON DELETE SET NULL`: a linha continua a fazer sentido, só perde a ligação.
--
-- Exemplo de cada lado: `reservas.unidade_id` é obrigatória — uma reserva sem
-- unidade não é nada, cai junto. `ocorrencias.unidade_id` é opcional, porque
-- há ocorrências de área comum que não são de unidade nenhuma; apagada a
-- unidade, a ocorrência fica como ocorrência do condomínio.
--
-- POR QUE AGORA
--
-- A base está vazia. Acrescentar as chaves hoje não valida nada e não parte
-- nada. Daqui a um ano, com dados a sério, cada uma destas trinta tem de ser
-- precedida de uma limpeza das linhas órfãs que entretanto se acumularam.
--
-- O QUE ISTO NÃO RESOLVE
--
-- A chave garante que a unidade existe, não que pertence ao mesmo condomínio
-- da linha que lhe aponta. As políticas de `ocorrencias` e `reservas` para o
-- síndico verificam só o `condominio_id`, e `abrir_ocorrencia` valida a
-- coerência mas uma escrita directa por PostgREST não passa por lá. Isso é
-- uma correcção à parte, com os seus próprios testes.

DO $$
DECLARE
  _r record;
  _nome text;
  _acao text;
BEGIN
  FOR _r IN
    SELECT *
      FROM (VALUES
        -- tabela                   coluna           tabela alvo
        ('area_bloqueios',          'condominio_id', 'public.condominios'),
        ('areas_comuns',            'condominio_id', 'public.condominios'),
        ('cnab_config',             'condominio_id', 'public.condominios'),
        ('cnab_remessa_itens',      'cobranca_id',   'public.cobrancas'),
        ('cnab_remessas',           'condominio_id', 'public.condominios'),
        ('cnab_retorno_eventos',    'cobranca_id',   'public.cobrancas'),
        ('cnab_retornos',           'condominio_id', 'public.condominios'),
        ('documentos',              'condominio_id', 'public.condominios'),
        ('encomendas',              'condominio_id', 'public.condominios'),
        ('encomendas',              'unidade_id',    'public.unidades'),
        ('notificacoes_whatsapp',   'condominio_id', 'public.condominios'),
        ('notificacoes_whatsapp',   'unidade_id',    'public.unidades'),
        ('ocorrencia_anexos',       'condominio_id', 'public.condominios'),
        ('ocorrencia_comentarios',  'condominio_id', 'public.condominios'),
        ('ocorrencias',             'condominio_id', 'public.condominios'),
        ('ocorrencias',             'unidade_id',    'public.unidades'),
        ('platform_admins',         'user_id',       'auth.users'),
        ('reservas',                'cobranca_id',   'public.cobrancas'),
        ('reservas',                'condominio_id', 'public.condominios'),
        ('reservas',                'unidade_id',    'public.unidades'),
        ('visitantes',              'condominio_id', 'public.condominios'),
        ('visitantes',              'unidade_id',    'public.unidades'),
        ('wa_config',               'condominio_id', 'public.condominios'),
        ('wa_conversas',            'condominio_id', 'public.condominios'),
        ('wa_conversas',            'unidade_id',    'public.unidades'),
        ('wa_conversas',            'user_id',       'auth.users'),
        ('wa_mensagens',            'condominio_id', 'public.condominios'),
        ('wa_notif_jobs',           'condominio_id', 'public.condominios'),
        ('wa_preferencias',         'condominio_id', 'public.condominios'),
        ('wa_preferencias',         'user_id',       'auth.users')
      ) AS v(tabela, coluna, alvo)
  LOOP
    _nome := _r.tabela || '_' || _r.coluna || '_fkey';

    -- Já existe? Não mexe. Torna a migração repetível sem erro.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public' AND t.relname = _r.tabela
         AND c.contype = 'f' AND c.conname = _nome
    ) THEN
      CONTINUE;
    END IF;

    -- Obrigatória cai com o pai; opcional fica órfã mas viva.
    SELECT CASE WHEN a.attnotnull THEN 'CASCADE' ELSE 'SET NULL' END
      INTO _acao
      FROM pg_attribute a
      JOIN pg_class t ON t.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND t.relname = _r.tabela
       AND a.attname = _r.coluna AND a.attnum > 0 AND NOT a.attisdropped;

    IF _acao IS NULL THEN
      RAISE EXCEPTION 'coluna %.% não encontrada', _r.tabela, _r.coluna;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE %s',
      _r.tabela, _nome, _r.coluna, _r.alvo, _acao);

    RAISE NOTICE 'criada %.% -> % (ON DELETE %)', _r.tabela, _r.coluna, _r.alvo, _acao;
  END LOOP;
END $$;


-- Índice na coluna que referencia, onde ainda não houver.
--
-- Sem ele, apagar um condomínio obriga o Postgres a percorrer cada uma destas
-- tabelas de ponta a ponta para encontrar as linhas a propagar. Com uma base
-- pequena não se nota; com a carteira de um ano, nota-se.

DO $$
DECLARE
  _r record;
  _nome text;
BEGIN
  FOR _r IN
    SELECT t.relname AS tabela, a.attname AS coluna
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
     WHERE n.nspname = 'public' AND c.contype = 'f'
       AND array_length(c.conkey, 1) = 1
       AND NOT EXISTS (
         SELECT 1 FROM pg_index i
          WHERE i.indrelid = t.oid AND i.indkey[0] = a.attnum
       )
  LOOP
    _nome := 'idx_' || _r.tabela || '_' || _r.coluna;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
                   _nome, _r.tabela, _r.coluna);
  END LOOP;
END $$;
