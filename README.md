# QiCond

Plataforma SaaS multiempresa de gestão condominial, com atendimento por WhatsApp.
Cada empresa é um inquilino isolado: os dados são separados por `condominio_id` e
a fronteira real é o RLS do Postgres, não a interface.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19, TanStack Router/Start, Tailwind 4, shadcn/ui |
| Servidor | Server functions do TanStack Start, sobre Nitro |
| Base de dados | Supabase (Postgres, Auth, Storage, RLS) |
| Filas | PGMQ + pg_cron, dentro do próprio Postgres |
| E-mail | Resend, com templates React Email |
| Hospedagem | Cloudflare Workers por omissão; Vercel quando é ela a fazer o build |
| Gestor de pacotes | Bun |

## Domínio e identidade

Convenção partilhada por todos os sistemas: cada um ocupa um subdomínio de
`qidominios.com.br` com o seu próprio nome, e envia e-mail a partir de `notify.`
desse mesmo host.

| | |
| --- | --- |
| Aplicação | `qicond.qidominios.com.br` |
| Remetente | `notify.qicond.qidominios.com.br` |

Tudo isto vive em `src/lib/site.ts`, que é o único sítio do código a conhecer o
domínio. Num sistema novo mudam-se lá `NOME_SISTEMA` e `SUBDOMINIO` e mais nada.
O remetente tem subdomínio próprio de propósito: mantém a reputação de envio de
cada sistema separada, para que um problema de entrega num não arraste os outros.

`SITE_URL` sobrepõe-se ao domínio canónico em pré-visualizações e testes, e é
lido apenas no servidor (`src/server/site.server.ts`).

## Começar

```bash
bun install
cp .env.example .env     # preencher com os valores do projeto
bun run dev              # http://localhost:8080
```

Comandos disponíveis:

```bash
bun run dev         # servidor de desenvolvimento
bun run build       # build de produção (.output)
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run test        # vitest
bun run format      # prettier --write
```

## Como o projeto está organizado

```
src/
  routes/            Rotas por ficheiro (TanStack Router)
    api/             Endpoints HTTP: webhooks, cron, fila de e-mail
    app.*            Aplicação autenticada
    auth.*           Entrada, registo, convites, recuperação
    admin.*          Consola da plataforma (multiempresa)
  lib/*.functions.ts Server functions — a lógica de negócio vive aqui
  server/            Código exclusivo de servidor (nunca chega ao browser)
  auth/              Sessão, papel activo e grupos de permissão
  integrations/      Clientes Supabase (browser e service role)
supabase/migrations/ Esquema, RLS, funções e agendamentos
```

O `vite.config.ts` activa o `importProtection` do TanStack Start: qualquer
importação de `src/server/**` a partir de código de cliente falha o build. É o que
impede a service role key e os segredos de webhook de acabarem no bundle.

## Perfis e permissões

Papéis actuais: `admin`, `financeiro`, `gestor`, `vendedor`, `comercial`,
`contador`, `consulta`, `porteiro`, `morador`. `sindico` é legado e equivale a
`admin` — continua a ser aceite para não invalidar contas antigas.

`src/auth/permissoes.ts` agrupa papéis para esconder menus e barrar navegação,
mas isso é conveniência de interface. **A autorização real é o RLS**: uma
alteração de permissões que não passe por uma migração não protege nada.

## E-mail

O envio é assíncrono e passa por uma fila dentro do Postgres, o que evita que uma
indisponibilidade do fornecedor faça falhar a operação que originou o e-mail.

```
origem  ──►  enqueue_email  ──►  fila PGMQ  ──►  /api/email/queue-process  ──►  Resend
                                    │                      │
                              pg_cron (10s)          falha ─┴─►  retenta ─►  DLQ
```

Duas filas, processadas por esta ordem: `auth_emails` (TTL 15 min) antes de
`transactional_emails` (TTL 60 min). Um 429 do fornecedor grava uma janela de
espera em `email_send_state.retry_after_until` e o processamento pára até lá; um
403 é permanente e a mensagem segue directa para o DLQ. Todas as tentativas ficam
em `email_send_log`.

Rotas:

| Rota | Para quê |
| --- | --- |
| `POST /api/email/auth-hook` | Send Email Hook do Supabase Auth (assinado) |
| `POST /api/email/queue-process` | Drena as filas; chamada pelo pg_cron |
| `POST /api/email/preview` | Renderiza um template com dados fictícios |

### Configurar de raiz

1. **Resend** — verificar o domínio remetente (`notify.<dominio>`), incluindo os
   registos SPF e DKIM. Sem verificação a API responde 403 e as mensagens vão
   para o DLQ. Guardar a chave em `RESEND_API_KEY`.

