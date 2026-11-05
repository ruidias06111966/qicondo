-- Carta de cobrança, nada consta e infrações.
--
-- Ordem: 00-esqueleto, 01-esqueleto-financeiro, 03-esqueleto-certidoes,
-- 20261105170000_carta_cobranca_e_nada_consta,
-- 20261105180000_infracoes_multas_advertencias, este.
--
-- O `_encargos_devidos` do esqueleto devolve sempre zero, de propósito: aqui
-- o que se verifica não é o cálculo de multa e juros de mora — isso tem a sua
-- própria bateria — mas quem recebe carta, quem recebe certidão e quem é
-- recusado. Por isso toda a dívida destes casos é principal, e as contas
-- fecham de cabeça.
\set ON_ERROR_STOP 0
\pset pager off
\pset format aligned

-- ================= cenário =================
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','sindico@t'),
  ('22222222-2222-2222-2222-222222222222','estranho@t'),
  ('33333333-3333-3333-3333-333333333333','dono101@t'),
  ('44444444-4444-4444-4444-444444444444','dono102@t');

INSERT INTO public.profiles (id, nome_completo) VALUES
  ('33333333-3333-3333-3333-333333333333','Maria da Silva'),
  ('44444444-4444-4444-4444-444444444444','João Pereira');

INSERT INTO public.condominios (id, nome, cnpj, endereco, cidade, estado, cep) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Residencial Teste','12.345.678/0001-90',
   'Rua das Flores, 100','Brasília','DF','70000-000');

INSERT INTO public.user_roles (user_id, condominio_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','sindico'),
  ('33333333-3333-3333-3333-333333333333','aaaaaaaa-0000-0000-0000-000000000001','morador'),
  ('44444444-4444-4444-4444-444444444444','aaaaaaaa-0000-0000-0000-000000000001','morador');

-- 101 deve 450 (300 + 150). 102 não deve nada. 103 só tem acordo.
INSERT INTO public.unidades (id, condominio_id, bloco, numero, fracao_ideal, taxa_mensal) VALUES
  ('dddddddd-0000-0000-0000-000000000101','aaaaaaaa-0000-0000-0000-000000000001','A','101',25,400),
  ('dddddddd-0000-0000-0000-000000000102','aaaaaaaa-0000-0000-0000-000000000001','A','102',25,400),
  ('dddddddd-0000-0000-0000-000000000103','aaaaaaaa-0000-0000-0000-000000000001','A','103',25,400),
  -- Sem taxa mensal: é o caso do tecto que não se pode verificar.
  ('dddddddd-0000-0000-0000-000000000104','aaaaaaaa-0000-0000-0000-000000000001','A','104',25,NULL);

INSERT INTO public.unidade_moradores (user_id, unidade_id, vinculo) VALUES
  ('33333333-3333-3333-3333-333333333333','dddddddd-0000-0000-0000-000000000101','proprietario'),
  ('44444444-4444-4444-4444-444444444444','dddddddd-0000-0000-0000-000000000102','proprietario');

INSERT INTO public.categorias_financeiras (id, condominio_id, nome, tipo) VALUES
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Multas e juros','receita');

-- Dívida da 101: duas cobranças em aberto, 300 + 150 = 450.
INSERT INTO public.cobrancas (id, condominio_id, unidade_id, competencia, vencimento, valor, descricao, status) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000101','2026-08-01','2026-08-10',300,'Taxa de agosto','vencida'),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000101','2026-09-01','2026-09-10',150,'Taxa de setembro','pendente');

-- A 102 teve cobrança e pagou-a: está limpa.
INSERT INTO public.cobrancas (id, condominio_id, unidade_id, competencia, vencimento, valor, valor_pago, descricao, status) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000102','2026-08-01','2026-08-10',300,300,'Taxa de agosto','paga');

-- A 103 não deve nada solto, mas tem acordo activo com parcela em aberto.
INSERT INTO public.acordos (id, condominio_id, unidade_id, numero, valor_total, num_parcelas, status)
VALUES ('a0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000103', 1, 600, 3, 'ativo');

SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

\echo
\echo '=========== 1. a dívida da 101 ==========='
\echo '--- esperado: principal 450, total 450, 2 itens'
SELECT (d->>'principal')::numeric AS principal,
       (d->>'total')::numeric     AS total,
       jsonb_array_length(d->'itens') AS itens
  FROM (SELECT public.divida_da_unidade('dddddddd-0000-0000-0000-000000000101') AS d) s;

