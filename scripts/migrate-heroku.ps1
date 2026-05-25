# Migração completa Supabase -> Heroku (revillefitness)
# PRÉ-REQUISITO: heroku login (conta zaccgamer123@gmail.com) no MESMO terminal
param(
  [string]$AppName = "revillefitness",
  [string]$DirectUrl = $env:DIRECT_URL,
  [string]$BackupDump = ""
)

$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
if (-not (Test-Path "$pgBin\pg_dump.exe")) {
  throw "pg_dump não encontrado em $pgBin"
}

if (-not $DirectUrl) {
  throw "Defina DIRECT_URL antes de executar."
}

$whoami = heroku auth:whoami 2>&1
Write-Host "Heroku logado como: $whoami"
heroku apps:info -a $AppName | Out-Null

Write-Host "`n==> 1/5 Backup Supabase (somente leitura)..."
New-Item -ItemType Directory -Force -Path "backups" | Out-Null
if (-not $BackupDump -or -not (Test-Path $BackupDump)) {
  $stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss")
  $BackupDump = "backups\backup_prod_$stamp.dump"
  $backupSql = "backups\backup_prod_$stamp.sql"
  & "$pgBin\pg_dump.exe" --no-owner --no-acl --format=custom --file=$BackupDump $DirectUrl
  & "$pgBin\pg_dump.exe" --no-owner --no-acl --format=plain --file=$backupSql $DirectUrl
  Write-Host "Backup: $BackupDump"
} else {
  Write-Host "Usando backup existente: $BackupDump"
}

Write-Host "`n==> 2/5 Heroku Postgres + config vars..."
heroku addons:create heroku-postgresql:essential-0 -a $AppName 2>$null
$dbUrl = heroku config:get DATABASE_URL -a $AppName
if (-not $dbUrl) { throw "DATABASE_URL do Heroku não encontrada." }

heroku config:set DIRECT_URL="$dbUrl" -a $AppName | Out-Null
$secret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
heroku config:set NEXTAUTH_SECRET="$secret" -a $AppName | Out-Null
heroku config:set NEXTAUTH_URL="https://${AppName}.herokuapp.com" -a $AppName | Out-Null
heroku git:remote -a $AppName 2>$null

Write-Host "`n==> 3/5 Restore no Heroku (altera SOMENTE banco destino)..."
& "$pgBin\pg_restore.exe" --clean --if-exists --no-owner --no-acl --dbname $dbUrl $BackupDump
if ($LASTEXITCODE -ne 0) {
  Write-Host "pg_restore retornou avisos/código $LASTEXITCODE (comum com --clean). Validando contagens..."
}

Write-Host "`n==> 4/5 Smoke test no Heroku..."
$tables = @("User","Product","Sale","Customer","Sku","Insumo")
foreach ($t in $tables) {
  $sql = 'SELECT COUNT(*) FROM "' + $t + '";'
  $count = & "$pgBin\psql.exe" $dbUrl -t -A -c $sql
  Write-Host "$t=$count"
}

Write-Host "`n==> 5/5 Deploy..."
Write-Host "Execute manualmente se ainda não fez commit/push:"
Write-Host "  git add Procfile package.json scripts/"
Write-Host "  git commit -m `"Preparar deploy Heroku`""
Write-Host "  git push heroku main"
Write-Host "`nMigração de dados concluída. App: https://${AppName}.herokuapp.com"
