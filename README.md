# Sistema RV — Moda Fitness (Varejo + Atacado)

Sistema web MVP para loja de moda fitness: cadastro de produtos/SKUs, clientes, vendas (varejo e atacado), controle de estoque, relatórios mensais e importação CSV.

## Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes
- **ORM:** Prisma
- **Banco:** PostgreSQL
- **Auth:** NextAuth (Credentials) + bcrypt

## Pré-requisitos

- Node.js 20+ (recomendado; no Node 21 use Prisma 5)
- PostgreSQL
- npm

## Setup

1. **Clone e instale dependências**

   ```bash
   cd "Sistema RV"
   npm install
   ```

2. **Configure o `.env`**

   Crie o arquivo `.env` na raiz do projeto (copie de `.env.example`) e preencha:

   ```env
   # PostgreSQL — use USUARIO e SENHA reais do seu PostgreSQL
   DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/NOME_DO_BANCO?schema=public"

   # NextAuth — obrigatório (sem isso o login falha com "Configuration")
   NEXTAUTH_SECRET="gere-uma-string-aleatoria-longa-aqui"
   NEXTAUTH_URL="http://localhost:3000"
   ```

   **Importante:** Se aparecer erro de autenticação do Prisma (`johndoe` não válido), o `DATABASE_URL` ainda está com credenciais de exemplo. Substitua `USUARIO` e `SENHA` pelo usuário e senha reais do seu PostgreSQL (ex.: `postgres` / `postgres`).

3. **Crie as tabelas e rode o seed**

   ```bash
   npx prisma db push
   npm run db:seed
   ```

   Ou, se preferir migrations:

   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

4. **Inicie o servidor**

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000). Faça login com:

   - **E-mail:** admin@gmail.com  
   - **Senha:** 123456  

   (Altere a senha em produção.)

## Scripts

| Comando        | Descrição                |
|----------------|--------------------------|
| `npm run dev`  | Servidor de desenvolvimento |
| `npm run build`| Build de produção        |
| `npm run start`| Inicia em produção      |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:push`     | Sincroniza schema com o banco |
| `npm run db:migrate`  | Cria e aplica migrations |
| `npm run db:seed`     | Popula admin, categorias e coleção |
| `npm run db:studio`   | Abre Prisma Studio      |

## Funcionalidades (MVP)

- **Login** — 1 usuário admin
- **Dashboard** — Faturamento, lucro líquido e unidades do mês + comparativo com mês anterior
- **Produtos / SKUs** — Listagem com busca e filtros; criar/editar SKU (estoque, preços varejo/atacado)
- **Estoque de Produtos** — Visão e controle de entradas/saídas por SKU, ajuste manual de quantidade e validação para não permitir estoque negativo
- **Clientes** — CRUD e busca por nome/telefone
- **Vendas** — Registrar venda: canal (varejo/atacado), cliente, pagamento, taxa de cartão (%), itens por SKU; validação de mínimo 5 peças no atacado e estoque; baixa automática de estoque
- **Relatórios** — Mensal por canal, ranking (unidades e lucro), exportar CSV
- **Importar** — CSV de produtos (layout padrão: skuCode, productName, category, collection, color, size, costPrice, retailPrice, wholesalePrice, stockQty, active)

## Módulo de Estoque de Produtos

O módulo de estoque permite acompanhar a disponibilidade dos SKUs e manter o saldo correto dos itens em tempo real:

- Consulta de quantidade atual por SKU
- Ajuste manual de estoque (correções de inventário)
- Baixa automática a cada venda concluída
- Bloqueio de venda quando não houver saldo suficiente
- Atualização em lote via importação CSV de produtos

## Layout CSV (importação de produtos)

Colunas obrigatórias (separador `;` ou `,`):

- `skuCode` (único)
- `productName`
- `category`
- `collection`
- `color`
- `size` (P, M ou G)
- `costPrice`, `retailPrice`, `wholesalePrice` (≥ 0)
- `stockQty` (≥ 0)
- `active` (true/false)

## Critérios de aceite (resumo)

- Admin loga e acessa o sistema
- Cadastro de SKU com estoque
- Controle de estoque por SKU (consulta e ajuste)
- Cadastro de cliente
- Venda varejo registrada e estoque baixado
- Venda atacado com &lt; 5 peças bloqueada
- Venda atacado com ≥ 5 peças registrada e estoque baixado
- Dashboard com faturamento, lucro líquido, unidades e comparativo
- Importação de produtos via CSV com validação
- Export CSV do relatório mensal

---

## Solução de problemas

### Erro P1000 (autenticação do banco)
`Authentication failed... credentials for johndoe are not valid`

O `.env` ainda está com credenciais de exemplo. Edite o `DATABASE_URL` e use o usuário e senha reais do PostgreSQL:
- Exemplo padrão: `postgresql://postgres:postgres@localhost:5432/sistema_rv?schema=public` (se usuário `postgres` e senha `postgres`)

### Erro NO_SECRET no NextAuth
`[next-auth][error][NO_SECRET]` e `GET /api/auth/error?error=Configuration 500`

Adicione no `.env`:
```
NEXTAUTH_SECRET="qualquer-string-longa-e-aleatoria"
NEXTAUTH_URL="http://localhost:3000"
```
Para gerar um secret, use: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

### Aviso de múltiplos lockfiles
Se aparecer aviso sobre lockfiles, rode `npm run dev` a partir da pasta do projeto `Sistema RV` (não de outra pasta).

---

Documentação completa na especificação do projeto (backlog e regras de negócio).
