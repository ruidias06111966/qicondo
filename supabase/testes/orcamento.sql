\set ON_ERROR_STOP 0
\pset pager off
\pset format aligned

-- ---------- cenário ----------
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','sindico@t'),
  ('22222222-2222-2222-2222-222222222222','estranho@t');

INSERT INTO public.condominios (id, nome) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Teste');

INSERT INTO public.user_roles (user_id, condominio_id, role)
VALUES ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','sindico');

INSERT INTO public.unidades (condominio_id, bloco, numero, fracao_ideal, taxa_mensal)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001','A', n::text, 25, 400
  FROM generate_series(101,104) n;

INSERT INTO public.categorias_financeiras (id, condominio_id, nome, tipo, ordem) VALUES
 ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Energia','despesa',1),
 ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Água','despesa',2),
 ('cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','Limpeza','despesa',3),
 ('cccccccc-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001','Manutenção','despesa',4),
 ('cccccccc-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000001','Taxa condominial','receita',1);

-- Realizado de 2025: 12.000 + 6.000 + 18.000 + 4.000 = 40.000
INSERT INTO public.despesas (condominio_id, categoria_id, descricao, valor, data)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Energia',1000,make_date(2025,m,10) FROM generate_series(1,12) m;
INSERT INTO public.despesas (condominio_id, categoria_id, descricao, valor, data)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002','Água',500,make_date(2025,m,10) FROM generate_series(1,12) m;
INSERT INTO public.despesas (condominio_id, categoria_id, descricao, valor, data)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','Limpeza',1500,make_date(2025,m,10) FROM generate_series(1,12) m;
INSERT INTO public.despesas (condominio_id, categoria_id, descricao, valor, data)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000004','Portão',4000,'2025-07-15');
-- Uma despesa sem categoria, para ver se aparece no relatório
INSERT INTO public.despesas (condominio_id, categoria_id, descricao, valor, data)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001',NULL,'Avulsa',900,'2025-09-01');

SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',false);

\echo '=== 1. realizado do ano base (espera total 40000, sem_categoria 900) ==='
SELECT jsonb_pretty(public.realizado_por_categoria('aaaaaaaa-0000-0000-0000-000000000001',2025)
       - 'categorias');

\echo '=== 2. ano base >= ano (espera recusa) ==='
SELECT public.criar_orcamento('aaaaaaaa-0000-0000-0000-000000000001',2026,2026);

\echo '=== 3. criar orçamento 2026 base 2025, inadimplência 8%, fundo 10% ==='
SELECT public.criar_orcamento('aaaaaaaa-0000-0000-0000-000000000001',2026,2025,8,10,'Teste') AS orcamento_id \gset
SELECT :'orcamento_id' AS criado;

\echo '=== 4. rubricas semeadas com o realizado ==='
SELECT c.nome, i.realizado_base, i.valor_previsto, i.indice, i.percentual
  FROM public.orcamento_itens i JOIN public.categorias_financeiras c ON c.id=i.categoria_id
 WHERE i.orcamento_id = :'orcamento_id' ORDER BY i.ordem;

\echo '=== 5. ano repetido (espera violação de unicidade) ==='
SELECT public.criar_orcamento('aaaaaaaa-0000-0000-0000-000000000001',2026,2025);

\echo '=== 6. projectar: energia +9,2% tarifa, água +5% tarifa, limpeza +6% CCT, manutenção valor próprio 10000 ==='
SELECT c.nome, public.atualizar_item_orcamento(i.id,
         CASE c.nome WHEN 'Limpeza' THEN 'cct' WHEN 'Manutenção' THEN 'manual' ELSE 'tarifa' END::public.indice_reajuste,
         CASE c.nome WHEN 'Energia' THEN 9.2 WHEN 'Água' THEN 5 WHEN 'Limpeza' THEN 6 ELSE 0 END,
         CASE c.nome WHEN 'Manutenção' THEN 10000 ELSE NULL END,
         CASE c.nome WHEN 'Manutenção' THEN 'Pintura da fachada, orçamento já recebido' ELSE NULL END) AS previsto
  FROM public.orcamento_itens i JOIN public.categorias_financeiras c ON c.id=i.categoria_id
 WHERE i.orcamento_id = :'orcamento_id' ORDER BY i.ordem;

