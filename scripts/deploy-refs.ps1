# Commit + push + remind Manual Deploy Render
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\scripts\deploy-refs.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:GIT_AUTHOR_NAME = "WRBH Club"
$env:GIT_AUTHOR_EMAIL = "club@wrbh.local"
$env:GIT_COMMITTER_NAME = "WRBH Club"
$env:GIT_COMMITTER_EMAIL = "club@wrbh.local"

git add `
  backend/app/services/references.py `
  backend/app/services/fees.py `
  backend/app/api/finance.py `
  backend/app/api/club.py `
  backend/app/api/auth.py `
  backend/app/main.py `
  backend/app/models/__init__.py `
  backend/app/schemas/__init__.py `
  backend/alembic/versions/004_immutable_refs.py `
  web/src/pages/FinancePage.tsx `
  web/src/pages/RegistrationsPage.tsx

# Include other modified related files if present
git add -u backend/app web/src backend/alembic 2>$null

git status --short

git commit -m "Add immutable inscription/finance refs, Excel-like sort, and finance sub-tabs"

git push -u origin HEAD

Write-Host ""
Write-Host "Pushed. Now Manual Deploy on Render:"
Write-Host "  - wrbh-api  (srv-d9h3j004n6ts73ct7h50)"
Write-Host "  - wrbh-web  (srv-d9h3lgrtqb8s73bt7vh0)"
Write-Host "Then check https://wrbh-api.onrender.com/health for version 1.10.0"
