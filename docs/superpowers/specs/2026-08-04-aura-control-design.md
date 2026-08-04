# Aura Control — Design Spec
**Data:** 2026-08-04  
**Status:** Aprovado

---

## Visão Geral

Sistema interno de controle financeiro e organizacional para a agência Aura MKT.CLUB. Usado por 3 pessoas (sócios) com acesso total e sem diferenciação de papéis. Objetivo central: fonte única de verdade para clientes, receita, contratos e metas.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Banco de Dados | Supabase (Postgres) |
| Autenticação | Supabase Auth (email/senha, sem sign-up público) |
| Deploy | Vercel (frontend) + Supabase cloud (banco) |
| Testes | Playwright |

Tudo no free tier — zero custo operacional.

---

## Arquitetura

```
aura-control/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # sidebar + proteção de rota
│   │   ├── page.tsx            # Dashboard
│   │   ├── clientes/
│   │   │   └── page.tsx
│   │   ├── financeiro/
│   │   │   └── page.tsx
│   │   └── metas/
│   │       └── page.tsx
│   └── api/
│       ├── clients/
│       ├── services/
│       ├── charges/
│       └── goals/
├── components/
│   ├── ui/                     # shadcn primitives
│   ├── layout/                 # sidebar, topbar
│   └── domain/                 # ClientSheet, ChargeRow, GoalCard…
├── lib/
│   ├── supabase/               # client, server, types gerados
│   └── utils/                  # formatadores BRL, cálculo MRR
└── supabase/
    └── migrations/
```

**Fluxo de dados:** Next.js middleware verifica sessão Supabase → redireciona para `/login` se não autenticado → telas chamam API Routes → API Routes acessam Postgres com Supabase server client (service role) → RLS como segunda camada de segurança.

---

## Modelo de Dados

```sql
-- Clientes
CREATE TABLE clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text,
  phone       text,
  status      text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','encerrado')),
  started_at  date NOT NULL,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Histórico de mudanças de status
CREATE TABLE client_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text NOT NULL,
  note        text,
  changed_at  timestamptz DEFAULT now()
);

-- Serviços/contratos por cliente
CREATE TABLE services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('recorrente','avulso')),
  amount      numeric(12,2) NOT NULL,
  recurrence  text CHECK (recurrence IN ('mensal','trimestral','anual','único')),
  started_at  date NOT NULL,
  ended_at    date,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Cobranças (mensalidades geradas + projetos avulsos)
CREATE TABLE charges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES services(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  due_date    date NOT NULL,
  paid_at     timestamptz,
  status      text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado')),
  created_at  timestamptz DEFAULT now()
);

-- Metas
CREATE TABLE goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period       text NOT NULL,   -- ex: '2026-08' ou '2026-Q3'
  type         text NOT NULL CHECK (type IN ('mrr','clientes')),
  target_value numeric(12,2) NOT NULL,
  created_at   timestamptz DEFAULT now()
);
```

**Cálculos em runtime (não persistidos):**
- **MRR:** soma de `services.amount` onde `type = 'recorrente'` e `active = true`
- **Receita estimada do mês:** soma de `charges.amount` onde `due_date` no mês
- **Receita realizada:** soma de `charges.amount` onde `paid_at` no mês
- **Inadimplência:** `charges` onde `due_date < hoje` e `paid_at IS NULL`

**RLS:** todas as tabelas com `authenticated` tendo acesso total (não há dados de outros tenants — sistema single-tenant).

---

## Telas

### 1. Login `/login`
- Tela centralizada, fundo `#111111`
- Logo "a." grande, campo email + senha, botão "Entrar"
- Sem link de cadastro (acesso restrito)
- Erro claro se credencial inválida

### 2. Dashboard `/`
- **4 KPI cards:** Clientes Ativos | MRR Atual | Receita do Mês (estimada vs. realizada) | Inadimplentes
- **Gráfico de linha:** evolução de receita realizada nos últimos 6 meses
- **Tabela:** cobranças pendentes com vencimento nos próximos 7 dias

### 3. Clientes `/clientes`
- Tabela com colunas: Nome, Status, Serviços Ativos, MRR do Cliente, Desde
- Filtro por status (ativo/pausado/encerrado), busca por nome
- Clique na linha abre `Sheet` lateral com:
  - Dados do cliente (editável inline)
  - Lista de serviços com valores
  - Histórico de status
  - Botão "Novo Serviço"
- Botão "+ Novo Cliente" abre modal de criação

### 4. Financeiro `/financeiro`
- Seletor de mês no topo
- Resumo: Estimado | Recebido | Pendente | Atrasado
- Lista de cobranças do mês com botão "Marcar como pago" inline
- Badge de status visual: pendente (cinza) | pago (verde) | atrasado (vermelho)
- Botão "+ Nova Cobrança" para lançamentos manuais

### 5. Metas `/metas`
- Cards por período com barra de progresso (meta MRR e meta de clientes)
- Porcentagem de atingimento em destaque
- Botão "+ Nova Meta"
- Comparativo simples: meta vs. realizado atual

---

## Design System

| Token | Valor |
|---|---|
| Fundo principal | `#111111` |
| Fundo card/surface | `#1a1a1a` |
| Borda sutil | `#2a2a2a` |
| Texto principal | `#f0eeea` |
| Texto secundário | `#888888` |
| Acento roxo | `#7c3aed` |
| Verde (pago) | `#22c55e` |
| Vermelho (atrasado) | `#ef4444` |
| Fonte | Inter |

**Princípios:** espaço em branco generoso, sem sombras exageradas, sem gradientes desnecessários, bordas `1px` sutis, tipografia fazendo o trabalho visual.

---

## Auth

- Supabase Auth, email/senha
- Apenas emails pré-cadastrados no painel Supabase conseguem logar
- Sem sign-up público — novos usuários adicionados manualmente no Supabase Dashboard
- Middleware Next.js protege todas as rotas `/(dashboard)/*`

---

## Contratos com tipos mistos

- Cada cliente pode ter N serviços
- Serviço `recorrente` com `recurrence = 'mensal'` gera cobranças mensais
- Serviço `avulso` gera uma cobrança única
- Geração de cobranças: manual via UI (não automática por cron — mantém simples)

---

## O que está fora do escopo (v1)

- Integração bancária automática
- Relatórios exportáveis (PDF/Excel)
- Notificações por email de vencimento
- Multi-tenancy
- App mobile nativo

---

## Testes

Playwright cobrindo:
1. Fluxo de login e redirecionamento
2. CRUD completo de cliente
3. Criação de serviço e geração de cobrança
4. Marcar cobrança como paga e verificar totais no dashboard
5. Criação e progresso de meta
