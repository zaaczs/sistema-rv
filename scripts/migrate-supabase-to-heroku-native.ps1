# Migração Supabase -> Heroku usando pg_dump/pg_restore local (PostgreSQL 17)
param(
  [string]$AppName = "revillefitness",
  [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "$PgBin\pg_dump.exe")) {
  throw "Instale PostgreSQL 17 client ou ajuste -PgBin"
}

if (-not $env:DIRECT_URL) {
  $line = Get-Content .env | Where-Object { $_ -match '^DIRECT_URL=' } | Select-Object -First 1
  if ($line -match 'DIRECT_URL="([^"]+)"') { $env:DIRECT_URL = $Matches[1] }
}
if (-not $env:DIRECT_URL) { throw "DIRECT_URL do Supabase não encontrado no .env" }

New-Item -ItemType Directory -Force -Path "backups" | Out-Null
$stamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$dump = "backups\backup_supabase_$stamp.dump"

Write-Host "==> Backup Supabase..."
& "$PgBin\pg_dump.exe" --no-owner --no-acl --format=custom --file=$dump $env:DIRECT_URL

$dbUrl = heroku config:get DATABASE_URL -a $AppName
Write-Host "==> Restore no Heroku (avisos de extensões Supabase são normais)..."
& "$PgBin\pg_restore.exe" --clean --if-exists --no-owner --no-acl --dbname $dbUrl $dump
# pg_restore costuma retornar 1 por extensões Supabase; validar contagens abaixo

Write-Host "==> prisma db push no Heroku..."
$env:DATABASE_URL = $dbUrl
$env:DIRECT_URL = $dbUrl
npx prisma db push --accept-data-loss

$env:SOURCE_DATABASE_URL = $env:DIRECT_URL
$env:TARGET_DATABASE_URL = $dbUrl
# Re-ler Supabase do .env para comparação
$line = Get-Content .env | Where-Object { $_ -match '^DIRECT_URL=' } | Select-Object -First 1
if ($line -match 'DIRECT_URL="([^"]+)"') { $env:SOURCE_DATABASE_URL = $Matches[1] }
node scripts/compare-databases.mjs

Write-Host "`nConcluído. Valide: https://revillefitness-a7c65b026db0.herokuapp.com (maio/2026)"
