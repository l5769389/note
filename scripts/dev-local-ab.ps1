param(
  [string]$AdminPassword = "123",
  [string]$AdminUsername = "admin",
  [switch]$Help,
  [switch]$NoBuild,
  [int]$Port = 47831,
  [string]$SessionName = ""
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
noteDock local A/B sync launcher

Usage:
  npm run dev:local:ab
  powershell -ExecutionPolicy Bypass -File scripts/dev-local-ab.ps1 -SessionName manual-test

This starts:
  - one local sync server
  - client A with isolated Electron userData
  - client B with isolated Electron userData

Each client starts without restoring the previous workspace or sync account.
Choose the printed workspace A/B folders manually in the two windows, then log in
with the same account to test cross-client sync.
"@
  exit 0
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$nodeModules = Join-Path $repoRoot "node_modules"
$electronExe = Join-Path $nodeModules "electron\dist\electron.exe"
$powerShellExe = (Get-Process -Id $PID).Path

if (-not (Test-Path $nodeModules)) {
  throw "node_modules not found. Run npm install before starting local A/B sync testing."
}

if (-not $SessionName) {
  $SessionName = "session-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

$sessionRoot = Join-Path $repoRoot ".local\sync-ab-test\$SessionName"
$serverDataDir = Join-Path $sessionRoot "server-data"
$clientAUserData = Join-Path $sessionRoot "client-a-user-data"
$clientBUserData = Join-Path $sessionRoot "client-b-user-data"
$workspaceA = Join-Path $sessionRoot "workspace-a"
$workspaceB = Join-Path $sessionRoot "workspace-b"
$healthUrl = "http://127.0.0.1:$Port/api/v1/sync/health"
$syncUrl = "http://127.0.0.1:$Port"

foreach ($path in @($serverDataDir, $clientAUserData, $clientBUserData, $workspaceA, $workspaceB)) {
  New-Item -ItemType Directory -Force -Path $path | Out-Null
}

Write-Section "noteDock A/B local sync test"
Write-Host "Repo:          $repoRoot"
Write-Host "Session:       $sessionRoot"
Write-Host "Sync URL:      $syncUrl"
Write-Host "Admin user:    $AdminUsername"
Write-Host "Admin pass:    $AdminPassword"
Write-Host "Workspace A:   $workspaceA"
Write-Host "Workspace B:   $workspaceB"

if (-not $NoBuild) {
  Write-Section "Building desktop app and sync server"
  Push-Location $repoRoot
  try {
    npm run build
    npm run build:sync-server
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $electronExe)) {
  throw "Electron executable not found at $electronExe. Run npm install first."
}

if (Test-HttpOk $healthUrl) {
  Write-Host "Sync server is already running at $syncUrl. The script will reuse it." -ForegroundColor Yellow
} else {
  Write-Section "Starting sync server"
  $serverCommand = @"
`$Host.UI.RawUI.WindowTitle = 'noteDock sync server A/B';
`$env:NOTEDOCK_SYNC_PORT = '$Port';
`$env:NOTEDOCK_SYNC_DATA_DIR = $(ConvertTo-PowerShellLiteral $serverDataDir);
`$env:NOTEDOCK_ADMIN_USERNAME = $(ConvertTo-PowerShellLiteral $AdminUsername);
`$env:NOTEDOCK_ADMIN_PASSWORD = $(ConvertTo-PowerShellLiteral $AdminPassword);
`$env:NOTEDOCK_ALLOW_WEAK_SYNC_PASSWORD = '1';
`$env:NOTEDOCK_SYNC_TOKEN = '';
Set-Location $(ConvertTo-PowerShellLiteral $repoRoot);
node out/server/syncServer.js
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

function Start-Client([string]$Name, [string]$UserDataPath) {
  $clientCommand = @"
`$Host.UI.RawUI.WindowTitle = 'noteDock $Name';
`$env:NOTEDOCK_ALLOW_MULTI_INSTANCE = '1';
`$env:NOTEDOCK_TEST_USER_DATA_DIR = $(ConvertTo-PowerShellLiteral $UserDataPath);
`$env:NOTEDOCK_SKIP_INITIAL_APP_STATE_RESTORE = '1';
`$env:NOTEDOCK_SKIP_INITIAL_SYNC_CONFIG_RESTORE = '1';
Set-Location $(ConvertTo-PowerShellLiteral $repoRoot);
& $(ConvertTo-PowerShellLiteral $electronExe) .
"@
  Start-Process -FilePath $powerShellExe -WorkingDirectory $repoRoot -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $clientCommand
  )
}

Write-Section "Starting desktop clients"
Start-Client "client A" $clientAUserData
Start-Client "client B" $clientBUserData

Write-Section "Manual test steps"
Write-Host "1. In client A, open workspace: $workspaceA"
Write-Host "2. In client B, open workspace: $workspaceB"
Write-Host "3. In both clients, configure sync:"
Write-Host "   Server URL: $syncUrl"
Write-Host "   Username:   $AdminUsername"
Write-Host "   Password:   $AdminPassword"
Write-Host "4. Create or edit a file in client A, wait for autosave, then click sync."
Write-Host "5. Click sync in client B, or wait for the 30s poll. The file should appear in workspace B."
