-- Testes do plano de contas e dos anexos de comprovação.
--
-- Ordem: 00-esqueleto, 01-esqueleto-financeiro, 02-esqueleto-contabil,
-- 20261105230000_plano_de_contas, 20261105240000_anexos_comprovacao, este.
\set ON_ERROR_STOP 0
\pset pager off
\pset format aligned

-- ================= cenário =================
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','sindico@t'),
  ('22222222-2222-2222-2222-222222222222','estranho@t'),
  ('33333333-3333-3333-3333-333333333333','morador101@t'),
  ('44444444-4444-4444-4444-444444444444','morador102@t');

INSERT INTO public.condominios (id, nome) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Residencial A'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Residencial B');

INSERT INTO public.user_roles (user_id, condominio_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','sindico'),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','sindico'),
  ('33333333-3333-3333-3333-333333333333','aaaaaaaa-0000-0000-0000-000000000001','morador'),
  ('44444444-4444-4444-4444-444444444444','aaaaaaaa-0000-0000-0000-000000000001','morador');

INSERT INTO public.unidades (id, condominio_id, bloco, numero, fracao_ideal, taxa_mensal) VALUES
  ('dddddddd-0000-0000-0000-000000000101','aaaaaaaa-0000-0000-0000-000000000001','A','101',25,400),
  ('dddddddd-0000-0000-0000-000000000102','aaaaaaaa-0000-0000-0000-000000000001','A','102',25,400);

INSERT INTO public.unidade_moradores (user_id, unidade_id) VALUES
  ('33333333-3333-3333-3333-333333333333','dddddddd-0000-0000-0000-000000000101'),
  ('44444444-4444-4444-4444-444444444444','dddddddd-0000-0000-0000-000000000102');

-- As categorias planas que o sistema antigo criava.
INSERT INTO public.categorias_financeiras (id, condominio_id, nome, tipo, ordem) VALUES
 ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Energia','despesa',1),
 ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Água','despesa',2),
 ('cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','Limpeza','despesa',3),
 ('cccccccc-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001','Manutenção','despesa',4),
 ('cccccccc-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000001','Taxa condominial','receita',1),
 -- Caso de colisão: chama-se "Gás" (nome padrão de 2.2.03) mas é receita, e já
 -- tem movimento. Não pode ser adoptada nem apagada.
 ('cccccccc-0000-0000-0000-00000000000f','aaaaaaaa-0000-0000-0000-000000000001','Gás','receita',9);

-- Movimento de 2025, fora dos períodos que os relatórios olham.
INSERT INTO public.despesas (id, condominio_id, categoria_id, descricao, valor, data) VALUES
  ('eeeeeeee-0000-0000-0000-000000002025','aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000002','Água de 2025',90,'2025-06-10');

INSERT INTO public.cobrancas (id, condominio_id, unidade_id, categoria_id, competencia, vencimento, valor)
VALUES ('bbbbbbbb-0000-0000-0000-00000000000f','aaaaaaaa-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000101','cccccccc-0000-0000-0000-00000000000f',
        '2025-06-01','2025-06-10',50);

SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

\echo
\echo '=========== 1. semear o plano ==========='
SELECT public.semear_plano_contas('aaaaaaaa-0000-0000-0000-000000000001') AS resultado;

\echo '--- 1b. nenhuma conta com ponto no código ficou sem pai (esperado: 0)'
SELECT count(*) AS orfas
  FROM public.categorias_financeiras
 WHERE condominio_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   AND codigo LIKE '%.%' AND conta_pai_id IS NULL;

\echo '--- 1c. contagem por tipo e natureza'
SELECT tipo, sintetica, count(*)
  FROM public.categorias_financeiras
 WHERE condominio_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND codigo IS NOT NULL
 GROUP BY tipo, sintetica ORDER BY tipo, sintetica;

