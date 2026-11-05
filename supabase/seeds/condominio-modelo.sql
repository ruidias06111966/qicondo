-- ============================================================
-- CONDOMÍNIO MODELO — dados para experimentar o sistema
-- ============================================================
--
-- Não é uma migração. É um guião de dados, para correr à mão no SQL Editor do
-- Supabase quando se quer um condomínio com movimento real para experimentar:
-- doze unidades, três meses de cobranças, pagamentos a faltar de propósito,
-- despesas pagas, uma advertência e a multa que vem dela.
--
-- O QUE ELE FAZ, E PORQUE É ASSIM
--
-- Corre como se fosse você. Define `request.jwt.claims` com o seu `sub` e
-- chama as mesmas funções que a aplicação chama — `criar_condominio`,
-- `gerar_cobrancas_lote`, `registrar_pagamento_manual`, `aplicar_multa`. Não
-- insere nada à mão onde existe função, de propósito: o que fica gravado passa
-- pelas mesmas verificações que passaria pelo ecrã. Se o guião corre, o
-- caminho da aplicação está bom; se recusa, encontrámos um defeito antes de
-- você o encontrar a clicar.
--
-- O que é inserido directamente — unidades, categorias, áreas comuns,
-- configuração de pagamento — é o que a aplicação também grava por escrita
-- directa com RLS, e aqui corre como `postgres`.
--
-- OS ATRASOS SÃO DE PROPÓSITO
--
-- A unidade A-104 não paga nada há três meses: é a que serve para a carta de
-- cobrança, para o acordo de parcelamento e para ver a multa de mora e os
-- juros a correr. A A-101 está em dia: é a que emite o nada consta. Um
-- condomínio onde todos pagam não ensina nada sobre o sistema.
--
-- COMO CORRER
--
--   1. Supabase → SQL Editor → New query
--   2. Colar este ficheiro inteiro e correr
--   3. Ler os avisos (NOTICE) no fim: dizem o id do condomínio e o resumo
--   4. Na aplicação, trocar de condomínio no topo da barra lateral
--
-- Correr duas vezes não duplica: se já existir um condomínio com o código
-- público MODELO, o guião pára e diz qual é.
--
-- PARA APAGAR TUDO DEPOIS
--
--   DELETE FROM public.condominios WHERE codigo_publico = 'MODELO';
--
-- As chaves estrangeiras estão em CASCADE, por isso isso leva unidades,
-- cobranças, pagamentos, despesas, infrações e certidões com ele.
-- ============================================================

DO $$
DECLARE
  _email    text := 'ruidias06111966@gmail.com';  -- troque aqui se for outra conta
  _uid      uuid;
  _cond     uuid;
  _cat_taxa uuid;
  _cat_obra uuid;
  _cat_en   uuid;
  _cat_ag   uuid;
  _cat_li   uuid;
  _cat_ma   uuid;
  _cat_ad   uuid;
  _cob      record;
  _n        int;
  _pagas    int := 0;
  _adv      uuid;
  _multa    uuid;
