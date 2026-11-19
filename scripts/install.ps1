# MoneyTrack installer for Windows (PowerShell 5.1+ or PowerShell 7).
#
#   .\scripts\install.ps1              # install dependencies, create DB, build
#   .\scripts\install.ps1 -Seed        # also load demo user + 90 days of data
#   .\scripts\install.ps1 -NoBuild     # skip the production bundle
#
# If script execution is blocked, run once:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

[CmdletBinding()]
param(
  [switch]$Seed,
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Say($msg) { Write-Host "> $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "x $msg" -ForegroundColor Red; exit 1 }

try {
  $nodeVersion = (& node -v).Trim()
} catch {
  Fail 'Node.js is not installed. Install Node 20+ from https://nodejs.org'
}

$major = [int](($nodeVersion -replace '^v', '').Split('.')[0])
if ($major -lt 20) { Fail "Node 20+ is required (found $nodeVersion)." }
Say "Node $nodeVersion detected"

Say 'Installing npm dependencies (this can take a few minutes)...'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }

Say 'Creating / syncing the SQLite database...'
npm run db:push
if ($LASTEXITCODE -ne 0) { Fail 'Database setup failed.' }

if ($Seed) {
  Say 'Loading demo user and 90 days of transactions...'
  npm run db:seed
} else {
  Warn "Skipped demo data. Run 'npm run db:seed' for demo/demo123."
}

if (-not $NoBuild) {
  Say 'Building the production bundle...'
  npm run build
  if ($LASTEXITCODE -ne 0) { Fail 'Build failed.' }
}

Write-Host ""
Write-Host "Installation complete." -ForegroundColor Green
Write-Host ""
Write-Host "Start the app:"
Write-Host "  .\scripts\moneytrack.ps1 start"
Write-Host "  .\scripts\moneytrack.ps1 status"
Write-Host "  .\scripts\moneytrack.ps1 stop"
Write-Host ""
Write-Host "Then open http://localhost:4000"
Write-Host "The first account you create becomes the administrator."