2. **Send Email Hook** — no Supabase, em Authentication → Emails → Send Email
   Hook, activar e apontar para `https://<dominio>/api/email/auth-hook`. Guardar
   o segredo gerado em `SEND_EMAIL_HOOK_SECRET`.

3. **Fila** — registar os segredos que o agendamento usa, uma vez por ambiente:

   ```sql
   SELECT vault.create_secret('https://qicond.qidominios.com.br', 'app_base_url');
   SELECT vault.create_secret('<service_role_key>', 'email_queue_service_role_key');
   SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```

   Ficam no vault, e não no comando do cron, porque `cron.job.command` é legível
   por qualquer role com acesso ao schema `cron`. Os agendamentos são criados
   pelas migrações `20260910120000_cron_fila_email.sql` (fila de e-mail) e
   `20260910130000_cron_wa_drain.sql` (fila de WhatsApp); `app_base_url` é
   partilhado pelos dois.

Verificar se está a correr:

```sql
SELECT jobname, schedule, active FROM cron.job
 WHERE jobname IN ('process-email-queue', 'wa-drain-every-minute');
SELECT status, count(*) FROM public.email_send_log GROUP BY status;
SELECT * FROM pgmq.q_auth_emails_dlq ORDER BY enqueued_at DESC LIMIT 10;

-- Últimas invocações HTTP disparadas pelos agendamentos, com o código devolvido
SELECT id, status_code, error_msg, created FROM net._http_response
 ORDER BY created DESC LIMIT 20;
```

## Autenticação

E-mail/senha e Google. O login social usa `signInWithOAuth` do Supabase
(`src/integrations/supabase/oauth.ts`); para o activar, ligar o fornecedor em
Authentication → Providers e acrescentar `https://<dominio>/auth/callback` às
Redirect URLs.

Os convites guardam apenas o hash SHA-256 do token. O token em claro aparece uma
única vez na resposta de `convidarUsuario`, e é por isso que a interface mostra o
link mesmo depois de o e-mail ser enfileirado: se o envio falhar, não há como o
recuperar depois.

## Deploy

O alvo não está fixado no código. O Nitro detecta a plataforma pelo ambiente e o
Cloudflare é apenas o destino por omissão, quando nenhuma é reconhecida:

| Onde corre o build | Saída |
| --- | --- |
| Local e CI | `.output/` — Worker do Cloudflare |
| Vercel (`VERCEL=1`) | `.vercel/output/` — formato da Vercel |

Isto é deliberado: o repositório está ligado à Vercel, que faz deploy de cada
push, e fixar `preset: "cloudflare-module"` faria esse deploy receber um Worker
que não sabe servir. Para forçar um alvo, passar `preset` em vez de
`defaultPreset` em `vite.config.ts`.

### Cloudflare Workers

```bash
bun run build
bunx wrangler deploy
```

Os segredos entram uma vez, por ambiente:

```bash
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put SEND_EMAIL_HOOK_SECRET
bunx wrangler secret put CRON_SECRET
bunx wrangler secret put SITE_URL
```

As `VITE_*` são diferentes: entram em tempo de build, não em runtime. Têm de
estar no ambiente que corre `bun run build`, senão o bundle sai sem as
credenciais do Supabase. Numa plataforma que faz o build por si (a Vercel, por
exemplo), isso significa declará-las lá também — e os segredos de runtime
(`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`,
`CRON_SECRET`, `SITE_URL`) no painel dessa plataforma, não via `wrangler`.

## Migrações

```bash
bunx supabase db push      # aplicar
bunx supabase migration new <nome>
```

São aplicadas por ordem de nome de ficheiro. Alterações a permissões pertencem
aqui, e não apenas em `src/auth/permissoes.ts`.

## Trabalhos pendentes

- **`no-explicit-any`** — cerca de 150 ocorrências herdadas do código gerado,
  concentradas em `lib/financeiro.functions.ts` e `server/wa-bot.server.ts`. Está
  como aviso para não travar o CI; reduzir à medida que cada módulo for tocado, e
  não acrescentar novas.
- **Cobertura de testes** — existem testes para a camada de e-mail (assinatura de
  webhook e transporte). Os módulos financeiros ainda não têm.
- **`createServerFn().inputValidator()`** — descontinuado a favor de
  `.validator()`; o build avisa mas continua a funcionar.
- **Cancelamento de subscrição** — o transporte já emite o cabeçalho
  `List-Unsubscribe` quando há token, mas a rota
  `/api/public/unsubscribe` ainda não existe. É necessária antes de haver envios
  em massa.
