\set ON_ERROR_STOP 0
\pset pager off

INSERT INTO auth.users (id,email) VALUES ('44444444-4444-4444-4444-444444444444','s@t');
INSERT INTO public.condominios (id,nome) VALUES ('dddddddd-0000-0000-0000-000000000001','Fluxo');
INSERT INTO public.user_roles VALUES ('44444444-4444-4444-4444-444444444444','dddddddd-0000-0000-0000-000000000001','sindico');
INSERT INTO public.unidades (condominio_id,bloco,numero,fracao_ideal,taxa_mensal)
VALUES ('dddddddd-0000-0000-0000-000000000001','A','101',100,1000);

-- Saldo inicial de 5.000 a contar de 01/01/2026
INSERT INTO public.config_pagamento (condominio_id, saldo_inicial, saldo_inicial_data)
VALUES ('dddddddd-0000-0000-0000-000000000001', 5000, '2026-01-01');

-- Movimento: recebe 1.000 no dia 10 de cada mês; paga 800 no dia 5 e 300 no dia 20
INSERT INTO public.pagamentos (condominio_id, valor, pago_em)
SELECT 'dddddddd-0000-0000-0000-000000000001', 1000,
       (make_date(2026,m,10) + time '09:00') AT TIME ZONE 'America/Sao_Paulo'
  FROM generate_series(1,3) m;
INSERT INTO public.despesas (condominio_id, descricao, valor, data)
SELECT 'dddddddd-0000-0000-0000-000000000001','Folha',800,make_date(2026,m,5) FROM generate_series(1,3) m;
INSERT INTO public.despesas (condominio_id, descricao, valor, data)
SELECT 'dddddddd-0000-0000-0000-000000000001','Água',300,make_date(2026,m,20) FROM generate_series(1,3) m;

SELECT set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',false);

\echo '=== 1. saldo de abertura de Março: 5000 + 2000 recebidos - 2200 pagos (Jan e Fev) = 4800 ==='
SELECT public._saldo_ate('dddddddd-0000-0000-0000-000000000001','2026-02-28') AS abertura_marco;

\echo '=== 2. tem de ser EXACTAMENTE o saldo_anterior do balancete de Março ==='
SELECT (public.calcular_balancete('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31')->>'saldo_anterior')::numeric AS pelo_balancete,
       public._saldo_ate('dddddddd-0000-0000-0000-000000000001','2026-02-28') AS pelo_fluxo,
       (public.calcular_balancete('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31')->>'saldo_anterior')::numeric
         = public._saldo_ate('dddddddd-0000-0000-0000-000000000001','2026-02-28') AS batem;

\echo '=== 3. fluxo de Março: abertura 4800, dia 5 paga 800 (4000), dia 10 recebe 1000 (5000), dia 20 paga 300 (4700) ==='
SELECT jsonb_pretty(public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31') - 'dias');

\echo '=== 4. os dias em que houve movimento, e o saldo corrido ==='
SELECT x->>'data' AS dia, x->>'entradas' AS entrou, x->>'saidas' AS saiu, x->>'saldo' AS saldo
  FROM jsonb_array_elements(public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31')->'dias') x
 WHERE (x->>'entradas')::numeric > 0 OR (x->>'saidas')::numeric > 0;

\echo '=== 5. todos os 31 dias estão lá, mesmo os parados ==='
SELECT jsonb_array_length(public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31')->'dias') AS dias;

\echo '=== 6. o saldo mínimo é o do dia 5, 4000 ==='
SELECT public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31')->>'saldo_minimo' AS minimo,
       public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31')->>'saldo_minimo_em' AS em;

\echo '=== 7. concentração no trimestre: 2400 no dia 5 (72,73%) e 900 no dia 20 (27,27%) ==='
SELECT x->>'dia' AS dia, x->>'despesas' AS despesas, x->>'percentagem' AS pct, x->>'recebimentos' AS recebido
  FROM jsonb_array_elements(
    public.concentracao_pagamentos('dddddddd-0000-0000-0000-000000000001','2026-01-01','2026-03-31')->'por_dia_do_mes') x
 WHERE (x->>'despesas')::numeric > 0 OR (x->>'recebimentos')::numeric > 0;

\echo '=== 8. os 31 dias aparecem todos, e as percentagens somam 100 ==='
SELECT jsonb_array_length(public.concentracao_pagamentos('dddddddd-0000-0000-0000-000000000001','2026-01-01','2026-03-31')->'por_dia_do_mes') AS dias,
       (SELECT sum((x->>'percentagem')::numeric)
          FROM jsonb_array_elements(public.concentracao_pagamentos('dddddddd-0000-0000-0000-000000000001','2026-01-01','2026-03-31')->'por_dia_do_mes') x) AS soma_pct;

\echo '=== 9. período invertido (espera periodo_invalido) ==='
SELECT public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2026-03-31','2026-03-01');

\echo '=== 10. mais de 400 dias (espera recusa com explicação) ==='
SELECT public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2024-01-01','2026-12-31');

\echo '=== 11. sem permissão no condomínio (espera forbidden) ==='
INSERT INTO auth.users (id,email) VALUES ('55555555-5555-5555-5555-555555555555','x@t');
SELECT set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}',false);
SELECT public.fluxo_de_caixa('dddddddd-0000-0000-0000-000000000001','2026-03-01','2026-03-31');

\echo '=== 12. sem sessão (espera not_authenticated) ==='
SELECT set_config('request.jwt.claims','',false);
SELECT public.concentracao_pagamentos('dddddddd-0000-0000-0000-000000000001','2026-01-01','2026-03-31');