\echo
\echo '=========== 2. carta de cobrança da 101 ==========='
\echo '--- esperado: total 450, prazo 10, 1 proprietário (Maria da Silva), cnpj preenchido'
SELECT (c->'divida'->>'total')::numeric     AS total,
       (c->>'prazo_dias')::int              AS prazo,
       c->'proprietarios'                   AS proprietarios,
       c->'condominio'->>'cnpj'             AS cnpj,
       (c->>'vence_em')::date - (c->>'emitida_em')::date AS dias_ate_vencer
  FROM (SELECT public.carta_cobranca('dddddddd-0000-0000-0000-000000000101', 10) AS c) s;

\echo '--- 2b. a carta ficou no audit_log (esperado: 1)'
SELECT count(*) FROM public.audit_log WHERE acao = 'carta_cobranca_gerada';

\echo
\echo '=========== 3. carta a quem não deve nada (esperado: sem_divida) ==========='
SELECT public.carta_cobranca('dddddddd-0000-0000-0000-000000000102');

\echo
\echo '=========== 4. prazo fora do intervalo (esperado: prazo_invalido) ==========='
SELECT public.carta_cobranca('dddddddd-0000-0000-0000-000000000101', 0);
SELECT public.carta_cobranca('dddddddd-0000-0000-0000-000000000101', 91);

\echo
\echo '=========== 5. nada consta para quem deve (esperado: unidade_com_debito) ==========='
SELECT public.emitir_nada_consta('dddddddd-0000-0000-0000-000000000101');

\echo
\echo '=========== 6. nada consta com acordo activo (esperado: unidade_com_acordo) ==========='
\echo '--- A parcela do acordo está PAGA de propósito. Se estivesse em aberto,'
\echo '--- a função parava antes, no unidade_com_debito: qualquer cobrança em'
\echo '--- aberto entra na dívida, parcela de acordo incluída. O aviso próprio do'
\echo '--- acordo só se alcança quando não há nada vencido e o acordo ainda corre.'
INSERT INTO public.cobrancas (id, condominio_id, unidade_id, acordo_id, parcela_num,
                              competencia, vencimento, valor, valor_pago, descricao, status)
VALUES ('bbbbbbbb-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000103','a0000000-0000-0000-0000-000000000001',1,
        '2026-10-01','2026-10-10',200,200,'Acordo 1/3','paga');
SELECT public.emitir_nada_consta('dddddddd-0000-0000-0000-000000000103');

\echo
\echo '=========== 7. nada consta para a 102, que está limpa ==========='
\echo '--- esperado: uma certidão, código NC-aaaa-0001-XXXXXXXX, válida 30 dias'
\echo '--- Emitir e consultar são dois passos: chamar a função dentro do WHERE'
\echo '--- fazia o SELECT ver a fotografia anterior ao INSERT, e não devolvia nada.'
SELECT public.emitir_nada_consta('dddddddd-0000-0000-0000-000000000102', 30) AS certidao_emitida \gset
SELECT c.numero,
       c.codigo ~ '^NC-[0-9]{4}-0001-[0-9A-F]{8}$' AS codigo_no_formato,
       c.valida_ate - (c.emitida_em AT TIME ZONE 'America/Sao_Paulo')::date AS dias_de_validade,
       -- `dados` guarda a data de referência, não o extracto: o que a certidão
       -- afirma é a ausência de dívida, e disso não há linhas para fotografar.
       (c.dados->>'referencia')::date AS referencia,
       c.dados->'proprietarios' AS proprietarios
  FROM public.certidoes c
 WHERE c.id = :'certidao_emitida';

\echo
\echo '=========== 8. validade fora do intervalo (esperado: validade_invalida) ==========='
SELECT public.emitir_nada_consta('dddddddd-0000-0000-0000-000000000102', 0);
SELECT public.emitir_nada_consta('dddddddd-0000-0000-0000-000000000102', 181);

\echo
\echo '=========== 9. conferir a certidão ==========='
\echo '--- 9a. o síndico confere (esperado: valida t, motivo vazio)'
SELECT (r->>'valida')::boolean AS valida, r->>'motivo' AS motivo, r->>'codigo' AS codigo
  FROM (SELECT public.conferir_certidao(
         (SELECT codigo FROM public.certidoes ORDER BY numero DESC LIMIT 1)) AS r) s;

\echo '--- 9b. código que não existe (esperado: valida f, codigo_nao_encontrado)'
SELECT (r->>'valida')::boolean AS valida, r->>'motivo' AS motivo
  FROM (SELECT public.conferir_certidao('NC-2026-9999-DEADBEEF') AS r) s;

\echo '--- 9c. certidão expirada (esperado: valida f, expirada)'
UPDATE public.certidoes SET valida_ate = CURRENT_DATE - 1
 WHERE id = (SELECT id FROM public.certidoes ORDER BY numero DESC LIMIT 1);
SELECT (r->>'valida')::boolean AS valida, r->>'motivo' AS motivo
  FROM (SELECT public.conferir_certidao(
         (SELECT codigo FROM public.certidoes ORDER BY numero DESC LIMIT 1)) AS r) s;

