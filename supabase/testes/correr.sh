#!/usr/bin/env bash
# Corre as baterias de SQL contra um PostgreSQL descartável e compara a saída
# com a referência guardada em `esperado/`.
#
# POR QUE COMPARAR SAÍDAS E NÃO ESCREVER ASSERÇÕES
#
# As baterias são descritivas: cada bloco imprime o que obteve, com o esperado
# no cabeçalho, e era uma pessoa que comparava. Reescrevê-las com asserções
# seria refazer uma centena de blocos e perder os comentários que explicam cada
# número. Guardar a saída e comparar dá o mesmo resultado por muito menos: uma
# alteração de comportamento aparece como diferença, e revê-se no próprio PR.
#
# O que isto NÃO faz: dizer se a saída guardada está certa. Diz que não mudou.
# A primeira revisão da referência é que vale, e é por isso que ela vai ao
# repositório em vez de ser gerada no CI.
#
#   ./correr.sh            compara com a referência (é o que o CI faz)
#   ./correr.sh --gravar   regrava a referência, para rever no PR
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
MIG="$RAIZ/supabase/migrations"
GRAVAR=0
[ "${1:-}" = "--gravar" ] && GRAVAR=1

# A VERSÃO MAIOR É ESCOLHIDA DE UMA LISTA, NÃO É "A MAIS RECENTE QUE HOUVER"
#
# A formatação das tabelas e o prefixo dos erros são feitos pelo psql, do lado
# do cliente, e mudam entre versões maiores. O runner do Ubuntu actualiza a sua
# sem avisar — hoje traz a 18, o meu contentor traz a 16 — e uma referência
# gravada contra uma versão passa a falhar contra a outra sem que nada no
# comportamento tenha mudado.
#
# A lista são as versões em que a saída foi conferida e é idêntica. A 16 e a 18
# foram comparadas byte a byte: não diferem em nenhuma das seis baterias. Usa-se
# a mais recente da lista que exista na máquina. Fora da lista corre, mas avisa:
# uma diferença pode ser da versão e não do código.
PG_CONFERIDAS="${PG_VERSAO:-16 18}"
BIN=""
for v in $PG_CONFERIDAS; do
  [ -d "/usr/lib/postgresql/$v/bin" ] && BIN="/usr/lib/postgresql/$v/bin"
done
if [ -z "$BIN" ]; then
  BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
  [ -n "$BIN" ] && echo "AVISO: nenhuma versão conferida ($PG_CONFERIDAS) nesta máquina; a usar $BIN. Uma diferença pode ser da versão." >&2
fi
if [ -z "$BIN" ]; then echo "PostgreSQL não encontrado em /usr/lib/postgresql" >&2; exit 1; fi
echo "PostgreSQL: $BIN"

# A LARGURA DAS COLUNAS DEPENDE DO LOCALE, E ISSO TEM DE SER FIXADO AQUI
#
# O psql alinha as colunas pela largura do valor mais comprido. Sem locale
# UTF-8, conta bytes em vez de caracteres: "Manutenção" passa a valer 12 e a
# coluna inteira alarga. A saída fica correcta mas diferente, e a comparação
# acusa uma alteração de comportamento que não existe.
#
# Era isto que a versão anterior deixava ao ambiente: o `su` carregava o perfil
# do utilizador `postgres` e trazia `LANG=C.UTF-8` por acidente. Trocar para
# `runuser`, que não carrega perfil nenhum, chegou para três baterias
# divergirem. Um guião cuja saída depende do `LANG` de quem o corre não serve
# para comparar com uma referência no repositório — nem entre a minha máquina e
# o CI, nem entre duas versões do PostgreSQL. Fica declarado.
LOCALE=C.UTF-8

# `/tmp/pgtest` e não o directório do repositório: o initdb recusa correr numa
# pasta que não seja do utilizador `postgres`.
D=/tmp/pgtest
rm -rf "$D"; mkdir -p "$D"; chown -R postgres:postgres "$D"