BEGIN
  -- ---------- quem corre ----------
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email);
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não encontrei a conta % em auth.users. Crie a conta na aplicação primeiro.', _email;
  END IF;

  SELECT id INTO _cond FROM public.condominios WHERE codigo_publico = 'MODELO';
  IF _cond IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um condomínio com o código MODELO (id %). Apague-o antes de voltar a correr.', _cond;
  END IF;

  -- A partir daqui, as funções SECURITY DEFINER vêem-no como o utilizador.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', _uid::text, 'role', 'authenticated')::text,
                     true);

  -- ---------- o condomínio ----------
  _cond := public.criar_condominio(
    'Residencial Modelo',
    '12.345.678/0001-90',
    'SQS 310, Bloco A',
    'Brasília',
    'DF',
    '70363-010',
    NULL,
    'MODELO'
  );
  RAISE NOTICE 'Condomínio criado: %', _cond;

  -- ---------- unidades ----------
  -- Fração ideal soma 100: oito de 8% e quatro de 9%. Taxa mensal diferente
  -- por bloco, para o rateio e o tecto da multa não darem todos o mesmo
  -- número e os erros se verem.
  INSERT INTO public.unidades (condominio_id, bloco, numero, fracao_ideal, taxa_mensal)
  VALUES
    (_cond, 'A', '101', 8, 450), (_cond, 'A', '102', 8, 450),
    (_cond, 'A', '103', 8, 450), (_cond, 'A', '104', 8, 450),
    (_cond, 'A', '201', 8, 480), (_cond, 'A', '202', 8, 480),
    (_cond, 'A', '203', 8, 480), (_cond, 'A', '204', 8, 480),
    (_cond, 'B', '101', 9, 520), (_cond, 'B', '102', 9, 520),
    (_cond, 'B', '103', 9, 520), (_cond, 'B', '104', 9, 520);

  -- O síndico também é condómino, como na vida real. O gatilho de
  -- representante designa-o sozinho.
  INSERT INTO public.unidade_moradores (unidade_id, user_id, vinculo, principal)
  SELECT u.id, _uid, 'proprietario', true
    FROM public.unidades u
   WHERE u.condominio_id = _cond AND u.bloco = 'A' AND u.numero = '101';

  -- ---------- categorias ----------
  INSERT INTO public.categorias_financeiras (condominio_id, nome, tipo, cor, fundo_reserva, ordem)
  VALUES
    (_cond, 'Taxa condominial',    'receita', '#10B981', false, 1),
    (_cond, 'Fundo de reserva',    'receita', '#14B8A6', true,  2),
    (_cond, 'Rateio extraordinário','receita','#0EA5E9', false, 3),
    (_cond, 'Multas e juros',      'receita', '#F59E0B', false, 4),
    (_cond, 'Taxa de uso de áreas','receita', '#3B82F6', false, 5),
    (_cond, 'Outras receitas',     'receita', '#8B5CF6', false, 6),
    (_cond, 'Água',                'despesa', '#3B82F6', false, 1),
    (_cond, 'Energia',             'despesa', '#F59E0B', false, 2),
    (_cond, 'Limpeza',             'despesa', '#14B8A6', false, 3),
    (_cond, 'Manutenção',          'despesa', '#EF4444', false, 4),
    (_cond, 'Segurança',           'despesa', '#8B5CF6', false, 5),
    (_cond, 'Administração',       'despesa', '#EC4899', false, 6),
    (_cond, 'Salários e encargos', 'despesa', '#F97316', false, 7),
    (_cond, 'Outras despesas',     'despesa', '#64748B', false, 8);

  SELECT id INTO _cat_taxa FROM public.categorias_financeiras
   WHERE condominio_id = _cond AND nome = 'Taxa condominial';
  SELECT id INTO _cat_obra FROM public.categorias_financeiras
   WHERE condominio_id = _cond AND nome = 'Rateio extraordinário';
  SELECT id INTO _cat_en FROM public.categorias_financeiras
   WHERE condominio_id = _cond AND nome = 'Energia';
  SELECT id INTO _cat_ag FROM public.categorias_financeiras
   WHERE condominio_id = _cond AND nome = 'Água';
  SELECT id INTO _cat_li FROM public.categorias_financeiras
   WHERE condominio_id = _cond AND nome = 'Limpeza';
  SELECT id INTO _cat_ma FROM public.categorias_financeiras
   WHERE condominio_id = _cond AND nome = 'Manutenção';
  SELECT id INTO _cat_ad FROM public.categorias_financeiras
   WHERE condominio_id = _cond AND nome = 'Administração';

  -- ---------- configuração financeira ----------
  -- Multa de mora de 2% (o tecto do art. 1.336, §1º) e 1% de juros ao mês.
  -- O saldo inicial é o que vinha da gestão anterior: sem ele, o primeiro
  -- balancete começa em zero e não bate com o extrato.
  INSERT INTO public.config_pagamento (
    condominio_id, multa_percentual, juros_dia_percentual,
    saldo_inicial, saldo_inicial_data, dias_envio_lembrete,
    banco_nome, banco_agencia, banco_conta, banco_titular, pix_chave
  ) VALUES (
    _cond, 2, 0.0333, 15000, '2026-09-01', 3,
    'Banco do Brasil', '1234-5', '98765-4', 'Residencial Modelo',
    '12.345.678/0001-90'
  );

  -- ---------- áreas comuns ----------
  INSERT INTO public.areas_comuns (
    condominio_id, nome, capacidade, taxa_uso, requer_aprovacao,
    hora_abertura, hora_fechamento, max_reservas_por_unidade_mes, ordem
  ) VALUES
    (_cond, 'Salão de festas', 60, 150, true,  '10:00', '23:00', 1, 1),
    (_cond, 'Churrasqueira',   20,  80, true,  '10:00', '22:00', 2, 2),
    (_cond, 'Quadra',          12,   0, false, '07:00', '22:00', 8, 3);

  -- ---------- cobranças: três competências ----------
  _n := public.gerar_cobrancas_lote(_cond, _cat_taxa, '2026-09-01', '2026-09-10',
                                    'Taxa condominial 09/2026', 'taxa_unidade', NULL);
  RAISE NOTICE 'Setembro: % cobranças', _n;

  _n := public.gerar_cobrancas_lote(_cond, _cat_taxa, '2026-10-01', '2026-10-10',
                                    'Taxa condominial 10/2026', 'taxa_unidade', NULL);
  RAISE NOTICE 'Outubro: % cobranças', _n;

  _n := public.gerar_cobrancas_lote(_cond, _cat_taxa, '2026-11-01', '2026-11-10',
                                    'Taxa condominial 11/2026', 'taxa_unidade', NULL);
  RAISE NOTICE 'Novembro: % cobranças', _n;

  -- Rateio da pintura da fachada: 9.600 divididos pela fração ideal, que é o
  -- que o art. 1.336, I, manda. Dá 768 nas unidades de 8% e 864 nas de 9%.
  _n := public.gerar_cobrancas_lote(_cond, _cat_obra, '2026-10-01', '2026-10-20',
                                    'Rateio — pintura da fachada', 'fracao_ideal', 9600);
  RAISE NOTICE 'Rateio da fachada: % cobranças', _n;

  -- ---------- pagamentos ----------
  -- Paga tudo o que venceu, excepto a A-104 (não paga nada), a B-103 (parou em
  -- Outubro) e a B-104 (só deve o rateio). Novembro fica pendente porque ainda
  -- não venceu.
  FOR _cob IN
    SELECT c.id, c.valor, c.vencimento, c.competencia, u.bloco, u.numero
      FROM public.cobrancas c
      JOIN public.unidades u ON u.id = c.unidade_id
     WHERE c.condominio_id = _cond
       AND c.vencimento < current_date
     ORDER BY c.vencimento, u.bloco, u.numero
  LOOP
    CONTINUE WHEN _cob.bloco = 'A' AND _cob.numero = '104';
    CONTINUE WHEN _cob.bloco = 'B' AND _cob.numero = '103'
              AND _cob.competencia >= '2026-10-01';
    CONTINUE WHEN _cob.bloco = 'B' AND _cob.numero = '104'
              AND _cob.vencimento = '2026-10-20';

    PERFORM public.registrar_pagamento_manual(
      _cob.id,
      _cob.valor,
      'pix'::public.forma_pagamento,
      (_cob.vencimento - 2)::timestamptz + interval '10 hours',
      NULL
    );
    _pagas := _pagas + 1;
  END LOOP;
  RAISE NOTICE 'Pagamentos registados: %', _pagas;

  -- ---------- despesas pagas ----------
  -- Sem anexo de propósito: é o campo que falta preencher e que a prestação de
  -- contas vai exigir.
  INSERT INTO public.despesas (condominio_id, categoria_id, data, descricao, valor, fornecedor, forma, registrado_por)
  VALUES
    (_cond, _cat_en, '2026-09-12', 'Energia — áreas comuns 08/2026', 1850.40, 'Neoenergia', 'transferencia', _uid),
    (_cond, _cat_ag, '2026-09-18', 'Água e esgoto 08/2026',           920.15, 'Caesb',      'transferencia', _uid),
    (_cond, _cat_li, '2026-09-28', 'Conservação e limpeza 09/2026',  1400.00, 'Limpa Bem Serviços', 'pix',   _uid),
    (_cond, _cat_ma, '2026-10-06', 'Manutenção dos elevadores',      2300.00, 'Atlas Elevadores',   'boleto',_uid),
    (_cond, _cat_en, '2026-10-13', 'Energia — áreas comuns 09/2026', 1790.80, 'Neoenergia', 'transferencia', _uid),
    (_cond, _cat_ad, '2026-10-20', 'Taxa de administração 10/2026',   600.00, 'QiCond',     'pix',           _uid),
    (_cond, _cat_li, '2026-10-28', 'Conservação e limpeza 10/2026',  1400.00, 'Limpa Bem Serviços', 'pix',   _uid),
    (_cond, _cat_ag, '2026-11-03', 'Água e esgoto 10/2026',           965.30, 'Caesb',      'transferencia', _uid);

  -- ---------- advertência e multa ----------
  -- A advertência primeiro, a multa depois, com a reiteração como fundamento.
  -- É a sequência que a maioria das convenções exige, e é a que o ecrã mostra
  -- no histórico da unidade.
  _adv := public.registrar_advertencia(
    _cond,
    (SELECT id FROM public.unidades WHERE condominio_id = _cond AND bloco = 'B' AND numero = '101'),
    '2026-10-12',
    'Som alto depois das 22h, com reclamação de dois vizinhos registada no livro da portaria.',
    'Bloco B, apartamento 101'
  );

  _multa := public.aplicar_multa(
    _cond,
    (SELECT id FROM public.unidades WHERE condominio_id = _cond AND bloco = 'B' AND numero = '101'),
    '2026-10-28',
    'Reincidência de som alto depois das 22h, após a advertência de 12/10/2026.',
    'convencao'::public.infracao_base,
    150,
    '2026-11-25',
    'Bloco B, apartamento 101',
    (SELECT id FROM public.categorias_financeiras
      WHERE condominio_id = _cond AND nome = 'Multas e juros'),
    NULL,
    NULL
  );
  RAISE NOTICE 'Advertência % e multa %', _adv, _multa;

  -- ---------- mora ----------
  -- Depois dos pagamentos, de propósito: o que foi pago em dia fecha sem
  -- encargos, e a multa de 2% e os juros só caem no que ficou em aberto. Se
  -- corresse antes, as cobranças pagas ficariam `parcial` por causa dos
  -- encargos que entretanto nasceram.
  _n := public.aplicar_encargos_atraso(_cond);
  RAISE NOTICE 'Cobranças com mora aplicada: %', _n;

  -- ---------- resumo ----------
  RAISE NOTICE '--------------------------------------------';
  RAISE NOTICE 'Residencial Modelo pronto. Código público: MODELO';
  RAISE NOTICE 'Unidades: %', (SELECT count(*) FROM public.unidades WHERE condominio_id = _cond);
  RAISE NOTICE 'Cobranças: % (% pagas, % em aberto)',
    (SELECT count(*) FROM public.cobrancas WHERE condominio_id = _cond),
    (SELECT count(*) FROM public.cobrancas WHERE condominio_id = _cond AND status = 'paga'),
    (SELECT count(*) FROM public.cobrancas WHERE condominio_id = _cond AND status <> 'paga');
  RAISE NOTICE 'Em aberto: R$ %',
    (SELECT COALESCE(sum(valor + multa + juros - desconto - valor_pago), 0)
       FROM public.cobrancas WHERE condominio_id = _cond AND status <> 'paga');
  RAISE NOTICE 'Despesas pagas: R$ %',
    (SELECT COALESCE(sum(valor), 0) FROM public.despesas WHERE condominio_id = _cond);
  RAISE NOTICE '--------------------------------------------';
  RAISE NOTICE 'A-104 não paga desde Setembro — é a da carta de cobrança e do acordo.';
  RAISE NOTICE 'A-101 está em dia — é a do nada consta.';
  RAISE NOTICE 'B-101 tem advertência e multa — é a do histórico de reincidência.';
