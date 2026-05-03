
# Plano CONDOZAP — Sistema Profissional para Pequenos Condomínios

Vou portar o HTML atual para uma aplicação real (TanStack Start + Lovable Cloud) e expandir para ser um produto pronto pra vender. Como o escopo é grande, vou entregar em **5 fases sequenciais** — ao fim de cada fase você tem algo funcional para testar.

---

## Visão geral

**Marca:** CONDOZAP — "Gerencie seu condomínio pelo WhatsApp"
**Público:** condomínios de até ~50 unidades, autogestão por síndico morador
**Diferencial:** comunicação 100% via WhatsApp (oficial), preço acessível (R$ 29–59/mês)
**Stack:** TanStack Start, React, Tailwind, Lovable Cloud (Postgres + Auth + Storage), WhatsApp Business API (Meta Cloud)

---

## 🟢 Fase 1 — Landing Page Profissional (entrega imediata)

Reproduzir o visual atual do HTML, mas com páginas reais separadas, SEO, e tudo que falta para parecer um produto sério.

**Páginas:**
- `/` — Home (hero + prova social + recursos resumidos + CTA)
- `/recursos` — Detalhamento de cada módulo com screenshots
- `/precos` — Planos Básico (R$ 29) e Profissional (R$ 59) + FAQ
- `/sobre` — Quem somos, missão, equipe
- `/contato` — Formulário + WhatsApp direto
- `/blog` — Estrutura para conteúdo de SEO ("como ser síndico", "convenção", "LGPD em condomínio")
- `/termos`, `/privacidade`, `/lgpd` — Páginas legais reais (hoje são `href="#"`)
- `/ajuda` — Central de ajuda com artigos
- `/status` — Página pública de uptime

**Elementos novos vs HTML atual:**
- Seção de **depoimentos** (síndicos reais com foto e condomínio)
- **Comparativo** vs concorrentes (TownSq, uCondo, Superlógica)
- **Calculadora de ROI** ("quanto seu condomínio economiza")
- **FAQ** com 10–15 perguntas reais
- **Vídeo demo** de 90s no hero
- **Selos de confiança** (LGPD, SSL, WhatsApp Business oficial)
- Cookies banner (LGPD)
- Schema.org markup para SEO local

---

## 🟡 Fase 2 — Autenticação e Multi-Tenant

Síndico cria conta, cadastra o condomínio, convida moradores.

**Funcionalidades:**
- Cadastro/login com email + senha + Google
- 2FA opcional para síndicos
- Wizard de onboarding em 5 passos (dados do condomínio → unidades via planilha CSV/Excel → moradores → primeira cobrança → convite WhatsApp)
- **Multi-tenant real:** isolamento por `condominio_id` em todas as tabelas, com RLS
- **3 perfis:** Síndico, Morador, Contador
- Convite de moradores por link/WhatsApp
- Recuperação de senha
- Logs de auditoria (quem fez o quê, quando)

**Tabelas principais:** `condominios`, `unidades`, `usuarios`, `user_roles` (em tabela separada conforme padrão de segurança), `audit_log`

---

## 🟠 Fase 3 — Módulo Financeiro Profissional

A espinha dorsal do produto.

**Para o síndico:**
- Dashboard com inadimplência, arrecadação, saldo
- Cadastro de unidades com taxa configurável (fração ideal ou valor fixo)
- **Geração de cobrança mensal** (PIX + boleto registrado)
- Cálculo automático de multa (2%) + juros (1% a.m.) + correção
- Confirmação manual ou automática (conciliação por OFX/CNAB)
- Acordo de parcelamento
- Lançamento de despesas com categorias e comprovantes (Storage)
- Fundo de reserva separado do caixa
- **Prestação de contas mensal** automática (PDF) enviada via WhatsApp dia 5
- Exportação CSV/PDF/OFX para o contador
- Painel do contador com acesso read-only

**Integração de pagamento:** começamos com **PIX via gateway** (Asaas/Iugu/Cora — perguntaremos qual conta você já tem). Boleto registrado entra na Fase 5.

