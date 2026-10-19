# TeacherScreen – príprava počítača s Windows na lokálny vývoj s Claude Code.
# Spustenie (PowerShell): powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
# alebo bez stiahnutia repozitára:
#   irm https://raw.githubusercontent.com/Zajo-SK/Teacherscreen/main/scripts/setup-windows.ps1 | iex
$ErrorActionPreference = 'Stop'

function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }

Write-Host "== TeacherScreen: príprava ==" -ForegroundColor Cyan

if (-not (Have git)) {
  Write-Host "Inštalujem Git..." -ForegroundColor Yellow
  winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
  Refresh-Path
}
if (-not (Have node)) {
  Write-Host "Inštalujem Node.js LTS..." -ForegroundColor Yellow
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  Refresh-Path
}

# Ak skript nebeží v repozitári, naklonuje ho do Dokumentov.
$inRepo = (Test-Path package.json) -and ((Get-Content package.json -Raw) -match '"name": "teacherscreen"')
if (-not $inRepo) {
  $target = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Teacherscreen'
  if (-not (Test-Path $target)) {
    Write-Host "Klonujem repozitár do $target ..." -ForegroundColor Yellow
    git clone https://github.com/Zajo-SK/Teacherscreen.git $target
  }
  Set-Location $target
}

Write-Host "Inštalujem závislosti (npm ci)..." -ForegroundColor Yellow
npm ci

Write-Host "Sťahujem Chromium pre e2e testy..." -ForegroundColor Yellow
npx playwright install chromium

if (-not (Test-Path .env.local) -and (Test-Path .env.example)) {
  Copy-Item .env.example .env.local
  Write-Host "Vytvorený .env.local – doplňte VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY (nepovinné)." -ForegroundColor Yellow
}

if (-not (Have claude)) {
  Write-Host "Inštalujem Claude Code..." -ForegroundColor Yellow
  irm https://claude.ai/install.ps1 | iex
  Refresh-Path
}

Write-Host ""
Write-Host "Hotovo. Priečinok projektu: $(Get-Location)" -ForegroundColor Green
Write-Host "Spustenie aplikácie:   npm run dev   (http://localhost:5173)"
Write-Host "Claude Code:           claude"
Write-Host "Pokračovať v cloudovej session:  claude --teleport"
