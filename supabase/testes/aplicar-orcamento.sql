\set ON_ERROR_STOP 0
\pset pager off

INSERT INTO auth.users (id,email) VALUES ('66666666-6666-6666-6666-666666666666','s@t');
INSERT INTO public.condominios (id,nome) VALUES ('eeeeeeee-0000-0000-0000-000000000001','Aplicar');
INSERT INTO public.user_roles VALUES ('66666666-6666-6666-6666-666666666666','eeeeeeee-0000-0000-0000-000000000001','sindico');
INSERT INTO public.unidades (condominio_id,bloco,numero,fracao_ideal,taxa_mensal)
SELECT 'eeeeeeee-0000-0000-0000-000000000001','A',n::text,25,400 FROM generate_series(101,104) n;
INSERT INTO public.categorias_financeiras (id,condominio_id,nome,tipo) VALUES
 ('ffffffff-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001','Taxa condominial','receita'),
 ('ffffffff-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000001','Energia','despesa');
INSERT INTO public.despesas (condominio_id,categoria_id,descricao,valor,data)
SELECT 'eeeeeeee-0000-0000-0000-000000000001','ffffffff-0000-0000-0000-000000000002','Energia',4000,make_date(2025,m,10) FROM generate_series(1,12) m;

SELECT set_config('request.jwt.claims','{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}',false);

SELECT public.criar_orcamento('eeeeeeee-0000-0000-0000-000000000001',2026,2025,0,0) AS o \gset

\echo '=== 1. aplicar um orçamento ainda em rascunho (espera recusa) ==='
SELECT public.aplicar_orcamento(:'o','ffffffff-0000-0000-0000-000000000001',10);

\echo '=== 2. aprovar ==='
INSERT INTO public.assembleias (id,condominio_id,titulo,status)
VALUES ('aaaa1111-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001','AGO','encerrada');
SELECT public.aprovar_orcamento(:'o','aaaa1111-0000-0000-0000-000000000001');
\echo '    despesa prevista 48000, sem fundo nem inadimplência -> 4000/mês -> 1000 por unidade'
SELECT public.resumo_orcamento(:'o')->>'arrecadacao_mensal' AS mensal;

\echo '=== 3. categoria de despesa (espera recusa com explicação) ==='
SELECT public.aplicar_orcamento(:'o','ffffffff-0000-0000-0000-000000000002',10);

\echo '=== 4. dia 45 (espera recusa) ==='
SELECT public.aplicar_orcamento(:'o','ffffffff-0000-0000-0000-000000000001',45);

\echo '=== 5. aplicar a sério, vencimento no dia 31 ==='
SELECT jsonb_pretty(public.aplicar_orcamento(:'o','ffffffff-0000-0000-0000-000000000001',31));

\echo '=== 6. a taxa das unidades passou de 400 para 1000 ==='
SELECT numero, taxa_mensal FROM public.unidades
 WHERE condominio_id='eeeeeeee-0000-0000-0000-000000000001' ORDER BY numero;

\echo '=== 7. o dia 31 cai no último dia de cada mês ==='
SELECT to_char(competencia,'MM') AS mes, min(vencimento) AS vencimento, count(*) AS cobrancas
  FROM public.cobrancas WHERE condominio_id='eeeeeeee-0000-0000-0000-000000000001'
 GROUP BY 1 ORDER BY 1 LIMIT 4;

\echo '=== 8. doze meses x quatro unidades = 48 cobranças, todas de 1000 ==='
SELECT count(*) AS cobrancas, sum(valor) AS total, min(valor) AS menor, max(valor) AS maior
  FROM public.cobrancas WHERE condominio_id='eeeeeeee-0000-0000-0000-000000000001';

\echo '=== 9. aplicar outra vez não duplica ==='
SELECT public.aplicar_orcamento(:'o','ffffffff-0000-0000-0000-000000000001',31)->>'cobrancas_geradas' AS geradas_na_segunda;
SELECT count(*) AS cobrancas_no_total FROM public.cobrancas WHERE condominio_id='eeeeeeee-0000-0000-0000-000000000001';

\echo '=== 10. as taxas anteriores ficaram no registo, para se poder voltar atrás ==='
SELECT jsonb_array_length(metadata->'taxas_anteriores') AS unidades_registadas,
       metadata->'taxas_anteriores'->0->>'taxa_mensal' AS taxa_da_primeira
  FROM public.audit_log
 WHERE acao='orcamento_aplicado' ORDER BY created_at LIMIT 1;

\echo '=== 11. o orçamento ficou marcado como aplicado ==='
SELECT aplicado_em IS NOT NULL AS aplicado FROM public.orcamentos WHERE id=:'o';

\echo '=== 12. quem não é síndico não aplica ==='
INSERT INTO auth.users (id,email) VALUES ('77777777-7777-7777-7777-777777777777','x@t');
SELECT set_config('request.jwt.claims','{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}',false);
SELECT public.aplicar_orcamento(:'o','ffffffff-0000-0000-0000-000000000001',10);
