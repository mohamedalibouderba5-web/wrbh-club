/**
 * Démarre API + Web WRBH et ouvre le navigateur.
 * Usage:  .\start-wrbh.ps1
 */
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Web = Join-Path $Root "web"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
$Uvicorn = Join-Path $Backend ".venv\Scripts\uvicorn.exe"
$ApiUrl = "http://127.0.0.1:8000"
$WebUrl = "http://127.0.0.1:5173"

function Test-Port($port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", $port)
    $c.Close()
    return $true
  } catch { return $false }
}

if (-not (Test-Path $Python)) {
  Write-Host "Création venv Python 3.13…" -ForegroundColor Yellow
  py -3.13 -m venv (Join-Path $Backend ".venv")
  & $Python -m pip install -r (Join-Path $Backend "requirements.txt")
}

if (-not (Test-Path (Join-Path $Web "node_modules"))) {
  Write-Host "npm install web…" -ForegroundColor Yellow
  Push-Location $Web
  npm install
  Pop-Location
}

if (-not (Test-Path (Join-Path $Backend "wrbh.db"))) {
  Write-Host "Seed base de données…" -ForegroundColor Yellow
  Push-Location $Backend
  $env:PYTHONPATH = "."
  & $Python scripts\seed_import.py
  Pop-Location
}

if (-not (Test-Port 8000)) {
  Write-Host "Démarrage API :$ApiUrl" -ForegroundColor Cyan
  Start-Process -FilePath $Uvicorn -ArgumentList "app.main:app","--host","127.0.0.1","--port","8000" `
    -WorkingDirectory $Backend -WindowStyle Minimized
} else {
  Write-Host "API déjà active sur :8000" -ForegroundColor Green
}

if (-not (Test-Port 5173)) {
  Write-Host "Démarrage Web :$WebUrl" -ForegroundColor Cyan
  Start-Process -FilePath "npm" -ArgumentList "run","start" `
    -WorkingDirectory $Web -WindowStyle Minimized
} else {
  Write-Host "Web déjà actif sur :5173" -ForegroundColor Green
}

Write-Host "Attente des services…" -ForegroundColor Yellow
for ($i = 0; $i -lt 40; $i++) {
  $apiOk = $false
  $webOk = $false
  try { $null = Invoke-WebRequest "$ApiUrl/health" -UseBasicParsing -TimeoutSec 2; $apiOk = $true } catch {}
  try { $null = Invoke-WebRequest $WebUrl -UseBasicParsing -TimeoutSec 2; $webOk = $true } catch {}
  if ($apiOk -and $webOk) { break }
  Start-Sleep -Seconds 1
}

Write-Host "Ouverture navigateur…" -ForegroundColor Green
Start-Process $WebUrl
Write-Host ""
Write-Host "WRBH prêt." -ForegroundColor Green
Write-Host "  Web  $WebUrl"
Write-Host "  API  $ApiUrl/api/docs"
Write-Host "  Login admin@wrbh.local / admin123"
