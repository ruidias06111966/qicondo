# Convenções do projeto

## Domínio e nome do sistema

Todos os sistemas seguem o mesmo padrão: um subdomínio de `qidominios.com.br`
com o nome do sistema, e o envio de e-mail a partir de `notify.` desse host.

```
<sistema>.qidominios.com.br            aplicação
notify.<sistema>.qidominios.com.br     remetente
```

Neste repositório: `qicond.qidominios.com.br` e
`notify.qicond.qidominios.com.br`.

`src/lib/site.ts` é o único ficheiro que conhece o domínio. Nada de escrever o
host noutro sítio — importar de lá. Ao arrancar um sistema novo, mudam-se
`NOME_SISTEMA` e `SUBDOMINIO` nesse ficheiro e o resto do código acompanha.

O remetente tem subdomínio próprio para que a reputação de envio de cada sistema
fique separada: um problema de entrega num não deve arrastar os outros.

`src/lib/site.ts` é importado pelo cliente, por isso só contém constantes
estáticas. Qualquer leitura de `process.env` vai para `src/server/site.server.ts`.

## Idioma

Código, comentários e mensagens de commit em português. A interface e os e-mails
são em PT-BR, com a norma do Brasil (`você`, `e-mail`, datas `dd/mm/aaaa`).

## Segredos

Nunca em texto no código, em migrações ou em `cron.job.command` — este último é
legível por qualquer role com acesso ao schema `cron`. Os agendamentos leem do
vault; a aplicação lê de variáveis de ambiente, documentadas em `.env.example`.

O `.env` não é versionado.

## Base de dados

A autorização real é o RLS, não a interface. `src/auth/permissoes.ts` só serve
para esconder menus; uma alteração de permissões que não passe por uma migração
não protege nada.

Alterações ao esquema, a políticas e a agendamentos entram como migração no
repositório. Nada de aplicar directamente em produção: foi assim que o cron da
fila de e-mail acabou por existir só no servidor e não no código.

## Antes de fazer push

```bash
bun run typecheck && bun run lint && bun run test && bun run build
```

É o mesmo que o CI corre. Um push que deixa o CI vermelho custa um ciclo.