\echo
\echo '=========== 2. idempotência: correr outra vez não cria nada ==========='
SELECT public.semear_plano_contas('aaaaaaaa-0000-0000-0000-000000000001') AS segunda_vez;
\echo '--- esperado: criadas 0, adotadas 0, com_sufixo 0'

\echo
\echo '=========== 3. adopção: "Água" é a conta 2.2.02 e mantém o nome ==========='
\echo '--- esperado: id cccccccc-...002, codigo 2.2.02, nome Água, pai 2.2'
SELECT c.id, c.codigo, c.nome, p.codigo AS pai
  FROM public.categorias_financeiras c
  LEFT JOIN public.categorias_financeiras p ON p.id = c.conta_pai_id
 WHERE c.id = 'cccccccc-0000-0000-0000-000000000002';

\echo
\echo '=========== 4. a despesa de 2025 continua na mesma conta ==========='
\echo '--- esperado: 2.2.02'
SELECT cat.codigo FROM public.despesas d
  JOIN public.categorias_financeiras cat ON cat.id = d.categoria_id
 WHERE d.id = 'eeeeeeee-0000-0000-0000-000000002025';

\echo
\echo '=========== 5. colisão com movimento: "Gás" receita fica, nasce "Gás (2.2.03)" ==========='
\echo '--- esperado: duas linhas — Gás/receita/sem código, Gás (2.2.03)/despesa/2.2.03'
SELECT nome, tipo, codigo FROM public.categorias_financeiras
 WHERE condominio_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   AND nome LIKE 'Gás%' ORDER BY nome;

\echo
\echo '=========== 6. conta sintética recusa lançamento ==========='
\echo '--- 6a. despesa em "2 DESPESAS" (esperado: conta_sintetica_nao_aceita_lancamento)'
INSERT INTO public.despesas (condominio_id, categoria_id, descricao, valor, data)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001', id, 'Despesa no grupo', 10, '2026-03-01'
  FROM public.categorias_financeiras
 WHERE condominio_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND codigo = '2';

\echo '--- 6b. cobrança em "1 RECEITAS" (esperado: a mesma recusa)'
INSERT INTO public.cobrancas (condominio_id, unidade_id, categoria_id, competencia, vencimento, valor)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000101',
       id,'2026-03-01','2026-03-10',100
  FROM public.categorias_financeiras
 WHERE condominio_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND codigo = '1';

\echo '--- 6c. rubrica de orçamento no grupo (esperado: a mesma recusa)'
INSERT INTO public.orcamentos (id, condominio_id, exercicio)
VALUES ('f0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',2026);
INSERT INTO public.orcamento_itens (orcamento_id, condominio_id, categoria_id, valor_previsto)
SELECT 'f0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001', id, 1000
  FROM public.categorias_financeiras
 WHERE condominio_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND codigo = '2.2';

\echo '--- 6d. a mesma rubrica numa analítica passa (esperado: 1 linha inserida)'
INSERT INTO public.orcamento_itens (orcamento_id, condominio_id, categoria_id, valor_previsto)
SELECT 'f0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001', id, 1000
  FROM public.categorias_financeiras
 WHERE condominio_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND codigo = '2.2.02';

