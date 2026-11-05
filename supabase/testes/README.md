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
- `01-esqueleto-financeiro.sql` — a parte financeira do esqueleto: cobranças,
  pagamentos e configuração. Vai a seguir ao `00-esqueleto.sql` e só é precisa
  para os testes de fluxo de caixa.
- `fluxo-de-caixa.sql` — doze casos. O mais importante é o segundo: compara o
  saldo de abertura que o fluxo calcula com o `saldo_anterior` que a função
  real do balancete devolve para a mesma data. Se os dois ecrãs discordassem,
  o condómino teria dois números e nenhuma forma de saber qual vale.
- `indices.sql` — dez casos sobre os índices económicos. Os valores são
  inventados de propósito, para o teste dar sempre o mesmo e a conta poder ser
  conferida de cabeça: doze meses de 0,50% têm de dar 6,17% e não 6,00%.

- `02-esqueleto-contabil.sql` — a terceira camada do esqueleto: as colunas que
  faltavam à categoria financeira, `unidade_moradores`, `infracoes`,
  `orcamento_itens` e um stub do schema `storage`. Vai depois dos outros dois.
- `plano-de-contas.sql` — dezassete blocos sobre o plano de contas e os anexos
  de comprovação. Os números do cenário estão no cabeçalho do bloco 11 e são
  conferíveis de cabeça: três despesas e uma receita, e os subtotais dos grupos
  têm de dar 400, 50 e 450. O bloco 5 é o que importa guardar: uma categoria
  antiga chamada como uma conta padrão, mas de outro tipo e já com movimento,
  não pode ser adoptada nem apagada — nasce uma conta ao lado, com o código no
  nome, e as duas coexistem à vista.

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


## Os índices contra os dados reais

Os dez casos de `indices.sql` não tocam na rede. A verificação contra o Banco
Central foi feita à parte, uma vez, comparando o que `acumulado_12m` devolve
com o mesmo cálculo feito em Python sobre a resposta crua da API. Em
05/11/2026:

| Índice | Série SGS | Acumulado 12m | Janela |
|---|---|---|---|
| IPCA | 433 | 4,58% | 10/2025 a 09/2026 |
| INPC | 188 | 4,29% | 10/2025 a 09/2026 |
| IGP-M | 189 | 5,25% | 11/2025 a 10/2026 |
| INCC-M | 7456 | 6,75% | 11/2025 a 10/2026 |

Os quatro bateram ao cêntimo. Repetir:

```bash
curl -s "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/2025&dataFinal=31/12/2026"
```

O endpoint `ultimos/N` tem tecto de 20 valores; para doze meses dá, mas a
aplicação usa o intervalo de datas, que não tem esse limite.

Repare-se, de passagem, que o INCC correu 2,17 pontos acima do IPCA nesses
doze meses. É o argumento de ter um índice por rubrica em vez de um só, em
números e não em teoria.
