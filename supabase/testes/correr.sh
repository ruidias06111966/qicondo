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

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
if [ -z "$BIN" ]; then echo "PostgreSQL não encontrado em /usr/lib/postgresql" >&2; exit 1; fi

# `/tmp/pgtest` e não o directório do repositório: o initdb recusa correr numa
# pasta que não seja do utilizador `postgres`.
D=/tmp/pgtest
rm -rf "$D"; mkdir -p "$D"; chown -R postgres:postgres "$D"

su postgres -c "$BIN/initdb -D $D/data -U postgres --auth=trust" >/dev/null 2>&1
su postgres -c "$BIN/pg_ctl -D $D/data -o '-k $D -c listen_addresses=' -l $D/log start" >/dev/null 2>&1
trap 'su postgres -c "$BIN/pg_ctl -D $D/data stop" >/dev/null 2>&1 || true' EXIT

psql_() { su postgres -c "psql -h $D -U postgres -d teste -v ON_ERROR_STOP=0 $*"; }

# As migrações que cada bateria precisa, por prefixo de data. A tabela está no
# README; aqui repete-se em código para o CI não depender de ninguém a ler.
declare -A ESQUELETO=(
  [orcamento]="00"
  [indices]="00"
  [fluxo-de-caixa]="00 01"
  [aplicar-orcamento]="00 01"
  [plano-de-contas]="00 01 02"
  [certidoes-e-infracoes]="00 01 03"
)
declare -A MIGRACOES=(
  [orcamento]="20261105190000"
  [indices]="20261105190000 20261105200000"
  [fluxo-de-caixa]="20261105180000 20261105190000 20261105200000 20261105210000"
  [aplicar-orcamento]="20261105190000 20261105200000 20261105210000 20261105220000"
  [plano-de-contas]="20261105230000 20261105240000 20261105250000"
  [certidoes-e-infracoes]="20261105170000 20261105180000 20261105260000"
)
# Funções reais de que as migrações dependem e que não vale a pena imitar: é o
# comportamento delas que se quer testar.
DEPENDENCIAS="20261105160000 20261104150000"

falhas=0
for bateria in orcamento indices fluxo-de-caixa aplicar-orcamento plano-de-contas certidoes-e-infracoes; do
  [ -f "$AQUI/$bateria.sql" ] || { echo "SALTADA  $bateria (ficheiro não existe)"; continue; }

  su postgres -c "psql -h $D -U postgres -c 'DROP DATABASE IF EXISTS teste'" >/dev/null 2>&1
  su postgres -c "psql -h $D -U postgres -c 'CREATE DATABASE teste'" >/dev/null 2>&1
  su postgres -c "psql -h $D -U postgres -d teste -c \"CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN\"" >/dev/null 2>&1

  saida=$(mktemp)
  {
    for n in ${ESQUELETO[$bateria]}; do
      f=$(ls "$AQUI/$n-"*.sql 2>/dev/null | head -1)
      [ -n "$f" ] && psql_ "-q -f '$f'"
    done
    for n in $DEPENDENCIAS ${MIGRACOES[$bateria]}; do
      f=$(ls "$MIG/$n"*.sql 2>/dev/null | head -1)
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
  psql_ "-f '$AQUI/$bateria.sql'" 2>&1 \
    | sed "s|$AQUI/|testes/|g" \
    | perl -pe 's/\b(?!(.)\1{7}-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/<uuid>/gi' \
    | perl -pe 's/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2})?/<carimbo>/g' \
    `# O código do nada consta acaba num sufixo aleatório de oito dígitos` \
    `# hexadecimais. O número de ordem fica — é ele que diz se a sequência` \
    `# por condomínio está a contar bem.` \
    | perl -pe 's/\b(NC-\d{4}-\d{4})-[0-9A-F]{8}\b/$1-<aleatorio>/g' \
    > "$saida"

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
    diff -u "$ref" "$saida" | head -60
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