\echo
\echo '=========== 7. pai inválido ==========='
\echo '--- 7a. pai analítico (esperado: conta_pai_invalida)'
SELECT public.criar_conta(
  'aaaaaaaa-0000-0000-0000-000000000001','Sub da água','despesa','2.2.02.1',
  (SELECT id FROM public.categorias_financeiras
    WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000001' AND codigo='2.2.02'));

\echo '--- 7b. pai de outro tipo (esperado: conta_pai_invalida)'
SELECT public.criar_conta(
  'aaaaaaaa-0000-0000-0000-000000000001','Receita sob despesa','receita','2.2.98',
  (SELECT id FROM public.categorias_financeiras
    WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000001' AND codigo='2.2'));

\echo '--- 7c. pai de outro condomínio (esperado: conta_pai_invalida)'
SELECT public.semear_plano_contas('aaaaaaaa-0000-0000-0000-000000000002');
SELECT public.criar_conta(
  'aaaaaaaa-0000-0000-0000-000000000001','Pai alheio','despesa','2.2.97',
  (SELECT id FROM public.categorias_financeiras
    WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000002' AND codigo='2.2'));

\echo '--- 7d. ciclo: pôr "2" debaixo de "2.2" (esperado: conta_pai_invalida)'
UPDATE public.categorias_financeiras
   SET conta_pai_id = (SELECT id FROM public.categorias_financeiras
                        WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000001' AND codigo='2.2')
 WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000001' AND codigo='2';

\echo '--- 7e. código com formato inválido (esperado: categoria_codigo_formato)'
SELECT public.criar_conta('aaaaaaaa-0000-0000-0000-000000000001','Má','despesa','2.2.');

\echo
\echo '=========== 8. nível e ordenação ==========='
\echo '--- 8a. nível pelos pontos (esperado: 2 -> 1, 2.2 -> 2, 2.2.02 -> 3)'
SELECT codigo, nivel FROM public.plano_de_contas('aaaaaaaa-0000-0000-0000-000000000001')
 WHERE codigo IN ('2','2.2','2.2.02') ORDER BY codigo;

\echo '--- 8b. 2.10 vem depois de 2.9, não antes (ordenação por int[], não texto)'
SELECT public.criar_conta('aaaaaaaa-0000-0000-0000-000000000001','Grupo décimo','despesa','2.10',
  (SELECT id FROM public.categorias_financeiras
    WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000001' AND codigo='2'), true) IS NOT NULL AS criada;
SELECT codigo FROM public.plano_de_contas('aaaaaaaa-0000-0000-0000-000000000001')
 WHERE codigo IN ('2.9','2.9.01','2.10')
 ORDER BY (string_to_array(codigo,'.')::int[]);

\echo
\echo '=========== 9. manutenção das contas ==========='
\echo '--- 9a. tornar sintética uma conta com lançamentos (esperado: conta_em_uso)'
SELECT public.atualizar_conta('cccccccc-0000-0000-0000-000000000002', _sintetica => true);

\echo '--- 9b. desactivar um grupo com filhas activas (esperado: conta_com_filhas)'
SELECT public.desativar_conta(
  (SELECT id FROM public.categorias_financeiras
    WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000001' AND codigo='2.2'));

\echo '--- 9c. desactivar uma folha sem movimento passa (esperado: sem erro)'
SELECT public.desativar_conta(
  (SELECT id FROM public.categorias_financeiras
    WHERE condominio_id='aaaaaaaa-0000-0000-0000-000000000001' AND codigo='2.2.03'));
\echo '--- e deixa de aparecer no plano (esperado: 0 linhas)'
SELECT count(*) FROM public.plano_de_contas('aaaaaaaa-0000-0000-0000-000000000001')
 WHERE codigo = '2.2.03';

\echo
\echo '=========== 10. autorização ==========='
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
\echo '--- 10a. estranho a semear (esperado: forbidden)'
SELECT public.semear_plano_contas('aaaaaaaa-0000-0000-0000-000000000001');
\echo '--- 10b. estranho a ler o plano (esperado: forbidden)'
SELECT count(*) FROM public.plano_de_contas('aaaaaaaa-0000-0000-0000-000000000001');
\echo '--- 10c. morador lê o plano (esperado: contagem > 0)'
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
SELECT count(*) > 0 AS morador_le FROM public.plano_de_contas('aaaaaaaa-0000-0000-0000-000000000001');
\echo '--- 10d. morador a criar conta (esperado: forbidden)'
SELECT public.criar_conta('aaaaaaaa-0000-0000-0000-000000000001','Minha conta','despesa');

-- ===================================================================
-- Anexos de comprovação
--
-- Cenário do período 2026-03, com os números conferidos à mão:
--
--   despesa Água    2.2.02   100   nota + comprovante   completa
--   despesa Energia 2.2.01   300   só nota              falta comprovante
--   despesa Manut.  2.3.09    50   nada                 falta tudo
--   receita Taxa    1.1.01   400   comprovante          completa
--
--   grupo 2.2  = 400 (2 lançamentos, 2 documentados)
--   grupo 2.3  =  50 (1, 0)
--   grupo 2    = 450 (3, 2)
--   grupo 1.1  = 400 (1, 1)
-- ===================================================================
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

INSERT INTO public.despesas (id, condominio_id, categoria_id, fornecedor, descricao, valor, data)
VALUES
  ('eeeeeeee-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000002','Caesb','Água de março',100,'2026-03-05'),
  ('eeeeeeee-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001','CEB','Energia de março',300,'2026-03-10'),
  ('eeeeeeee-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000004','Zelador','Conserto do portão',50,'2026-03-20');

INSERT INTO public.cobrancas (id, condominio_id, unidade_id, categoria_id, competencia, vencimento, valor, valor_pago, status)
VALUES ('bbbbbbbb-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000101','cccccccc-0000-0000-0000-000000000009',
        '2026-03-01','2026-03-10',400,400,'paga');

INSERT INTO public.pagamentos (id, condominio_id, cobranca_id, valor, forma, pago_em)
VALUES ('f1000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-00000000000a',400,'pix','2026-03-15 12:00:00-03');

\echo
\echo '=========== 11. validações do anexo ==========='
\echo '--- 11a. caminho que não começa pelo condomínio (esperado: anexo_caminho_invalido)'
SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000000a',
  'nota_fiscal','outro-sitio/nf.pdf','nf.pdf');

\echo '--- 11b. lançamento inexistente (esperado: anexo_lancamento_nao_encontrado)'
SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000ffff',
  'nota_fiscal','aaaaaaaa-0000-0000-0000-000000000001/despesa/x/nf.pdf','nf.pdf');

\echo '--- 11c. lançamento de outro condomínio (esperado: anexo_de_outro_condominio)'
SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000002','despesa','eeeeeeee-0000-0000-0000-00000000000a',
  'nota_fiscal','aaaaaaaa-0000-0000-0000-000000000002/despesa/a/nf.pdf','nf.pdf');

\echo
\echo '=========== 12. anexar os documentos do cenário ==========='
SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000000a',
  'nota_fiscal','aaaaaaaa-0000-0000-0000-000000000001/despesa/eeeeeeee-0000-0000-0000-00000000000a/nf-agua.pdf',
  'nf-agua.pdf','application/pdf',12345,'NF-2026/0312','2026-03-05',100) IS NOT NULL AS nf_agua;

SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000000a',
  'comprovante_pagamento','aaaaaaaa-0000-0000-0000-000000000001/despesa/eeeeeeee-0000-0000-0000-00000000000a/pix-agua.pdf',
  'pix-agua.pdf','application/pdf',8000,NULL,'2026-03-06',100) IS NOT NULL AS comp_agua;

SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000000b',
  'nota_fiscal','aaaaaaaa-0000-0000-0000-000000000001/despesa/eeeeeeee-0000-0000-0000-00000000000b/fatura-ceb.pdf',
  'fatura-ceb.pdf','application/pdf',9000,'CEB-99887','2026-03-10',300) IS NOT NULL AS nf_energia;

SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','pagamento','f1000000-0000-0000-0000-00000000000a',
  'comprovante_pagamento','aaaaaaaa-0000-0000-0000-000000000001/pagamento/f1000000-0000-0000-0000-00000000000a/pix-101.pdf',
  'pix-101.pdf','application/pdf',7000,NULL,'2026-03-15',400) IS NOT NULL AS comp_taxa;

\echo '--- 12b. o mesmo caminho outra vez (esperado: anexo_caminho_unico)'
SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000000c',
  'nota_fiscal','aaaaaaaa-0000-0000-0000-000000000001/despesa/eeeeeeee-0000-0000-0000-00000000000a/nf-agua.pdf',
  'nf-agua.pdf');

\echo
\echo '=========== 13. pendências documentais de 2026-03 ==========='
\echo '--- esperado: 2 linhas — Energia (fiscal t, comprovante f) e portão (f, f)'
SELECT conta_codigo, descricao, valor, tem_fiscal, tem_comprovante
  FROM public.pendencias_documentais('aaaaaaaa-0000-0000-0000-000000000001','2026-03-01','2026-03-31');

\echo
\echo '=========== 14. prestação de contas por conta ==========='
\echo '--- esperado: 1=400/1/1, 1.1=400/1/1, 1.1.01=400/1/1,'
\echo '---           2=450/3/2, 2.2=400/2/2, 2.2.01=300/1/1, 2.2.02=100/1/1,'
\echo '---           2.3=50/1/0, 2.3.09=50/1/0'
SELECT codigo, nome, nivel, sintetica, valor, lancamentos, documentados
  FROM public.prestacao_por_conta('aaaaaaaa-0000-0000-0000-000000000001','2026-03-01','2026-03-31')
 WHERE lancamentos > 0
 ORDER BY tipo, (string_to_array(codigo,'.')::int[]) NULLS LAST;

\echo
\echo '=========== 15. apagar o lançamento leva os anexos ==========='
\echo '--- antes (esperado: 2)'
SELECT count(*) FROM public.anexos WHERE entidade='despesa' AND entidade_id='eeeeeeee-0000-0000-0000-00000000000a';
DELETE FROM public.despesas WHERE id='eeeeeeee-0000-0000-0000-00000000000a';
\echo '--- depois (esperado: 0)'
SELECT count(*) FROM public.anexos WHERE entidade='despesa' AND entidade_id='eeeeeeee-0000-0000-0000-00000000000a';

\echo
\echo '=========== 16. quem vê os anexos ==========='
SELECT public.registrar_anexo(
  'aaaaaaaa-0000-0000-0000-000000000001','cobranca','bbbbbbbb-0000-0000-0000-00000000000a',
  'boleto','aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-00000000000a/boleto.pdf',
  'boleto.pdf') IS NOT NULL AS boleto;

\echo '--- 16a. o morador da 101 vê o boleto da sua cobrança (esperado: 1)'
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
SELECT count(*) FROM public.listar_anexos(
  'aaaaaaaa-0000-0000-0000-000000000001','cobranca','bbbbbbbb-0000-0000-0000-00000000000a');

\echo '--- 16b. o morador da 102 não (esperado: forbidden)'
SET request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';
SELECT count(*) FROM public.listar_anexos(
  'aaaaaaaa-0000-0000-0000-000000000001','cobranca','bbbbbbbb-0000-0000-0000-00000000000a');

\echo '--- 16c. o morador não vê anexos de despesa (esperado: forbidden)'
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
SELECT count(*) FROM public.listar_anexos(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000000b');

\echo '--- 16d. o morador não vê as pendências documentais (esperado: forbidden)'
SELECT count(*) FROM public.pendencias_documentais('aaaaaaaa-0000-0000-0000-000000000001','2026-03-01','2026-03-31');

\echo '--- 16e. o síndico vê os anexos da despesa (esperado: 1)'
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT count(*) FROM public.listar_anexos(
  'aaaaaaaa-0000-0000-0000-000000000001','despesa','eeeeeeee-0000-0000-0000-00000000000b');

\echo
\echo '=========== 17. período inválido (esperado: periodo_invalido) ==========='
SELECT count(*) FROM public.prestacao_por_conta('aaaaaaaa-0000-0000-0000-000000000001','2026-03-31','2026-03-01');