END;
$$;


-- ============================================================
-- RESUMO
-- ============================================================
-- Em tabela e não só em NOTICE: o SQL Editor do Supabase mostra o resultado de
-- uma consulta e engole as mensagens do bloco acima.

WITH m AS (SELECT id FROM public.condominios WHERE codigo_publico = 'MODELO')
SELECT
  (SELECT count(*) FROM public.unidades  WHERE condominio_id = (SELECT id FROM m)) AS unidades,
  (SELECT count(*) FROM public.cobrancas WHERE condominio_id = (SELECT id FROM m)) AS cobrancas,
  (SELECT count(*) FROM public.cobrancas WHERE condominio_id = (SELECT id FROM m)
                                           AND status = 'paga')                   AS pagas,
  (SELECT to_char(COALESCE(sum(valor + multa + juros - desconto - valor_pago), 0),
                  'FM999G999G990D00')
     FROM public.cobrancas WHERE condominio_id = (SELECT id FROM m)
                             AND status <> 'paga')                                AS em_aberto,
  (SELECT to_char(COALESCE(sum(valor), 0), 'FM999G999G990D00')
     FROM public.despesas  WHERE condominio_id = (SELECT id FROM m))              AS despesas_pagas,
  (SELECT count(*) FROM public.infracoes WHERE condominio_id = (SELECT id FROM m)) AS infracoes;


-- A situação unidade a unidade. É aqui que se vê que a A-104 é a devedora, a
-- A-101 está limpa e a B-101 tem a multa.

SELECT COALESCE(u.bloco || '-', '') || u.numero                            AS unidade,
       to_char(u.taxa_mensal, 'FM999G990D00')                              AS taxa,
       count(c.id) FILTER (WHERE c.status <> 'paga')                       AS em_aberto,
       to_char(COALESCE(sum(c.valor + c.multa + c.juros - c.desconto - c.valor_pago)
                        FILTER (WHERE c.status <> 'paga'), 0),
               'FM999G990D00')                                             AS deve,
       (SELECT count(*) FROM public.infracoes i
         WHERE i.unidade_id = u.id AND i.status = 'vigente')               AS infracoes
  FROM public.unidades u
  JOIN public.condominios m ON m.id = u.condominio_id AND m.codigo_publico = 'MODELO'
  LEFT JOIN public.cobrancas c ON c.unidade_id = u.id
 GROUP BY u.id, u.bloco, u.numero, u.taxa_mensal
 ORDER BY u.bloco, u.numero;
