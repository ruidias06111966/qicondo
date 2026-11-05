-- Índices económicos: dez casos, com números que não dependem da rede.
--
-- A verificação contra os dados reais do Banco Central está no README, com o
-- que deu no dia em que foi corrida. Aqui os valores são inventados de
-- propósito, para o teste dar sempre o mesmo e a conta poder ser conferida de
-- cabeça.

\set ON_ERROR_STOP 0
\pset pager off

INSERT INTO auth.users (id, email) VALUES
  ('33333333-3333-3333-3333-333333333333','quem@t')
ON CONFLICT DO NOTHING;

SELECT set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);

\echo '=== 1. doze meses de 0,50% ==='
\echo '    somado daria 6,00; composto dá (1,005^12 - 1) x 100 = 6,17'
SELECT public.registrar_indices((
  SELECT jsonb_agg(jsonb_build_object(
           'indice','ipca',
           'competencia', make_date(2026, m, 1),
           'variacao', 0.50))
    FROM generate_series(1,12) m)) AS gravadas;

SELECT public.acumulado_12m('ipca','2026-12-31')->>'acumulado' AS acumulado,
       public.acumulado_12m('ipca','2026-12-31')->>'completo' AS completo;

\echo '=== 2. gravar os mesmos números outra vez (espera 0) ==='
SELECT public.registrar_indices((
  SELECT jsonb_agg(jsonb_build_object(
           'indice','ipca','competencia', make_date(2026, m, 1),'variacao', 0.50))
    FROM generate_series(1,12) m)) AS regravadas;

\echo '=== 3. revisão de um mês (espera 1 linha mexida, e o acumulado a mudar) ==='
SELECT public.registrar_indices(
  '[{"indice":"ipca","competencia":"2026-06-01","variacao":1.50}]'::jsonb) AS revistas;
SELECT public.acumulado_12m('ipca','2026-12-31')->>'acumulado' AS acumulado_apos_revisao;

\echo '=== 4. a janela anda com a data: doze meses até Junho ==='
\echo '    Jan a Jun a 0,50 excepto Junho a 1,50 — faltam meses, por isso 6 e incompleto'
SELECT public.acumulado_12m('ipca','2026-06-30')->>'meses' AS meses,
       public.acumulado_12m('ipca','2026-06-30')->>'completo' AS completo,
       public.acumulado_12m('ipca','2026-06-30')->>'ultima' AS ultima;

\echo '=== 5. mais de doze meses gravados: conta só os doze últimos ==='
SELECT public.registrar_indices((
  SELECT jsonb_agg(jsonb_build_object(
           'indice','ipca','competencia', make_date(2025, m, 1),'variacao', 9.99))
    FROM generate_series(1,12) m)) AS gravadas_2025;
\echo '    o acumulado até Dez/2026 não pode ter mudado: 2025 fica fora da janela'
SELECT public.acumulado_12m('ipca','2026-12-31')->>'acumulado' AS acumulado,
       public.acumulado_12m('ipca','2026-12-31')->>'primeira' AS primeira;

\echo '=== 6. deflação: um mês negativo baixa o acumulado ==='
SELECT public.registrar_indices(
  '[{"indice":"inpc","competencia":"2026-01-01","variacao":1.00},
    {"indice":"inpc","competencia":"2026-02-01","variacao":-0.50}]'::jsonb) AS gravadas;
\echo '    1,01 x 0,995 - 1 = 0,495% -> 0,50'
SELECT public.acumulado_12m('inpc','2026-02-28')->>'acumulado' AS acumulado;

\echo '=== 7. índice que não se publica (espera indice_nao_publicado) ==='
SELECT public.registrar_indices(
  '[{"indice":"cct","competencia":"2026-01-01","variacao":6}]'::jsonb);

\echo '=== 8. competência a meio do mês passa a dia 1 ==='
SELECT public.registrar_indices(
  '[{"indice":"igpm","competencia":"2026-05-17","variacao":0.80}]'::jsonb) AS gravadas;
SELECT competencia FROM public.indices_economicos WHERE indice = 'igpm';

\echo '=== 9. o que não é lista é recusado ==='
SELECT public.registrar_indices('{"indice":"ipca"}'::jsonb);

\echo '=== 10. sem sessão (espera not_authenticated) ==='
SELECT set_config('request.jwt.claims','',false);
SELECT public.indices_para_orcamento();