# O SQL É COPIADO, NÃO LIDO ONDE ESTÁ
#
# O psql corre como `postgres` e abre os ficheiros ele próprio — o `-f` é lido
# pelo cliente, não pelo servidor. No meu contentor o repositório está debaixo
# de um `/home/user` com 755 e o `postgres` lê-o; no runner do GitHub está
# debaixo de `/home/runner`, que não dá passagem a outros utilizadores, e cada
# bateria produzia uma linha só: "Permission denied". Copiar resolve, e resolve
# em qualquer máquina em vez de depender das permissões de quem clonou.
mkdir -p "$D/testes" "$D/migracoes"
cp "$AQUI"/*.sql "$D/testes/" 2>/dev/null || true
cp "$MIG"/*.sql "$D/migracoes/" 2>/dev/null || true
chown -R postgres:postgres "$D"

# Correr como `postgres`: o initdb recusa-se a arrancar como root.
#
# `runuser` e não `su`: o `su` precisa que o utilizador tenha uma shell de
# login, e em algumas máquinas o `postgres` tem `nologin`. O `runuser` não se
# importa. Onde não existir, cai para o `su` — e em ambos os casos o locale vai
# explícito, para não voltar a depender do perfil.
# O comando vai para um ficheiro em vez de ser interpolado numa linha de `-c`:
# alguns contêm aspas de ambos os tipos e aninhá-los duas vezes é como se
# escrevem erros que só aparecem numa bateria.
ENV_PG="LANG=$LOCALE LC_ALL=$LOCALE PGCLIENTENCODING=UTF8"
como_postgres() {
  printf '%s\n' "$1" > "$D/cmd.sh"
  chown postgres "$D/cmd.sh"
  if command -v runuser >/dev/null 2>&1; then
    runuser -u postgres -- env $ENV_PG bash "$D/cmd.sh"
  else
    su postgres -c "env $ENV_PG bash $D/cmd.sh"
  fi
}

# A preparação NÃO é silenciosa. Engoli-a na primeira versão e o resultado foi
# o CI a mostrar seis baterias "com saída diferente" quando o que acontecera
# era o servidor nunca ter arrancado. Um automatismo que esconde a própria
# avaria é pior do que não ter nenhum: manda procurar no sítio errado.
if ! como_postgres "$BIN/initdb -D $D/data -U postgres --auth=trust --encoding=UTF8 --locale=$LOCALE" > "$D/initdb.log" 2>&1; then
  echo "FALHA: o initdb não correu." >&2
  cat "$D/initdb.log" >&2
  exit 1
fi

if ! como_postgres "$BIN/pg_ctl -D $D/data -o '-k $D -c listen_addresses=' -l $D/log start -w -t 30"; then
  echo "FALHA: o servidor não arrancou." >&2
  cat "$D/log" >&2 || true
  exit 1
fi
trap 'como_postgres "$BIN/pg_ctl -D $D/data stop" >/dev/null 2>&1 || true' EXIT

# Prova que dá mesmo para falar com o servidor antes de correr seja o que for.
if ! como_postgres "psql -h $D -U postgres -c 'SELECT version()'" > "$D/versao.log" 2>&1; then
  echo "FALHA: o servidor arrancou mas não aceita ligações." >&2
  cat "$D/versao.log" >&2
  exit 1
fi
grep -o "PostgreSQL [0-9.]*" "$D/versao.log" | head -1

psql_() { como_postgres "psql -h $D -U postgres -d teste -v ON_ERROR_STOP=0 $*"; }

# As migrações que cada bateria precisa, por prefixo de data. A tabela está no
# README; aqui repete-se em código para o CI não depender de ninguém a ler.
declare -A ESQUELETO=(
  [orcamento]="00"
  [indices]="00"
  [fluxo-de-caixa]="00 01"
  [aplicar-orcamento]="00 01"
  [plano-de-contas]="00 01 02"
  [certidoes-e-infracoes]="00 01 03"
  [comprovante-whatsapp]="00 01 02 04"
)
declare -A MIGRACOES=(
  [orcamento]="20261105190000"
  [indices]="20261105190000 20261105200000"
  [fluxo-de-caixa]="20261104180000 20261105120000 20261105190000 20261105200000 20261105210000"
  [aplicar-orcamento]="20261105190000 20261105200000 20261105210000 20261105220000"
  [plano-de-contas]="20261105230000 20261105240000 20261105250000"
  [certidoes-e-infracoes]="20261105170000 20261105180000 20261105260000"
  [comprovante-whatsapp]="20261105230000 20261105240000 20261106200000"
)
# Funções reais de que as migrações dependem e que não vale a pena imitar: é o
# comportamento delas que se quer testar.
DEPENDENCIAS="20261105160000 20261104150000"

falhas=0
for bateria in orcamento indices fluxo-de-caixa aplicar-orcamento plano-de-contas certidoes-e-infracoes comprovante-whatsapp; do
  [ -f "$AQUI/$bateria.sql" ] || { echo "SALTADA  $bateria (ficheiro não existe)"; continue; }

  como_postgres "psql -h $D -U postgres -q -c 'DROP DATABASE IF EXISTS teste'" >/dev/null 2>&1
  if ! como_postgres "psql -h $D -U postgres -q -c \"CREATE DATABASE teste TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE '$LOCALE' LC_CTYPE '$LOCALE'\""; then
    echo "FALHA: não foi possível criar a base para $bateria." >&2
    exit 1
  fi
  como_postgres "psql -h $D -U postgres -q -d teste -c \"CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN\"" >/dev/null 2>&1

  saida=$(mktemp)
  {
    for n in ${ESQUELETO[$bateria]}; do
      f=$(ls "$D/testes/$n-"*.sql 2>/dev/null | head -1)
      [ -n "$f" ] && psql_ "-q -f '$f'"
    done
    for n in $DEPENDENCIAS ${MIGRACOES[$bateria]}; do
      f=$(ls "$D/migracoes/$n"*.sql 2>/dev/null | head -1)
      [ -n "$f" ] && psql_ "-q -f '$f'"
    done
  } >/dev/null 2>&1

  # Só a bateria é capturada. A preparação fica de fora porque uma migração
  # nova, de outro assunto, mudaria a saída e daria falso alarme.
  # Três coisas mudam a cada execução e teriam de ser neutralizadas, senão a
  # comparação nunca estabiliza:
  #
  #  - o caminho absoluto com que o psql prefixa cada erro, diferente na
  #    máquina de quem corre e na do CI;
  #  - os uuid gerados pelo `gen_random_uuid()`;
  #  - os carimbos de tempo do `now()`.
  #
  # Os uuid do cenário de teste NÃO são neutralizados: começam todos por oito
  # caracteres iguais (`aaaaaaaa-`, `11111111-`) e é por eles que se percebe,
  # ao ler a referência, qual condomínio ou morador cada linha toca. Perdê-los
  # tornaria o ficheiro ilegível.
  psql_ "-f '$D/testes/$bateria.sql'" 2>&1 \
    | sed "s|$D/testes/|testes/|g" \
    | perl -pe 's/\b(?!(.)\1{7}-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/<uuid>/gi' \
    | perl -pe 's/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2})?/<carimbo>/g' \
    `# O código do nada consta acaba num sufixo aleatório de oito dígitos` \
    `# hexadecimais. O número de ordem fica — é ele que diz se a sequência` \
    `# por condomínio está a contar bem.` \
    | perl -pe 's/\b(NC-\d{4}-\d{4})-[0-9A-F]{8}\b/$1-<aleatorio>/g' \
    > "$saida"

  # Uma saída pode estar errada e ser estável — e então a comparação diz OK
  # para sempre. Foi o que aconteceu: um uuid mal formado na bateria fez o
  # INSERT falhar, a falha entrou na referência, e os dois lados passaram a
  # concordar num resultado sem sentido.
  #
  # Estas assinaturas não são recusas de regra de negócio (essas são códigos
  # como `sem_divida`): são sinais de que o esqueleto, a migração ou a própria
  # bateria estão partidos.
  #
  # `structure of query does not match` entrou depois: uma coluna do
  # `RETURNS TABLE` declarada `text` onde a tabela tem `date` faz a função
  # falhar em todas as chamadas, e sem estar na lista isso gravava-se como
  # referência — exactamente o modo de falha que a guarda existe para apanhar.
  infra=$(grep -cE "invalid input syntax|does not exist|syntax error at|permission denied for|structure of query does not match|relation \"[^\"]+\" does not exist" "$saida" || true)
  if [ "$infra" -gt 0 ]; then
    echo "FALHA    $bateria — $infra erro(s) de infra-estrutura na saída, não de regra de negócio:"
    grep -nE "invalid input syntax|does not exist|syntax error at|permission denied for|structure of query does not match" "$saida" | head -5
    echo "         Isto não se grava como referência. Corrija a bateria ou o esqueleto."
    falhas=$((falhas + 1))
    rm -f "$saida"
    continue
  fi

  ref="$AQUI/esperado/$bateria.txt"
  if [ "$GRAVAR" = "1" ]; then
    cp "$saida" "$ref"
    echo "GRAVADA  $bateria ($(wc -l < "$ref") linhas)"
  elif [ ! -f "$ref" ]; then
    echo "FALHA    $bateria — sem referência. Corra com --gravar e reveja o resultado."
    falhas=$((falhas + 1))
  elif diff -q "$ref" "$saida" >/dev/null; then
    echo "OK       $bateria"
  else
    echo "FALHA    $bateria — a saída mudou:"
    diff -u "$ref" "$saida" | head -40
    # O `diff` lista primeiro o que saiu e só depois o que entrou. Com uma
    # referência de trezentas linhas, cortar o diff esconde exactamente a parte
    # que interessa: o que a bateria produziu agora. Foi assim que li "6
    # baterias com saída diferente" três vezes sem ver a linha "Permission
    # denied" que explicava as seis.
    echo "         --- saída obtida ($(wc -l < "$saida") linhas), primeiras 10:"
    sed -n '1,10p' "$saida" | sed 's/^/         /'
    falhas=$((falhas + 1))
  fi
  rm -f "$saida"
done

echo
if [ "$GRAVAR" = "1" ]; then
  echo "Referências gravadas. Reveja o diff antes de enviar: é ele que diz se o"
  echo "comportamento novo está certo."
  exit 0
fi
[ "$falhas" -eq 0 ] && echo "Todas as baterias conferem." || echo "$falhas bateria(s) com saída diferente."
exit "$falhas"
