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
| `npm run db:backup`   | Gera backup `.sql` em `backups/` com retenção |
| `npm run db:restore -- backups/arquivo.sql` | Restaura backup em `RESTORE_DATABASE_URL` |
| `npm run db:backup:verify` | Executa backup + restore de validação |

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

## Segurança e proteção de dados

Camadas já aplicadas no sistema:

- Autenticação obrigatória com NextAuth em páginas privadas e APIs
- Sessão JWT com renovação periódica e secret obrigatório em produção
- Proteção contra tentativa de força bruta no login (bloqueio por tentativas seguidas)
- Headers HTTP de segurança no proxy (`X-Frame-Options`, `HSTS`, `nosniff`, `Referrer-Policy`, etc.)
- Prisma com retry para falhas transitórias de conexão
- Soft delete para vendas, clientes e insumos (evita remoção física imediata)
- Log de auditoria para ações críticas (criação, edição, exclusão e importação)
- Transações Prisma em operações sensíveis de venda, estoque e importação

Boas práticas para não perder dados cadastrados:

1. Habilitar backup automático e Point-In-Time Recovery no provedor do PostgreSQL (Supabase/Neon/RDS).
2. Executar backup manual recorrente com:
   ```bash
   npm run db:backup
   ```
3. Configurar variáveis opcionais de backup:
   - `BACKUP_RETENTION_DAYS` (padrão 14)
   - `BACKUP_MIRROR_DIR` (espelho local/rede)
   - `RESTORE_DATABASE_URL` (banco dedicado para teste de restore)
4. Validar restauração periodicamente em ambiente de homologação:
   ```bash
   npm run db:backup:verify
   ```
5. Guardar backups em armazenamento externo (S3/Drive) com retenção (ex.: diário 15 dias + semanal 8 semanas).
6. Nunca executar comandos destrutivos em produção sem backup válido do dia.

### Rotina agendada de backup

O repositório inclui workflow em `.github/workflows/db-backup.yml`:

- Executa diariamente (cron) e também manualmente (`workflow_dispatch`)
- Roda `npm run db:backup`
- Salva artefato do backup no GitHub Actions

Para funcionar, configure o secret `DATABASE_URL` no GitHub do projeto.

> Importante: nenhum sistema garante risco zero sem rotina de backup + teste de restauração.  
> O projeto agora está mais protegido na aplicação, mas a garantia de continuidade depende também da política de backup do banco.

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
