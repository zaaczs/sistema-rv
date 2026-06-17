# Deploy para Heroku (único ambiente de produção)
# Requer: heroku login com a conta dona do app revillefitness (zaccgamer123@gmail.com)
param(
  [string]$AppName = "revillefitness",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$who = heroku auth:whoami 2>&1
Write-Host "Heroku: $who"

git push heroku "${Branch}:main"
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Se aparecer 403, faça login na conta correta:"
  Write-Host "  heroku logout"
  Write-Host "  heroku login"
  Write-Host "  (use zaccgamer123@gmail.com — dono do app revillefitness)"
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy concluído. Abra:"
heroku apps:info -a $AppName | Select-String "Web URL"
