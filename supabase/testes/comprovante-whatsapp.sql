-- Comprovante de pagamento recebido pelo WhatsApp.
--
-- Ordem: 00-esqueleto, 01-esqueleto-financeiro, 02-esqueleto-contabil,
-- 04-esqueleto-whatsapp, 20261105230000_plano_de_contas,
-- 20261105240000_anexos_comprovacao, 20261106200000_comprovante_por_whatsapp,
-- este.
--
-- O QUE AQUI SE VERIFICA
--
-- A autorização, sobretudo. Esta é a única função do sistema que escreve a
-- partir de um número de telefone em vez de um utilizador autenticado: quem a
-- chama é o webhook da Meta, com a chave de serviço, e não há `auth.uid()`
-- nenhum para verificar. O vínculo número → unidade é tudo o que separa um
-- condómino a comprovar a sua cobrança de um condómino a mexer na do vizinho.
-- Nove dos quinze blocos são recusas, e é isso que interessa.
--
-- O que NÃO se verifica aqui: o download da mídia e a escrita no Storage, que
-- são do lado da aplicação e têm testes em `src/lib/comprovante.test.ts`.
\set ON_ERROR_STOP 0
\pset pager off
\pset format aligned

-- ================= cenário =================
--
-- Dois condomínios, para que o caso do condomínio trocado seja real e não
-- hipotético. No Teste: a 101 com duas cobranças em aberto e um número
-- vinculado; a 102 com uma cobrança e um número vinculado; a 103 com cobrança
-- mas o número sem vínculo.
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','sindico@t'),
  ('22222222-2222-2222-2222-222222222222','estranho@t');

-- O esqueleto reduz a `condominios` a id e nome: nada aqui depende do CNPJ.
INSERT INTO public.condominios (id, nome) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Residencial Teste'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Residencial Vizinho');

INSERT INTO public.user_roles (user_id, condominio_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','sindico'),
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000002','sindico');

INSERT INTO public.unidades (id, condominio_id, bloco, numero, fracao_ideal, taxa_mensal) VALUES
  ('dddddddd-0000-0000-0000-000000000101','aaaaaaaa-0000-0000-0000-000000000001','A','101',25,400),
  ('dddddddd-0000-0000-0000-000000000102','aaaaaaaa-0000-0000-0000-000000000001','A','102',25,400),
  ('dddddddd-0000-0000-0000-000000000103','aaaaaaaa-0000-0000-0000-000000000001','A','103',25,400),
  ('dddddddd-0000-0000-0000-000000000201','aaaaaaaa-0000-0000-0000-000000000002','B','201',50,500);

-- 61 + DDD + número, como a Meta entrega: só dígitos.
INSERT INTO public.wa_conversas (id, condominio_id, telefone, unidade_id) VALUES
  ('eeeeeeee-0000-0000-0000-000000000101','aaaaaaaa-0000-0000-0000-000000000001',
   '5561999990101','dddddddd-0000-0000-0000-000000000101'),
  ('eeeeeeee-0000-0000-0000-000000000102','aaaaaaaa-0000-0000-0000-000000000001',
   '5561999990102','dddddddd-0000-0000-0000-000000000102'),
  -- Conversa aberta, mas o síndico ainda não fez o vínculo à unidade.
  ('eeeeeeee-0000-0000-0000-000000000103','aaaaaaaa-0000-0000-0000-000000000001',
   '5561999990103',NULL),
  ('eeeeeeee-0000-0000-0000-000000000201','aaaaaaaa-0000-0000-0000-000000000002',
   '5561999990201','dddddddd-0000-0000-0000-000000000201');

INSERT INTO public.cobrancas (id, condominio_id, unidade_id, competencia, vencimento, valor, status) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000101','2026-08-01','2026-08-10',300,'vencida'),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000101','2026-09-01','2026-09-10',150,'pendente'),
  ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000102','2026-09-01','2026-09-10',400,'parcial'),
  ('bbbbbbbb-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000103','2026-09-01','2026-09-10',400,'pendente'),
  ('bbbbbbbb-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000101','2026-07-01','2026-07-10',300,'paga'),
  ('bbbbbbbb-0000-0000-0000-000000000006','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000101','2026-06-01','2026-06-10',300,'cancelada'),
  ('bbbbbbbb-0000-0000-0000-000000000201','aaaaaaaa-0000-0000-0000-000000000002',
   'dddddddd-0000-0000-0000-000000000201','2026-09-01','2026-09-10',500,'pendente');

UPDATE public.cobrancas SET valor_pago = 100
 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003';

\echo
\echo '=========== 1. o caso normal: a 101 comprova a cobrança de agosto ==========='
\echo '--- esperado: um uuid'
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  '5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/x.jpg',
  'comprovante-2026-08.jpg', 'image/jpeg', 182344
) IS NOT NULL AS registado;

\echo '--- 1b. o anexo ficou com tipo, nome e o telefone na observação'
SELECT entidade, tipo, nome_arquivo, mime_type, tamanho_bytes, observacao,
       enviado_por IS NULL AS sem_utilizador
  FROM public.anexos
 WHERE entidade_id = 'bbbbbbbb-0000-0000-0000-000000000001';

\echo '--- 1c. a cobrança foi marcada, e CONTINUA vencida: isto não dá baixa'
SELECT status, valor_pago, comprovante_recebido_em IS NOT NULL AS marcada
  FROM public.cobrancas WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';