\echo
\echo '=========== 10. quem pode o quê ==========='
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
\echo '--- 10a. estranho pede a carta (esperado: forbidden)'
SELECT public.carta_cobranca('dddddddd-0000-0000-0000-000000000101');
\echo '--- 10b. estranho pede a dívida (esperado: forbidden)'
SELECT public.divida_da_unidade('dddddddd-0000-0000-0000-000000000101');

SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
\echo '--- 10c. o dono da 101 vê a sua própria dívida (esperado: 450)'
SELECT (public.divida_da_unidade('dddddddd-0000-0000-0000-000000000101')->>'total')::numeric;
\echo '--- 10d. o dono da 101 vê a dívida da 102 (esperado: forbidden)'
SELECT public.divida_da_unidade('dddddddd-0000-0000-0000-000000000102');
\echo '--- 10e. o dono da 101 emite nada consta (esperado: forbidden)'
SELECT public.emitir_nada_consta('dddddddd-0000-0000-0000-000000000101');

-- ===================================================================
-- INFRAÇÕES: ADVERTÊNCIAS E MULTAS
--
-- A 101 tem contribuição mensal de 400, por isso os tectos são:
--
--   art. 1.336 §2.º    5x   →  2.000
--   art. 1.337 caput   5x   →  2.000
--   art. 1.337 § único 10x  →  4.000
--   convenção          sem tecto no sistema (quem o fixa é a convenção)
--
-- A 104 não tem contribuição preenchida: é com ela que se verifica que o
-- sistema recusa em vez de adivinhar.
-- ===================================================================
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

\echo
\echo '=========== 11. os tectos legais da multa ==========='
\echo '--- 11a. 2.000 pelo art. 1.336 §2.º, exactamente no tecto (esperado: passa)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
  CURRENT_DATE - 2, 'Barulho depois das 22h no salão',
  'art_1336_p2', 2000, CURRENT_DATE + 15,
  NULL, 'cccccccc-0000-0000-0000-000000000001',
  'Deliberado por 2/3 na assembleia de 20/10/2026.') IS NOT NULL AS aplicada;

\echo '--- 11b. 2.000,01 pelo mesmo artigo (esperado: multa_acima_do_tecto)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
  CURRENT_DATE - 2, 'Barulho depois das 22h no salão',
  'art_1336_p2', 2000.01, CURRENT_DATE + 15);

\echo '--- 11c. 4.000 pelo art. 1.337 § único, o tecto de 10x (esperado: passa)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
  CURRENT_DATE - 1, 'Conduta antissocial reiterada no condomínio',
  'art_1337_unico', 4000, CURRENT_DATE + 15,
  NULL, 'cccccccc-0000-0000-0000-000000000001',
  'Deliberado por 3/4 na assembleia de 02/11/2026.') IS NOT NULL AS aplicada;

\echo '--- 11d. unidade sem contribuição mensal (esperado: taxa_mensal_em_falta)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000104',
  CURRENT_DATE - 1, 'Infração qualquer na unidade sem taxa',
  'art_1336_p2', 100, CURRENT_DATE + 15);

\echo '--- 11e. multa pela convenção: o tecto é o que ela fixar, e o sistema não o'
\echo '--- conhece. É também a única base que dispensa deliberação registada.'
\echo '--- (esperado: passa, mesmo com valor alto e sem taxa mensal na unidade)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000104',
  CURRENT_DATE - 1, 'Infração prevista só na convenção do condomínio',
  'convencao', 9999, CURRENT_DATE + 15) IS NOT NULL AS aplicada;

\echo '--- 11f. multa fora da convenção sem deliberação nem assembleia'
\echo '--- (esperado: recusada pela restrição multa_deliberada)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
  CURRENT_DATE - 1, 'Multa sem deliberação registada em lado nenhum',
  'art_1336_p2', 100, CURRENT_DATE + 15);

\echo
\echo '=========== 12. datas ==========='
\echo '--- 12a. ocorrência no futuro (esperado: data_invalida)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
  CURRENT_DATE + 1, 'Infração que ainda não aconteceu',
  'art_1336_p2', 100, CURRENT_DATE + 15);

\echo '--- 12b. vencimento no passado (esperado: vencimento_invalido)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
  CURRENT_DATE - 1, 'Infração com vencimento já passado',
  'art_1336_p2', 100, CURRENT_DATE - 1);

\echo
\echo '=========== 13. a multa virou cobrança ==========='
\echo '--- esperado: 2 cobranças de multa na 101, de 2.000 e 4.000, pendentes'
SELECT c.valor, c.status, c.descricao
  FROM public.cobrancas c
  JOIN public.infracoes i ON i.cobranca_id = c.id
 WHERE i.unidade_id = 'dddddddd-0000-0000-0000-000000000101'
 ORDER BY c.valor;