**Para o morador:**
- 2ª via via WhatsApp ("digite BOLETO")
- QR Code PIX no WhatsApp
- Histórico de pagamentos na área logada
- Comprovante por foto via WhatsApp (síndico aprova com 1 clique)

---

## 🔵 Fase 4 — Módulos de Convivência

Os 3 módulos que você pediu, todos integrados ao WhatsApp.

### Reserva de áreas comuns
- Cadastro de áreas (salão, churrasqueira, quadra, piscina) com regras (taxa, antecedência mín/máx, horários, dias bloqueados)
- Calendário visual mensal
- Morador reserva via WhatsApp ("RESERVAR SALÃO 15/06")
- Confirmação automática ou aprovação manual
- Lembrete véspera + checklist devolução
- Histórico e relatório de uso

### Encomendas e visitantes
- Portaria/zelador registra encomenda (foto + remetente)
- Notificação WhatsApp instantânea ao morador
- Morador confirma retirada
- **Liberação de visitantes**: morador autoriza via WhatsApp, visitante recebe QR Code temporário
- Lista de visitantes recorrentes (faxina, jardineiro)
- Log completo para auditoria

### Ocorrências e chamados
- Morador abre via WhatsApp ("PROBLEMA Vazamento na garagem") com foto
- Categorias: manutenção, barulho, segurança, limpeza, outros
- Status: aberta → em andamento → resolvida
- Atribuição a prestador (zelador, terceirizado)
- Nota de satisfação ao fechar
- Relatório mensal de ocorrências para a assembleia

---

## 🟣 Fase 5 — WhatsApp Oficial + Compliance

Tirar a comunicação do nível "demo" e levar a produção real.

- **Migração para WhatsApp Business API (Meta Cloud API)** — número verificado com selo verde
- Templates HSM aprovados pela Meta para cada tipo de mensagem
- Opt-in registrado (LGPD)
- Webhook para receber respostas dos moradores e processar comandos
- Bot conversacional com comandos: BOLETO, PAGUEI, RESERVAR, PROBLEMA, AVISO, AJUDA
- **Boleto bancário registrado** (CNAB 240) além do PIX
- **Conciliação bancária automática** (importação OFX)
- Backup automático diário com restore testado
- Página `/status` pública de uptime
- DPO de contato + relatório LGPD

---

## O que vamos perguntar antes de cada fase

Algumas decisões precisam de você na hora certa (não agora):

- **Fase 3:** qual gateway de pagamento (Asaas, Iugu, Cora, Banco Inter, Efí)?
- **Fase 5:** você já tem conta WhatsApp Business API ou vamos criar?
- **Fase 5:** vamos cobrar a mensalidade do SaaS via Stripe ou Paddle (precisa decidir antes de aceitar pagamentos reais dos clientes)?

---

## Detalhes técnicos (resumo)

```text
Frontend: TanStack Start v1 + React 19 + Tailwind v4 + shadcn/ui
Backend:  TanStack server functions + Lovable Cloud (Supabase)
DB:       Postgres com RLS por condominio_id; roles em tabela separada
Auth:     Supabase Auth (email + Google) + 2FA TOTP
Storage:  Lovable Cloud Storage (comprovantes, atas, documentos)
WhatsApp: Meta Cloud API via webhook em /api/public/whatsapp/webhook
Pagto:    Gateway PIX (a definir) + CNAB para boletos
Cron:     pg_cron chamando /api/public/cron/* (cobranças, lembretes, prestação)
Emails:   Lovable Cloud Emails (recuperação senha, recibos)
```

---

## O que você terá no final

- Site institucional pronto para receber tráfego e vender
- Sistema completo onde síndico cobra, gerencia, comunica e reporta — tudo via WhatsApp
- Morador resolve quase tudo sem instalar app, direto no WhatsApp que já usa
- Contador acessa um painel limpo com tudo exportável
- Compliance LGPD, backups, auditoria, multi-tenant seguro

**Começamos pela Fase 1 (landing profissional)?** Assim você já tem algo para mostrar/divulgar enquanto construímos o sistema por trás.
