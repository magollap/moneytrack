# Start / stop / status for MoneyTrack on Windows.
#
#   .\scripts\moneytrack.ps1 start
#   .\scripts\moneytrack.ps1 stop
#   .\scripts\moneytrack.ps1 restart
#   .\scripts\moneytrack.ps1 status
#   .\scripts\moneytrack.ps1 logs
#
# If script execution is blocked, run once:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start','stop','restart','status','logs')]
  [string]$Action = 'status',
  [int]$Port = 4000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pidFile = Join-Path $root '.moneytrack.pid'
$logDir = Join-Path $root 'logs'
$logFile = Join-Path $logDir 'moneytrack.log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Get-RunningPid {
  if (-not (Test-Path $pidFile)) { return $null }
  $raw = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $raw) { return $null }
  $process = Get-Process -Id ([int]$raw) -ErrorAction SilentlyContinue
  if ($process) { return $process.Id }
  return $null
}

function Start-MoneyTrack {
  $running = Get-RunningPid
  if ($running) {
    Write-Host "! Already running (pid $running, port $Port)." -ForegroundColor Yellow
    return
  }

  $env:PORT = "$Port"
  Write-Host "> Starting MoneyTrack on port $Port..." -ForegroundColor Green
  $process = Start-Process -FilePath 'node' `
    -ArgumentList 'server.js' `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError $logFile `
    -PassThru

  $process.Id | Out-File -FilePath $pidFile -Encoding ascii
  Start-Sleep -Seconds 2
  if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
    Write-Host "> Running (pid $($process.Id)). Open http://localhost:$Port" -ForegroundColor Green
  } else {
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "x Failed to start. Check $logFile" -ForegroundColor Red
  }
}

function Stop-MoneyTrack {
  $running = Get-RunningPid
  if (-not $running) {
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "! MoneyTrack is not running." -ForegroundColor Yellow
    return
  }
  Write-Host "> Stopping pid $running..." -ForegroundColor Green
  Stop-Process -Id $running -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  Write-Host "> Stopped." -ForegroundColor Green
}

function Get-Status {
  $running = Get-RunningPid
  if ($running) {
    Write-Host "> MoneyTrack is RUNNING (pid $running, port $Port)." -ForegroundColor Green
    try {
      $response = Invoke-RestMethod -Uri "http://localhost:$Port/api/v1/system/status" -TimeoutSec 5
      $response | ConvertTo-Json -Compress
    } catch {
      Write-Host "! Process is up but the API did not respond yet." -ForegroundColor Yellow
    }
  } else {
    Write-Host "! MoneyTrack is STOPPED." -ForegroundColor Yellow
  }
}

switch ($Action) {
  'start'   { Start-MoneyTrack }
  'stop'    { Stop-MoneyTrack }
  'restart' { Stop-MoneyTrack; Start-MoneyTrack }
  'status'  { Get-Status }
  'logs'    { Get-Content $logFile -Tail 100 -Wait }
}
