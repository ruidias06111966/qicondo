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

- `03-esqueleto-certidoes.sql` — a camada para a carta de cobrança, o nada
  consta e as infrações: `profiles`, `unidade_moradores` com vínculo,
  `acordos`, o cabeçalho do condomínio e `extensions.gen_random_bytes`. Vai
  **em vez de** `02-esqueleto-contabil.sql`, não a seguir: o 02 cria uma
  `infracoes` reduzida e aqui quem a cria é a migração real.
- `certidoes-e-infracoes.sql` — dezoito blocos, vinte e três recusas
  esperadas. Foi esta bateria que apanhou o `carta_cobranca` declarado
  `STABLE` a tentar gravar no `audit_log`: a funcionalidade nunca tinha
  funcionado, falhava em todas as chamadas, e ninguém reparou porque nunca
  tinha sido corrida contra uma base. Os tectos das multas estão nos números
  do bloco 11 e conferem-se de cabeça: com contribuição mensal de 400, o art.
  1.336 §2.º dá 2.000 e o art. 1.337 § único dá 4.000.

- `04-esqueleto-whatsapp.sql` — as conversas do WhatsApp e o `audit_log`. Vai
  depois de 00, 01 e 02.
- `comprovante-whatsapp.sql` — quinze blocos, nove deles recusas. Esta é a
  única função do sistema que escreve a partir de um número de telefone em vez
  de um utilizador autenticado: quem a chama é o webhook da Meta, com a chave
  de serviço, e não há `auth.uid()` para verificar. O vínculo número → unidade
  é tudo o que separa um condómino a comprovar a sua cobrança de um condómino a
  mexer na do vizinho — e é por isso que os blocos 2 a 6 valem mais do que o
  caso normal. O bloco 14 apanhou uma coluna do `RETURNS TABLE` declarada
  `text` onde a tabela tem `date`: a função falhava em todas as chamadas.

- `rateio.sql` — dez blocos sobre o desempate do centavo que sobra no rateio
  por fração ideal. O bloco 3 é o que importa guardar: `numero` é texto, e em
  texto a unidade "10" vem antes da "9". Dizer a um condómino que ele paga um
  centavo a mais "porque a sua unidade é a primeira" exige que seja verdade.

## Como correr

```bash
./supabase/testes/correr.sh            # compara com a referência — é o que o CI faz
./supabase/testes/correr.sh --gravar   # regrava a referência, para rever no PR
```

O guião arranca um PostgreSQL descartável, aplica o esqueleto e as migrações
de cada bateria, e compara a saída com `esperado/<bateria>.txt`.

**A comparação diz que a saída não mudou, não que está certa.** Quem revê o
`--gravar` é que decide se o comportamento novo é o desejado — é por isso que
a referência vai ao repositório, e não é gerada no CI.

Três coisas estão fixadas no guião e não se deixam ao ambiente, porque a
formatação da saída é feita pelo **psql**, do lado do cliente, e muda com cada
uma delas.

**O locale** (`C.UTF-8`). O psql alinha as colunas pela largura do valor mais
comprido e, sem locale UTF-8, conta bytes em vez de caracteres: `Manutenção`
passa a valer 12 e a coluna inteira alarga. A saída continua certa, mas
diferente. Foi assim que três baterias divergiram ao trocar o `su` pelo
`runuser`: o `su` carregava o perfil do `postgres` e trazia o `LANG` por
acidente.

**A versão maior.** A lista está no guião (`PG_CONFERIDAS`) e são as versões em
que a saída foi conferida: a **16** e a **18** foram comparadas byte a byte e
não diferem em nenhuma das seis baterias. Usa-se a mais recente da lista que
exista na máquina; fora da lista corre, mas avisa. `PG_VERSAO=16` força uma.

**Onde o SQL é lido.** Os ficheiros são copiados para `/tmp/pgtest` antes de
correr. O `-f` do psql é aberto pelo cliente, que corre como `postgres`: num
contentor onde o repositório está debaixo de um `/home` com 755 isso funciona,
no runner do GitHub está debaixo de `/home/runner`, que não dá passagem, e cada
bateria dava uma linha só — `Permission denied`. Copiar não depende das
permissões de quem clonou.

Três coisas são neutralizadas antes de comparar, senão nada estabilizava: o
caminho absoluto com que o `psql` prefixa os erros, os uuid gerados pelo
`gen_random_uuid()` e os carimbos de `now()`. Os uuid do cenário — os que
começam por oito caracteres iguais — ficam como estão, porque é por eles que
se percebe que linha toca que condomínio.

### À mão, uma bateria de cada vez

```bash
D=/tmp/pgtest && rm -rf $D && mkdir -p $D && chown -R postgres:postgres $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data -o '-k $D -c listen_addresses=' -l $D/log start"

su postgres -c "psql -h $D -U postgres -c \"CREATE DATABASE teste TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8'\""
su postgres -c "psql -h $D -U postgres -d teste -c \"CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN\""

# o esqueleto, os auxiliares reais que a migração usa, e a migração
psql ... -f supabase/testes/00-esqueleto.sql
psql ... -f supabase/migrations/20261105190000_orcamento_anual.sql
psql ... -f supabase/testes/orcamento.sql
```

As camadas do esqueleto não se empilham todas: a 02 e a 03 são alternativas,
porque ambas tocam na `infracoes`.

| Bateria | Esqueleto | Migrações |
|---|---|---|
| `orcamento.sql` | 00 | 190000 |
| `indices.sql` | 00 | 190000, 200000 |
| `fluxo-de-caixa.sql` | 00, 01 | 180000…210000 |
| `aplicar-orcamento.sql` | 00, 01 | 190000…220000 |
| `plano-de-contas.sql` | 00, 01, **02** | 230000, 240000, 250000 |
| `certidoes-e-infracoes.sql` | 00, 01, **03** | 170000, 180000, 260000 |
| `comprovante-whatsapp.sql` | 00, 01, 02, 04 | 230000, 240000, 06200000 |
| `rateio.sql` | 00 | 06210000 |

Uma recusa esperada aparece no `psql` como `ERROR:`. O que se conta no fim é
que sejam **aquelas** recusas e nenhuma outra:

```bash
psql ... -f supabase/testes/certidoes-e-infracoes.sql 2>&1 \
  | grep -E '^psql.*ERROR' | sed 's/.*ERROR:  //' | sort | uniq -c
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
| 8 | Quotas por fração ideal, com a soma exacta ao cêntimo (o desempate do centavo tem bateria própria, `rateio.sql`) |
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
