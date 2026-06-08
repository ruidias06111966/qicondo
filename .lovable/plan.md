# Plano: SaaS multi-empresa (QiCond)

Refactor em 4 frentes. Mantemos a tabela `condominios` no backend (é o tenant), mas a UI passa a falar "Empresa". Nada de migração destrutiva.

## 1. Renomear UI: Condomínio → Empresa

Substituir textos em toda a app pública e privada:
- Landing, /recursos, /precos, /sobre, /contato, /ajuda, FAQ, footer, navbar.
- App: sidebar ("Condomínio" → "Empresa"), /app/condominio → /app/empresa (alias de rota mantendo o ficheiro antigo a redirecionar), labels, toasts.
- Onboarding: "Criar condomínio" → "Cadastrar empresa".
- Formulário de cadastro de empresa passa a ter: Nome da Empresa, CNPJ, Responsável, E-mail (já vem do auth), Telefone, Plano (select). Senha já é definida no signup.

**Backend permanece**: tabela `condominios`, `user_roles.condominio_id`, RLS, funções — tudo inalterado. Só strings/labels mudam.

## 2. Novos perfis com permissões reais

Hoje: `sindico | morador | contador | porteiro`.
Novo: adicionar ao enum `app_role` → `admin, financeiro, gestor, vendedor, comercial, consulta` (manter os antigos para compat).

Migração:
```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'financeiro';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'comercial';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'consulta';
```

Funções helper novas (security definer):
- `is_admin(uid, empresa_id)` — equivalente ao síndico antigo (gestão total).
- `pode_gerir_financeiro(uid, empresa_id)` — admin OR financeiro OR contador.
- `pode_consultar(uid, empresa_id)` — qualquer role ativo.

Matriz de permissões aplicada via RLS (atualizar políticas de `cobrancas`, `despesas`, `pagamentos`, `categorias_financeiras`, `cnab_*`, `config_pagamento`, `condominios`, `unidades`, `documentos`, etc.):

| Recurso | Admin | Financeiro | Gestor | Vendedor | Comercial | Contador | Consulta |
|---|---|---|---|---|---|---|---|
| Dados empresa | RW | R | RW | R | R | R | R |
| Financeiro (cobranças/pagamentos/despesas) | RW | RW | R | R | R | RW | R |
| Categorias | RW | RW | R | – | – | RW | R |
| CNAB | RW | RW | – | – | – | RW | – |
| Documentos | RW | R | RW | R | R | R | R |
| Utilizadores/convites | RW | – | – | – | – | – | – |
| Leads/comercial | R | – | R | RW | RW | – | R |

`admin` herda tudo de `sindico` (vamos atualizar `is_sindico` para também aceitar `admin`, ou mais simples: criar `is_admin` e atualizar todas as políticas para `is_admin OR is_sindico`).

UI: filtragem do menu lateral e botões conforme role.

## 3. Preços "Sob consulta"

Reescrever `/precos`:
- 3 planos: Básico (1 empresa, 3 utilizadores), Profissional (1 empresa, 10 utilizadores), Enterprise (utilizadores ilimitados).
- Cada um com badge "Sob consulta" em vez de valor.
- CTA: "Falar com vendas" → /contato (ou WhatsApp).
- Remover qualquer menção a R$/mês na landing e no FAQ.

## 4. Novo fluxo de utilizadores (refazer convites)

Página nova: `/app/usuarios` (substitui parcialmente `/app/moradores` para a gestão interna da equipa; moradores continuam como antes).

Funcionalidades:
- Listagem de utilizadores ativos da empresa (join `user_roles` + `profiles`) com badge do role.
- Botão "Novo utilizador" → modal: Nome, E-mail, Perfil (select com os 7 novos perfis).
- Envio de convite por e-mail usando a infraestrutura de e-mail da Lovable (`scaffold_transactional_email`):
  - Template `convite-empresa` com link `/auth/convite/:token` (rota já existe; reusar `aceitar_convite` RPC).
  - Token gerado no servidor, hash guardado em `convites.token_hash`.
- Reenviar / revogar / alterar role.
- Sidebar: novo item "Utilizadores" (só visível a admin).

Server functions novas em `src/lib/usuarios.functions.ts`:
- `listarUsuarios(empresa_id)` — admin only.
- `convidarUsuario({ empresa_id, nome, email, role })` — admin only, insere convite + dispara email.
- `revogarConvite(id)` / `alterarRole(user_id, role)`.

## Arquivos a tocar (resumo técnico)

- **Migração**: novos valores no enum, função `is_admin`, atualizar políticas RLS principais.
- **Rotas novas**: `src/routes/app.usuarios.tsx`, `src/routes/app.empresa.tsx` (renomear de `app.condominio.tsx`).
- **Server functions**: `src/lib/usuarios.functions.ts`.
- **Email**: setup infra + template `convite-empresa.tsx`.
- **UI rename**: navbar, footer, sidebar, onboarding, landing, /precos, /recursos, /sobre, /contato, /ajuda, todas as labels "condomínio" → "empresa".
- **Auth**: `useCondominio.ts` → adicionar `useEmpresa.ts` (alias) com `isAdmin`, `podeGerirFinanceiro` atualizados.

## Ordem de execução

1. Migração SQL (enum + função `is_admin` + políticas atualizadas).
2. Renomear UI globalmente (condomínio → empresa).
3. Reescrever /precos com "Sob consulta".
4. Criar /app/usuarios + server functions de convite.
5. Setup email infra + template + integrar envio.
6. Atualizar onboarding com novos campos (Responsável, Telefone, Plano).

## Fora do âmbito

- Cobrança/billing real por empresa (continua manual / sob consulta).
- Migrar utilizadores antigos com role `sindico` para `admin` automaticamente (ficam ambos válidos).
- Mexer no schema de `condominios` ou nas rotas de morador/porteiro existentes.
