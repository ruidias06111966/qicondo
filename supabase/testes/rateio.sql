-- Rateio por fração ideal: o desempate do centavo que sobra.
--
-- Ordem: 00-esqueleto, 20261105160000, 20261104150000,
-- 20261106210000_rateio_desempata_por_unidade, este.
--
-- O QUE AQUI SE VERIFICA
--
-- A divisão é em centavos pelo método do maior resto. Quando as frações são
-- iguais — plantas repetidas, que é o caso normal — os restos empatam todos e
-- alguém tem de ficar com o centavo a mais. O desempate era pelo `id`, isto é,
-- por um uuid aleatório: determinístico, mas não explicável numa assembleia.
--
-- Os números são escolhidos para a conta se conferir de cabeça, e as unidades
-- para a ordem natural ser testada a sério: há uma 9 e uma 10, que em texto
-- saem pela ordem errada.
\set ON_ERROR_STOP 0
\pset pager off
\pset format aligned

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','sindico@t'),
  ('22222222-2222-2222-2222-222222222222','estranho@t');

INSERT INTO public.condominios (id, nome) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Quatro iguais'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Ordem natural'),
  ('aaaaaaaa-0000-0000-0000-000000000003','Dois blocos'),
  ('aaaaaaaa-0000-0000-0000-000000000004','Fracao em falta');

INSERT INTO public.user_roles (user_id, condominio_id, role)
SELECT '11111111-1111-1111-1111-111111111111', id, 'sindico' FROM public.condominios;

-- Quatro unidades de 25%: os restos empatam sempre.
INSERT INTO public.unidades (id, condominio_id, bloco, numero, fracao_ideal) VALUES
  ('dddddddd-0000-0000-0000-000000000104','aaaaaaaa-0000-0000-0000-000000000001','A','104',25),
  ('dddddddd-0000-0000-0000-000000000101','aaaaaaaa-0000-0000-0000-000000000001','A','101',25),
  ('dddddddd-0000-0000-0000-000000000103','aaaaaaaa-0000-0000-0000-000000000001','A','103',25),
  ('dddddddd-0000-0000-0000-000000000102','aaaaaaaa-0000-0000-0000-000000000001','A','102',25);

-- Inseridas pela ordem errada de propósito, e numeradas para que a ordenação
-- em texto dê outro resultado: em texto, "10" < "9".
INSERT INTO public.unidades (id, condominio_id, bloco, numero, fracao_ideal) VALUES
  ('dddddddd-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000002',NULL,'10',25),
  ('dddddddd-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000002',NULL,'9',25),
  ('dddddddd-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000002',NULL,'11',25),
  ('dddddddd-0000-0000-0000-000000000008','aaaaaaaa-0000-0000-0000-000000000002',NULL,'8',25);

-- Bloco B inserido primeiro: o bloco decide antes do número.
INSERT INTO public.unidades (id, condominio_id, bloco, numero, fracao_ideal) VALUES
  ('dddddddd-0000-0000-0000-0000000000b1','aaaaaaaa-0000-0000-0000-000000000003','B','1',25),
  ('dddddddd-0000-0000-0000-0000000000a1','aaaaaaaa-0000-0000-0000-000000000003','A','1',25),
  ('dddddddd-0000-0000-0000-0000000000b2','aaaaaaaa-0000-0000-0000-000000000003','B','2',25),
  ('dddddddd-0000-0000-0000-0000000000a2','aaaaaaaa-0000-0000-0000-000000000003','A','2',25);

INSERT INTO public.unidades (id, condominio_id, bloco, numero, fracao_ideal) VALUES
  ('dddddddd-0000-0000-0000-0000000000f1','aaaaaaaa-0000-0000-0000-000000000004','A','1',25),
  ('dddddddd-0000-0000-0000-0000000000f2','aaaaaaaa-0000-0000-0000-000000000004','A','2',NULL);

SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