\echo '--- 1d. ficou no audit_log, com o telefone e a competência'
SELECT acao, entidade, metadata->>'telefone' AS telefone,
       metadata->>'competencia' AS competencia, user_id IS NULL AS sem_utilizador
  FROM public.audit_log WHERE acao = 'comprovante_recebido_whatsapp';

\echo
\echo '=========== 2. o número do vizinho na cobrança da 101 (esperado: cobranca_de_outra_unidade) ==========='
\echo '--- É este o bloco que importa: sem auth.uid(), o vínculo é a única autorização.'
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  '5561999990102',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/y.jpg',
  'y.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 3. número com conversa mas sem unidade (esperado: numero_sem_unidade) ==========='
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000004',
  '5561999990103',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000004/z.jpg',
  'z.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 4. número que o condomínio não conhece (esperado: conversa_desconhecida) ==========='
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  '5561988887777',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/w.jpg',
  'w.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 5. o número do Vizinho numa cobrança do Teste (esperado: conversa_desconhecida) ==========='
\echo '--- A conversa existe, mas no OUTRO condomínio. O número não atravessa.'
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  '5561999990201',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/v.jpg',
  'v.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 6. condomínio que não é o da cobrança (esperado: cobranca_de_outro_condominio) ==========='
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000001',
  '5561999990201',
  'aaaaaaaa-0000-0000-0000-000000000002/cobranca/bbbbbbbb-0000-0000-0000-000000000001/u.jpg',
  'u.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 7. cobrança que não existe (esperado: cobranca_nao_encontrada) ==========='
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-00000000dead',
  '5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-00000000dead/t.jpg',
  't.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 8. cobrança já paga (esperado: cobranca_nao_comprovavel) ==========='
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000005',
  '5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000005/s.jpg',
  's.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 9. cobrança cancelada (esperado: cobranca_nao_comprovavel) ==========='
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000006',
  '5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000006/r.jpg',
  'r.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 10. caminho que não começa pelo condomínio (esperado: anexo_caminho_invalido) ==========='
\echo '--- É o caminho que decide quem lê no Storage. Se divergir do registo, as'
\echo '--- políticas do bucket decidem sobre um condomínio e a linha diz outro.'
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  '5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000002/cobranca/bbbbbbbb-0000-0000-0000-000000000002/q.jpg',
  'q.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 11. telefone vazio (esperado: telefone_invalido) ==========='
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  '   ',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000002/p.jpg',
  'p.jpg', 'image/jpeg', 1000
);

\echo
\echo '=========== 12. o telefone é normalizado: +55 (61) 99999-0101 é o mesmo número ==========='
\echo '--- esperado: registado t. A Meta manda só dígitos, mas um dia alguém'
\echo '--- chama isto com o número formatado, e recusar aí seria recusar o certo.'
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002',
  '+55 (61) 99999-0101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000002/o.jpg',
  'comprovante-2026-09.jpg', 'image/jpeg', 90000
) IS NOT NULL AS registado;

\echo
\echo '=========== 13. o tecto de cinco por cobrança ==========='
\echo '--- esperado: quatro passam (já havia um, dá cinco) e o sexto é recusado'
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/a2.jpg',
  'a2.jpg','image/jpeg',1000) IS NOT NULL AS n2;
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/a3.jpg',
  'a3.jpg','image/jpeg',1000) IS NOT NULL AS n3;
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/a4.jpg',
  'a4.jpg','image/jpeg',1000) IS NOT NULL AS n4;
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/a5.jpg',
  'a5.jpg','image/jpeg',1000) IS NOT NULL AS n5;
\echo '--- o sexto (esperado: comprovantes_demais)'
SELECT public.registrar_comprovante_whatsapp(
  'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','5561999990101',
  'aaaaaaaa-0000-0000-0000-000000000001/cobranca/bbbbbbbb-0000-0000-0000-000000000001/a6.jpg',
  'a6.jpg','image/jpeg',1000);

\echo
\echo '=========== 14. a lista de trabalho do síndico ==========='
\echo '--- esperado: 2 linhas, agosto primeiro.'
\echo '---'
\echo '--- Agosto recebeu o primeiro comprovante no bloco 1 e outros quatro no'
\echo '--- bloco 13; setembro recebeu o seu no bloco 12. Pela data do ÚLTIMO,'
\echo '--- agosto apareceria em segundo — o reenvio tê-lo-ia empurrado para trás'
\echo '--- da fila. A ordem é pela data do primeiro, e por isso agosto vem antes.'
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT unidade, competencia, status, em_aberto, comprovantes,
       primeiro_comprovante_em <= comprovante_recebido_em AS primeiro_antes_do_ultimo
  FROM public.comprovantes_a_conferir('aaaaaaaa-0000-0000-0000-000000000001');

\echo
\echo '--- 14b. a cobrança da 102 não entra: não tem comprovante nenhum'
SELECT count(*) AS com_comprovante
  FROM public.comprovantes_a_conferir('aaaaaaaa-0000-0000-0000-000000000001')
 WHERE unidade = 'A 102';

\echo
\echo '=========== 15. quem não gere o financeiro não vê a lista (esperado: forbidden) ==========='
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT * FROM public.comprovantes_a_conferir('aaaaaaaa-0000-0000-0000-000000000001');

\echo
\echo '--- 15b. sem sessão também não (esperado: not_authenticated)'
SET request.jwt.claims = '';
SELECT * FROM public.comprovantes_a_conferir('aaaaaaaa-0000-0000-0000-000000000001');