\echo '=== 7. resumo (à mão: despesa 48484, fundo 4848.40, necessidade 53332.40, arrecadar 57970.00, mensal 4830.83) ==='
SELECT jsonb_pretty(public.resumo_orcamento(:'orcamento_id'));

\echo '=== 8. quotas por unidade (25% de 4830.83 = 1207.71, soma tem de dar 4830.83) ==='
SELECT bloco, numero, fracao_ideal, taxa_actual, quota_mensal
  FROM public.quotas_do_orcamento(:'orcamento_id');
SELECT sum(quota_mensal) AS soma_das_quotas FROM public.quotas_do_orcamento(:'orcamento_id');

\echo '=== 9. aprovar com assembleia em rascunho (espera recusa) ==='
INSERT INTO public.assembleias (id, condominio_id, titulo, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','AGO 2026','rascunho');
SELECT public.aprovar_orcamento(:'orcamento_id','bbbbbbbb-0000-0000-0000-000000000001');

\echo '=== 10. assembleia de outro condomínio (espera recusa) ==='
INSERT INTO public.condominios (id,nome) VALUES ('aaaaaaaa-0000-0000-0000-000000000002','Outro');
INSERT INTO public.assembleias (id, condominio_id, titulo, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002','AGO alheia','encerrada');
SELECT public.aprovar_orcamento(:'orcamento_id','bbbbbbbb-0000-0000-0000-000000000002');

\echo '=== 11. aprovar a sério ==='
UPDATE public.assembleias SET status='encerrada' WHERE id='bbbbbbbb-0000-0000-0000-000000000001';
SELECT public.aprovar_orcamento(:'orcamento_id','bbbbbbbb-0000-0000-0000-000000000001');
SELECT status, aprovado_em IS NOT NULL AS tem_data, assembleia_id FROM public.orcamentos WHERE id=:'orcamento_id';

\echo '=== 12. editar depois de aprovado (espera recusa) ==='
SELECT public.atualizar_item_orcamento(
  (SELECT id FROM public.orcamento_itens WHERE orcamento_id=:'orcamento_id' LIMIT 1),
  'ipca', 10);
SELECT public.atualizar_orcamento(:'orcamento_id', 5, NULL, NULL);

\echo '=== 13. aprovar duas vezes (espera recusa) ==='
SELECT public.aprovar_orcamento(:'orcamento_id','bbbbbbbb-0000-0000-0000-000000000001');

\echo '=== 14. orçado x realizado até Março de 2026 ==='
INSERT INTO public.despesas (condominio_id, categoria_id, descricao, valor, data) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Energia jan',1200,'2026-01-10'),
 ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Energia fev',1250,'2026-02-10'),
 ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Energia mar',1300,'2026-03-10'),
 ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','Limpeza tri',4500,'2026-03-20'),
 ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','Energia abr',1400,'2026-04-10');
SELECT jsonb_pretty(public.orcado_x_realizado(:'orcamento_id', 3) - 'rubricas');
SELECT r->>'nome' AS rubrica, r->>'previsto_ate_mes' AS previsto, r->>'realizado' AS realizado, r->>'desvio' AS desvio
  FROM jsonb_array_elements(public.orcado_x_realizado(:'orcamento_id',3)->'rubricas') r;

\echo '=== 15. utilizador sem papel no condomínio (espera forbidden) ==='
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',false);
SELECT public.resumo_orcamento(:'orcamento_id');

\echo '=== 16. sem sessão (espera not_authenticated) ==='
SELECT set_config('request.jwt.claims','',false);
SELECT public.resumo_orcamento(:'orcamento_id');
