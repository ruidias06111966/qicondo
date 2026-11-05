# Testes de SQL

O CI corre `typecheck`, `lint`, `test` e `build` — tudo TypeScript. A lógica
que vive no banco não tinha onde ser verificada senão contra a base de
produção, e isso não é sítio para experimentar.

Estes ficheiros correm num PostgreSQL local descartável:

- `00-esqueleto.sql` — o mínimo do esquema real que os testes tocam. Tabelas
  reduzidas às colunas usadas, e os auxiliares (`is_sindico`,
  `pode_gerir_financeiro`, `is_member_of`) em versão simples sobre
  `user_roles`. Não substitui o esquema: serve para a migração poder correr.
- `orcamento.sql` — dezasseis casos sobre a planilha orçamentária, com os
  números conferidos à mão no cabeçalho de cada bloco.

## Como correr

```bash
D=/tmp/pgtest && rm -rf $D && mkdir -p $D && chown -R postgres:postgres $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres --auth=trust"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data -o '-k $D -c listen_addresses=' -l $D/log start"

su postgres -c "psql -h $D -U postgres -c 'CREATE DATABASE teste'"
su postgres -c "psql -h $D -U postgres -d teste -c \"CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN\""

# o esqueleto, os auxiliares reais que a migração usa, e a migração
psql ... -f supabase/testes/00-esqueleto.sql
psql ... -f supabase/migrations/20261105190000_orcamento_anual.sql
psql ... -f supabase/testes/orcamento.sql
```

A migração do orçamento depende de `validar_coerencia_condominio`
(`20261105160000`) e de `ratear_por_fracao_ideal` (`20261104150000`), que têm
de ser aplicadas antes — são as funções reais e não vale a pena substituí-las
por imitações, porque é o comportamento delas que se quer testar.

## O que os testes cobrem

| # | Caso |
|---|---|
| 1 | Realizado do ano base, com as despesas sem categoria à parte |
| 2 | Ano base igual ao ano orçado é recusado |
| 3 | Criar o orçamento |
| 4 | Rubricas semeadas com o realizado de cada categoria |
| 5 | Dois orçamentos para o mesmo ano são recusados |
| 6 | Projectar por índice, e com valor próprio |
| 7 | O resumo, com a inadimplência como divisor |
| 8 | Quotas por fração ideal, com a soma exacta ao cêntimo |
| 9 | Aprovar com assembleia por encerrar é recusado |
| 10 | Assembleia de outro condomínio é recusada |
| 11 | Aprovar |
| 12 | Editar depois de aprovado é recusado |
| 13 | Aprovar duas vezes é recusado |
| 14 | Orçado contra realizado, com o mês de corte a valer |
| 15 | Quem não é do condomínio não vê |
| 16 | Sem sessão não vê |