\echo
\echo '=========== 14. advertência ==========='
SELECT public.registrar_advertencia(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
  CURRENT_DATE - 5, 'Lixo deixado fora do horário na área comum') IS NOT NULL AS registada;
\echo '--- esperado: a advertência não tem valor, base legal nem cobrança'
SELECT tipo, valor IS NULL AS sem_valor, base_legal IS NULL AS sem_base,
       cobranca_id IS NULL AS sem_cobranca
  FROM public.infracoes WHERE tipo = 'advertencia';

\echo
\echo '=========== 15. reincidência (conta só as vigentes) ==========='
\echo '--- esperado: 1 advertência, 2 multas, total 3, valor_multas 6.000'
SELECT (r->>'advertencias')::int AS advertencias,
       (r->>'multas')::int       AS multas,
       (r->>'total')::int        AS total,
       (r->>'valor_multas')::numeric AS valor_multas
  FROM (SELECT public.reincidencia_da_unidade('dddddddd-0000-0000-0000-000000000101') AS r) s;

\echo
\echo '=========== 16. cancelar uma multa cancela a cobrança ==========='
\echo '--- 16a. motivo curto de mais (esperado: motivo_obrigatorio)'
SELECT public.cancelar_infracao(
  (SELECT id FROM public.infracoes WHERE valor = 2000), 'erro');

\echo '--- 16b. com motivo a sério (esperado: sem erro)'
SELECT public.cancelar_infracao(
  (SELECT id FROM public.infracoes WHERE valor = 2000),
  'A assembleia deu razão ao condómino na reunião de ontem.');

\echo '--- 16c. a cobrança da multa ficou cancelada (esperado: cancelada)'
SELECT c.valor, c.status
  FROM public.cobrancas c
  JOIN public.infracoes i ON i.cobranca_id = c.id
 WHERE i.valor = 2000;

\echo '--- 16d. a infração ficou cancelada, com motivo e data (esperado: cancelada, t, t)'
SELECT status, cancelamento_motivo IS NOT NULL AS tem_motivo,
       cancelada_em IS NOT NULL AS tem_data
  FROM public.infracoes WHERE valor = 2000;

\echo '--- 16e. cancelar outra vez (esperado: infracao_ja_cancelada)'
SELECT public.cancelar_infracao(
  (SELECT id FROM public.infracoes WHERE valor = 2000), 'Motivo suficientemente longo.');

\echo '--- 16f. a reincidência já não a conta (esperado: 1 advertência, 1 multa, total 2, 4.000)'
SELECT (r->>'advertencias')::int AS advertencias,
       (r->>'multas')::int       AS multas,
       (r->>'total')::int        AS total,
       (r->>'valor_multas')::numeric AS valor_multas
  FROM (SELECT public.reincidencia_da_unidade('dddddddd-0000-0000-0000-000000000101') AS r) s;

\echo
\echo '=========== 17. multa já paga não se cancela ==========='
UPDATE public.cobrancas SET valor_pago = 1000, status = 'parcial'
 WHERE id = (SELECT cobranca_id FROM public.infracoes WHERE valor = 4000);
\echo '--- esperado: multa_ja_paga, com o valor recebido no aviso'
SELECT public.cancelar_infracao(
  (SELECT id FROM public.infracoes WHERE valor = 4000),
  'O condómino contestou e a assembleia aceitou.');

\echo '--- 17b. e a infração continua vigente (esperado: vigente)'
SELECT status FROM public.infracoes WHERE valor = 4000;

\echo
\echo '=========== 18. quem pode o quê ==========='
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
\echo '--- 18a. o morador aplica multa (esperado: forbidden)'
SELECT public.aplicar_multa(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000102',
  CURRENT_DATE - 1, 'Multa aplicada por quem não é síndico',
  'art_1336_p2', 100, CURRENT_DATE + 15);

\echo '--- 18b. o morador regista advertência (esperado: forbidden)'
SELECT public.registrar_advertencia(
  'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000102',
  CURRENT_DATE - 1, 'Advertência registada por quem não é síndico');

\echo '--- 18c. o morador cancela uma infração (esperado: forbidden)'
SELECT public.cancelar_infracao(
  (SELECT id FROM public.infracoes WHERE valor = 4000), 'Motivo suficientemente longo.');

\echo '--- 18d. o morador vê a reincidência da sua unidade (esperado: total 2)'
SELECT (public.reincidencia_da_unidade('dddddddd-0000-0000-0000-000000000101')->>'total')::int;

\echo '--- 18e. o morador vê a reincidência da 102, que não é dele (esperado: forbidden)'
SELECT public.reincidencia_da_unidade('dddddddd-0000-0000-0000-000000000102');
