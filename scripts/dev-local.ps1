param(
  [string]$AdminPassword = "123",
  [string]$AdminUsername = "admin",
  [string]$DataDir = "",
  [switch]$AppOnly,
  [switch]$Help,
  [int]$Port = 47831,
  [switch]$ServerOnly
)

$ErrorActionPreference = "Stop"

function Write-Section([string]$Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function ConvertTo-PowerShellLiteral([string]$Value) {
  return "'" + $Value.Replace("'", "''") + "'"
}

function Test-HttpOk([string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 1
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

if ($Help) {
  Write-Host @"
noteDock local dev launcher

Usage:
  npm run dev:local
  npm run dev:local:server
  npm run dev:local:app

Options:
  -Port 47831
  -AdminUsername admin
  -AdminPassword 123
  -DataDir .local/sync-server-data
  -ServerOnly
  -AppOnly

After startup, configure desktop sync with:
  Server URL: http://127.0.0.1:47831
  Username:   admin
  Password:   123

If you already created a local database, the original admin password is kept.
Delete .local/sync-server-data to reset the local sync server.
"@
  exit 0
}

if ($ServerOnly -and $AppOnly) {
  throw "Use either -ServerOnly or -AppOnly, not both."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $DataDir) {
  $DataDir = Join-Path $repoRoot ".local\sync-server-data"
}

$resolvedDataDir = [System.IO.Path]::GetFullPath($DataDir)
$nodeModules = Join-Path $repoRoot "node_modules"
$healthUrl = "http://127.0.0.1:$Port/api/v1/sync/health"
$syncUrl = "http://127.0.0.1:$Port"
$powerShellExe = (Get-Process -Id $PID).Path

if (-not (Test-Path $nodeModules)) {
  throw "node_modules not found. Run npm install before starting local dev."
}

New-Item -ItemType Directory -Force -Path $resolvedDataDir | Out-Null

Write-Section "noteDock local dev"
Write-Host "Repo:        $repoRoot"
Write-Host "Sync URL:    $syncUrl"
Write-Host "Admin user:  $AdminUsername"
Write-Host "Admin pass:  $AdminPassword"
Write-Host "Data dir:    $resolvedDataDir"

if (-not $AppOnly) {
  if (Test-HttpOk $healthUrl) {
    Write-Host "Sync server is already running at $syncUrl" -ForegroundColor Yellow
  } else {
    Write-Section "Starting sync server"
    $serverCommand = @"
`$Host.UI.RawUI.WindowTitle = 'noteDock sync server';
`$env:NOTEDOCK_SYNC_PORT = '$Port';
`$env:NOTEDOCK_SYNC_DATA_DIR = $(ConvertTo-PowerShellLiteral $resolvedDataDir);
`$env:NOTEDOCK_ADMIN_USERNAME = $(ConvertTo-PowerShellLiteral $AdminUsername);
`$env:NOTEDOCK_ADMIN_PASSWORD = $(ConvertTo-PowerShellLiteral $AdminPassword);
`$env:NOTEDOCK_ALLOW_WEAK_SYNC_PASSWORD = '1';
`$env:NOTEDOCK_SYNC_TOKEN = '';
Set-Location $(ConvertTo-PowerShellLiteral $repoRoot);
npm run sync:server
"@
    Start-Process -FilePath $powerShellExe -WorkingDirectory $repoRoot -ArgumentList @(
      "-NoExit",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      $serverCommand
    )

    $serverReady = $false
    for ($attempt = 1; $attempt -le 50; $attempt += 1) {
      if (Test-HttpOk $healthUrl) {
        $serverReady = $true
        break
      }
      Start-Sleep -Milliseconds 500
    }

    if ($serverReady) {
      Write-Host "Sync server is ready at $syncUrl" -ForegroundColor Green
    } else {
      Write-Host "Sync server window opened, but health check is not ready yet. Check that window for logs." -ForegroundColor Yellow
    }
  }
}

if (-not $ServerOnly) {
  Write-Section "Starting desktop app"
  $appCommand = @"
`$Host.UI.RawUI.WindowTitle = 'noteDock desktop dev';
Set-Location $(ConvertTo-PowerShellLiteral $repoRoot);
npm run dev
"@
  Start-Process -FilePath $powerShellExe -WorkingDirectory $repoRoot -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $appCommand
  )
}

Write-Section "Local sync settings"
Write-Host "Server URL: $syncUrl"
Write-Host "Username:   $AdminUsername"
Write-Host "Password:   $AdminPassword"
Write-Host ""
Write-Host "Use Settings -> Cloud Sync -> account login, then click login and enable sync."
