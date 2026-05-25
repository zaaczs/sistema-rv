# Setup Heroku Postgres + config vars — Windows PowerShell
# Executar APÓS: heroku login (conta zaccgamer123@gmail.com)
param(
  [string]$AppName = "revillefitness"
)

Write-Host "==> App: $AppName"

Write-Host "==> Adicionando Heroku Postgres (essential-0)..."
heroku addons:create heroku-postgresql:essential-0 -a $AppName 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "(addon pode já existir — continuando)" }

$dbUrl = heroku config:get DATABASE_URL -a $AppName
if (-not $dbUrl) { throw "DATABASE_URL não encontrada. Adicione o addon Postgres primeiro." }

Write-Host "==> Config vars..."
heroku config:set DIRECT_URL="$dbUrl" -a $AppName

$secret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
heroku config:set NEXTAUTH_SECRET="$secret" -a $AppName

$herokuUrl = "https://${AppName}.herokuapp.com"
heroku config:set NEXTAUTH_URL="$herokuUrl" -a $AppName

Write-Host "==> Remote git Heroku..."
heroku git:remote -a $AppName

Write-Host "`n==> Config atual:"
heroku config -a $AppName

Write-Host @"

Próximos passos:
  1. `$env:DIRECT_URL='postgresql://...supabase...'; npm run db:backup:docker
  2. `$env:RESTORE_DATABASE_URL='$dbUrl'; npm run db:restore:docker -- backups\backup_prod_XXXX.dump
  3. git push heroku main
"@
