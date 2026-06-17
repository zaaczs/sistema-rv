# Produção somente no Heroku

## URL oficial

**https://revillefitness-a7c65b026db0.herokuapp.com/**

Commits no GitHub **não** fazem deploy automático no Heroku. Deploy manual:

```powershell
heroku login
# use a conta zaccgamer123@gmail.com (dona do app revillefitness)
npm run deploy:heroku
```

Ou: `git push heroku main`

## Por que o commit foi para a Vercel?

O repositório `zaaczs/sistema-rv` estava ligado à integração Vercel no GitHub. Cada `git push origin main` disparava deploy na Vercel.

**Projetos Vercel removidos:** `sistema-rv` e `sistema-rv-d5yb`.

### Evitar deploy na Vercel de novo

1. GitHub → [sistema-rv Settings → Integrations](https://github.com/zaaczs/sistema-rv/settings/installations)
2. Se ainda existir **Vercel**, clique em **Configure** → remova o repositório `sistema-rv` ou desinstale o app

## Supabase

O banco do Supabase **não** é mais usado. Os dados já foram migrados para o Heroku Postgres.

Para apagar o projeto Supabase:

1. [supabase.com/dashboard](https://supabase.com/dashboard) → projeto do Sistema RV
2. **Project Settings** → **General** → **Delete project**
3. Backup local disponível em `backups/backup_supabase_2026-06-02T12-25-04.dump`

## Backup automático

Atualize o secret `DATABASE_URL` no GitHub Actions para a URL do **Heroku Postgres** (não Supabase).

## Conta Heroku

O app `revillefitness` pertence a **zaccgamer123@gmail.com**.  
Se `git push heroku` retornar **403**, faça `heroku logout` e login nessa conta.
