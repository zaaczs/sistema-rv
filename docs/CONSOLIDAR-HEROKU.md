# Consolidar tudo no Heroku (desligar Vercel e Supabase)

## Situação resolvida

Os dados estavam em **dois bancos**:

| Ambiente | URL do app | Banco |
|----------|------------|-------|
| Vercel (ativo pela cliente) | `sistema-rv.vercel.app` | Supabase |
| Heroku (produção desejada) | `revillefitness-a7c65b026db0.herokuapp.com` | Heroku Postgres |

O Heroku tinha um snapshot antigo (até abril/2026). O Supabase tinha **maio/2026** (18 vendas a mais).

Em **02/06/2026** foi feito restore do backup atual do Supabase para o Heroku Postgres. Contagens conferidas: **144 vendas**, incluindo **18 em maio/2026**.

Backup salvo em: `backups/backup_supabase_2026-06-02T12-25-04.dump`

## O que a cliente deve usar daqui pra frente

**Somente:** https://revillefitness-a7c65b026db0.herokuapp.com/

Não cadastrar mais nada em `sistema-rv.vercel.app` até desligar a Vercel.

## Validar antes de desligar Vercel/Supabase

1. Login no Heroku
2. Dashboard → **Maio / 2026** → deve mostrar faturamento ~R$ 2.027,60 e 24 unidades (conforme Vercel)
3. **Vendas** → listar vendas de 11/05, 13/05, 15/05, 20/05/2026
4. **Relatórios** → mesmo período

## Desligar Vercel (quando validado)

1. [vercel.com](https://vercel.com) → projeto `sistema-rv`
2. **Settings** → **Delete Project** (ou remover domínio e pausar deploys)
3. Opcional: remover integração Git se não for mais usar

## Desligar Supabase (quando validado)

1. [supabase.com](https://supabase.com) → projeto `rhtenjmfxpxxztnaejvp`
2. Fazer **um último backup** manual (já existe cópia local em `backups/`)
3. **Settings** → **Pause project** ou **Delete project**
4. Não apagar antes de confirmar o Heroku por alguns dias

## Repetir migração (se necessário)

Com PostgreSQL 17 instalado e `.env` com `DIRECT_URL` do Supabase:

```powershell
.\scripts\migrate-supabase-to-heroku-native.ps1
```

## Backup automático no Heroku

- Heroku Postgres **Continuous Protection** já está ativo
- Atualize o secret `DATABASE_URL` no GitHub Actions (`.github/workflows/db-backup.yml`) para a URL do **Heroku**, não do Supabase

## Variáveis no Heroku (já configuradas)

- `DATABASE_URL` / `DIRECT_URL` → Heroku Postgres
- `NEXTAUTH_URL` → `https://revillefitness-a7c65b026db0.herokuapp.com/`

Não apontar mais o app para Supabase.