\echo
\echo '=========== 1. 1.000,01 em quatro unidades de 25% ==========='
\echo '--- esperado: a 101 paga 250,01 e as outras 250,00.'
\echo '--- 100001 centavos / 4 = 25000,25 cada: todas truncam a 25000 e sobra 1.'
\echo '--- O centavo vai ao primeiro da ordem — e a ordem é bloco, número.'
SELECT u.bloco, u.numero, r.valor
  FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', 1000.01) r
  JOIN public.unidades u ON u.id = r.unidade_id
 ORDER BY u.numero;

\echo '--- 1b. a soma tem de ser exactamente o total (esperado: 1000.01, t)'
SELECT sum(valor) AS somado, sum(valor) = 1000.01 AS bate
  FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', 1000.01);

\echo
\echo '=========== 2. três centavos a sobrar vão às três primeiras ==========='
\echo '--- esperado: 101, 102 e 103 com 250,01 e a 104 com 250,00.'
\echo '--- 100003 / 4 = 25000,75 cada: truncam a 25000 e sobram 3.'
SELECT u.numero, r.valor
  FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', 1000.03) r
  JOIN public.unidades u ON u.id = r.unidade_id
 ORDER BY u.numero;

\echo
\echo '=========== 3. A ORDEM É NATURAL, NÃO ALFABÉTICA ==========='
\echo '--- esperado: o centavo vai à unidade 8.'
\echo '---'
\echo '--- Este é o bloco que importa. Em texto, a ordem seria "10", "11", "8",'
\echo '--- "9" — e o centavo iria à 10. Extraem-se os dígitos e compara-se como'
\echo '--- número, por isso vai à 8. Dizer a um condómino que ele paga um centavo'
\echo '--- a mais "porque a sua unidade é a primeira" exige que seja verdade.'
SELECT u.numero, r.valor
  FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000002', 1000.01) r
  JOIN public.unidades u ON u.id = r.unidade_id
 ORDER BY u.numero::int;

\echo
\echo '=========== 4. o bloco decide antes do número ==========='
\echo '--- esperado: A 1 fica com o centavo; B 1 não, apesar de ter o mesmo número'
SELECT u.bloco, u.numero, r.valor
  FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000003', 1000.01) r
  JOIN public.unidades u ON u.id = r.unidade_id
 ORDER BY u.bloco, u.numero;

\echo
\echo '=========== 5. correr duas vezes dá o mesmo rateio (esperado: 0 diferenças) ==========='
\echo '--- O determinismo era o requisito antigo e continua a valer: um rateio'
\echo '--- que muda entre execuções é um balancete que não se reproduz.'
WITH a AS (SELECT * FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000002', 777.77)),
     b AS (SELECT * FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000002', 777.77))
SELECT count(*) AS diferencas FROM (
  SELECT * FROM a EXCEPT SELECT * FROM b
  UNION ALL
  SELECT * FROM b EXCEPT SELECT * FROM a
) d;

\echo
\echo '=========== 6. divisão sem sobra: ninguém leva centavo a mais ==========='
\echo '--- esperado: quatro linhas de 250,00'
SELECT u.numero, r.valor
  FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', 1000.00) r
  JOIN public.unidades u ON u.id = r.unidade_id
 ORDER BY u.numero;

\echo
\echo '=========== 7. unidade sem fração ideal (esperado: fracao_ideal_em_falta) ==========='
\echo '--- Ratear com frações em falta produziria uma cobrança errada em silêncio.'
SELECT * FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000004', 1000.00);

\echo
\echo '=========== 8. total zero e total negativo (esperado: total_invalido, duas vezes) ==========='
SELECT * FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', 0);
SELECT * FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', -5);

\echo
\echo '=========== 9. quem não é do condomínio não rateia (esperado: forbidden) ==========='
\echo '--- A verificação vem ANTES de qualquer leitura: a contagem de unidades'
\echo '--- sem fração, que a mensagem devolveria, já diria quantas unidades há.'
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SELECT * FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', 1000.00);

\echo
\echo '=========== 10. sem sessão (esperado: not_authenticated) ==========='
SET request.jwt.claims = '';
SELECT * FROM public.ratear_por_fracao_ideal('aaaaaaaa-0000-0000-0000-000000000001', 1000.00);
