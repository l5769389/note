#!/usr/bin/env bash

set -euo pipefail

ADMIN_PASSWORD="123"
ADMIN_USERNAME="admin"
ALLOW_SELF_SIGNED_CLOUD_CERT=0
CLOUD_PASSWORD=""
CLOUD_SERVER_URL="https://sync.zhaolin.online"
CLOUD_USERNAME="admin"
DATA_DIR=""
APP_ONLY=0
DEVTOOLS=0
FRESH_USER_DATA=0
HELP=0
PORT=47831
SERVER_ONLY=0

write_section() {
  printf "\n== %s ==\n" "$1"
}

usage() {
  cat <<'EOF'
noteDock local dev launcher for macOS

Usage:
  npm run dev:local:mac
  npm run dev:local:mac:server
  npm run dev:local:mac:app
  npm run dev:local:mac:app:debug

Options:
  --port 47831
  --admin-username admin
  --admin-password 123
  --cloud-server-url https://sync.zhaolin.online
  --cloud-username admin
  --cloud-password <cloud-password>
  --allow-self-signed-cloud-cert
  --data-dir .local/sync-server-data
  --devtools
  --fresh-user-data
  --server-only
  --app-only

After startup, configure desktop sync with:
  Server URL: http://127.0.0.1:47831
  Username:   admin
  Password:   123

Cloud sync test settings:
  Server URL: https://sync.zhaolin.online
  Username:   admin
  Password:   pass with --cloud-password

If you already created a local database, the original admin password is kept.
Delete .local/sync-server-data to reset the local sync server.
EOF
}

read_arg_value() {
  local name="$1"
  local value="${2:-}"

  if [[ -z "$value" ]]; then
    printf "Missing value for %s\n" "$name" >&2
    exit 1
  fi

  printf "%s" "$value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin-password|--AdminPassword|-AdminPassword)
      ADMIN_PASSWORD="$(read_arg_value "$1" "${2:-}")"
      shift 2
      ;;
    --admin-password=*)
      ADMIN_PASSWORD="${1#*=}"
      shift
      ;;
    --admin-username|--AdminUsername|-AdminUsername)
      ADMIN_USERNAME="$(read_arg_value "$1" "${2:-}")"
      shift 2
      ;;
    --admin-username=*)
      ADMIN_USERNAME="${1#*=}"
      shift
      ;;
    --allow-self-signed-cloud-cert|--AllowSelfSignedCloudCert|-AllowSelfSignedCloudCert)
      ALLOW_SELF_SIGNED_CLOUD_CERT=1
      shift
      ;;
    --cloud-password|--CloudPassword|-CloudPassword)
      CLOUD_PASSWORD="$(read_arg_value "$1" "${2:-}")"
      shift 2
      ;;
    --cloud-password=*)
      CLOUD_PASSWORD="${1#*=}"
      shift
      ;;
    --cloud-server-url|--CloudServerUrl|-CloudServerUrl)
      CLOUD_SERVER_URL="$(read_arg_value "$1" "${2:-}")"
      shift 2
      ;;
    --cloud-server-url=*)
      CLOUD_SERVER_URL="${1#*=}"
      shift
      ;;
    --cloud-username|--CloudUsername|-CloudUsername)
      CLOUD_USERNAME="$(read_arg_value "$1" "${2:-}")"
      shift 2
      ;;
    --cloud-username=*)
      CLOUD_USERNAME="${1#*=}"
      shift
      ;;
    --data-dir|--DataDir|-DataDir)
      DATA_DIR="$(read_arg_value "$1" "${2:-}")"
      shift 2
      ;;
    --data-dir=*)
      DATA_DIR="${1#*=}"
      shift
      ;;
    --app-only|--AppOnly|-AppOnly)
      APP_ONLY=1
      shift
      ;;
    --devtools|--DevTools|-DevTools)
      DEVTOOLS=1
      shift
      ;;
    --fresh-user-data|--FreshUserData|-FreshUserData)
      FRESH_USER_DATA=1
      shift
      ;;
    --help|-h|--Help|-Help)
      HELP=1
      shift
      ;;
    --port|--Port|-Port)
      PORT="$(read_arg_value "$1" "${2:-}")"
      shift 2
      ;;
    --port=*)
      PORT="${1#*=}"
      shift
      ;;
    --server-only|--ServerOnly|-ServerOnly)
      SERVER_ONLY=1
      shift
      ;;
    *)
      printf "Unknown option: %s\n\n" "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$HELP" -eq 1 ]]; then
  usage
  exit 0
fi

if [[ "$SERVER_ONLY" -eq 1 && "$APP_ONLY" -eq 1 ]]; then
  printf "Use either --server-only or --app-only, not both.\n" >&2
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  printf "Port must be a number: %s\n" "$PORT" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf "npm was not found. Install Node.js before starting local dev.\n" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  printf "curl was not found. macOS normally includes it; please install curl first.\n" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
NODE_MODULES="$REPO_ROOT/node_modules"
HEALTH_URL="http://127.0.0.1:$PORT/api/v1/sync/health"
SYNC_URL="http://127.0.0.1:$PORT"
LOG_DIR="$REPO_ROOT/.local/logs"
SERVER_LOG="$LOG_DIR/sync-server.log"
DEV_ELECTRON_DIST="$REPO_ROOT/.local/dev-electron/dist"
DEV_ELECTRON_APP="$DEV_ELECTRON_DIST/Electron.app"
DEV_ELECTRON_STAMP="$DEV_ELECTRON_DIST/.notedock-dev-electron-stamp"
SERVER_PID=""
SERVER_STARTED_BY_SCRIPT=0

if [[ -z "$DATA_DIR" ]]; then
  DATA_DIR="$REPO_ROOT/.local/sync-server-data"
fi

if [[ ! -d "$NODE_MODULES" ]]; then
  printf "node_modules not found. Run npm install before starting local dev.\n" >&2
  exit 1
fi

mkdir -p "$DATA_DIR" "$LOG_DIR"
RESOLVED_DATA_DIR="$(cd "$DATA_DIR" && pwd -P)"

test_http_ok() {
  curl -fsS --max-time 1 "$1" >/dev/null 2>&1
}

stop_started_server() {
  if [[ "$SERVER_STARTED_BY_SCRIPT" -eq 1 && -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    printf "\nStopping sync server...\n"
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap stop_started_server EXIT INT TERM

print_sync_settings() {
  write_section "Local sync settings"
  printf "Server URL: %s\n" "$SYNC_URL"
  printf "Username:   %s\n" "$ADMIN_USERNAME"
  printf "Password:   %s\n" "$ADMIN_PASSWORD"
  write_section "Cloud sync settings"
  printf "Server URL: %s\n" "$CLOUD_SERVER_URL"
  printf "Username:   %s\n" "$CLOUD_USERNAME"
  if [[ -n "$CLOUD_PASSWORD" ]]; then
    printf "Password:   %s\n" "$CLOUD_PASSWORD"
  else
    printf "Password:   <pass with --cloud-password>\n"
  fi
  if [[ "$ALLOW_SELF_SIGNED_CLOUD_CERT" -eq 1 ]]; then
    printf "TLS:        self-signed certificate allowed for this dev app session\n"
  else
    printf "TLS:        normal certificate validation\n"
  fi
  printf "\nUse Settings -> Cloud Sync -> account login, then click login and enable sync.\n"
}

prepare_dev_electron_app() {
  local source_app="$NODE_MODULES/electron/dist/Electron.app"
  local source_icon="$REPO_ROOT/resources/icon.icns"
  local target_icon="$DEV_ELECTRON_APP/Contents/Resources/electron.icns"
  local plist_path="$DEV_ELECTRON_APP/Contents/Info.plist"
  local electron_version
  local icon_fingerprint
  local desired_stamp

  if [[ ! -d "$source_app" ]]; then
    printf "Electron.app was not found at %s\n" "$source_app" >&2
    exit 1
  fi

  if [[ ! -f "$source_icon" ]]; then
    printf "macOS icon was not found at %s\n" "$source_icon" >&2
    exit 1
  fi

  electron_version="$(cd "$REPO_ROOT" && node -p "require('./node_modules/electron/package.json').version")"
  icon_fingerprint="$(stat -f "%m:%z" "$source_icon")"
  desired_stamp="electron=$electron_version icon=$icon_fingerprint app=noteDock"

  if [[ -f "$DEV_ELECTRON_STAMP" && -x "$DEV_ELECTRON_APP/Contents/MacOS/Electron" ]]; then
    if [[ "$(cat "$DEV_ELECTRON_STAMP")" == "$desired_stamp" ]]; then
      export ELECTRON_OVERRIDE_DIST_PATH="$DEV_ELECTRON_DIST"
      printf "Dev Electron shell: %s\n" "$DEV_ELECTRON_APP"
      return
    fi
  fi

  rm -rf "$DEV_ELECTRON_DIST"
  mkdir -p "$DEV_ELECTRON_DIST"
  cp -R "$source_app" "$DEV_ELECTRON_APP"
  cp "$source_icon" "$target_icon"

  /usr/libexec/PlistBuddy -c "Set :CFBundleName noteDock" "$plist_path"
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName noteDock" "$plist_path"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.local.notedock.dev" "$plist_path"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile electron.icns" "$plist_path"
  touch "$DEV_ELECTRON_APP"
  printf "%s" "$desired_stamp" >"$DEV_ELECTRON_STAMP"

  export ELECTRON_OVERRIDE_DIST_PATH="$DEV_ELECTRON_DIST"
  printf "Dev Electron shell: %s\n" "$DEV_ELECTRON_APP"
}

start_sync_server_foreground() {
  write_section "Starting sync server"
  print_sync_settings
  cd "$REPO_ROOT"
  export NOTEDOCK_SYNC_PORT="$PORT"
  export NOTEDOCK_SYNC_DATA_DIR="$RESOLVED_DATA_DIR"
  export NOTEDOCK_ADMIN_USERNAME="$ADMIN_USERNAME"
  export NOTEDOCK_ADMIN_PASSWORD="$ADMIN_PASSWORD"
  export NOTEDOCK_ALLOW_WEAK_SYNC_PASSWORD="1"
  export NOTEDOCK_SYNC_TOKEN=""
  exec npm run sync:server
}

start_sync_server_background() {
  write_section "Starting sync server"
  printf "Writing sync server logs to %s\n" "$SERVER_LOG"

  (
    cd "$REPO_ROOT"
    export NOTEDOCK_SYNC_PORT="$PORT"
    export NOTEDOCK_SYNC_DATA_DIR="$RESOLVED_DATA_DIR"
    export NOTEDOCK_ADMIN_USERNAME="$ADMIN_USERNAME"
    export NOTEDOCK_ADMIN_PASSWORD="$ADMIN_PASSWORD"
    export NOTEDOCK_ALLOW_WEAK_SYNC_PASSWORD="1"
    export NOTEDOCK_SYNC_TOKEN=""
    npm run sync:server
  ) >"$SERVER_LOG" 2>&1 &

  SERVER_PID=$!
  SERVER_STARTED_BY_SCRIPT=1

  local server_ready=0
  for _attempt in {1..50}; do
    if test_http_ok "$HEALTH_URL"; then
      server_ready=1
      break
    fi

    if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      printf "Sync server stopped before it became ready. Recent logs:\n" >&2
      tail -n 80 "$SERVER_LOG" >&2 || true
      exit 1
    fi

    sleep 0.5
  done

  if [[ "$server_ready" -eq 1 ]]; then
    printf "Sync server is ready at %s\n" "$SYNC_URL"
  else
    printf "Sync server is still starting. Check logs at %s\n" "$SERVER_LOG"
  fi
}

write_section "noteDock local dev"
printf "Repo:        %s\n" "$REPO_ROOT"
printf "Sync URL:    %s\n" "$SYNC_URL"
printf "Admin user:  %s\n" "$ADMIN_USERNAME"
printf "Admin pass:  %s\n" "$ADMIN_PASSWORD"
printf "Data dir:    %s\n" "$RESOLVED_DATA_DIR"
printf "Cloud URL:   %s\n" "$CLOUD_SERVER_URL"
printf "Cloud user:  %s\n" "$CLOUD_USERNAME"
if [[ -n "$CLOUD_PASSWORD" ]]; then
  printf "Cloud pass:  %s\n" "$CLOUD_PASSWORD"
else
  printf "Cloud pass:  <pass with --cloud-password>\n"
fi

if [[ "$APP_ONLY" -eq 0 ]]; then
  if test_http_ok "$HEALTH_URL"; then
    printf "Sync server is already running at %s\n" "$SYNC_URL"
  elif [[ "$SERVER_ONLY" -eq 1 ]]; then
    start_sync_server_foreground
  else
    start_sync_server_background
  fi
fi

print_sync_settings

if [[ "$SERVER_ONLY" -eq 0 ]]; then
  write_section "Starting desktop app"
  cd "$REPO_ROOT"
  prepare_dev_electron_app
  if [[ "$DEVTOOLS" -eq 1 ]]; then
    export NOTEDOCK_OPEN_DEVTOOLS="1"
  fi
  if [[ "$FRESH_USER_DATA" -eq 1 ]]; then
    FRESH_USER_DATA_DIR="$REPO_ROOT/.local/dev-user-data/session-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$FRESH_USER_DATA_DIR"
    export NOTEDOCK_ALLOW_MULTI_INSTANCE="1"
    export NOTEDOCK_TEST_USER_DATA_DIR="$FRESH_USER_DATA_DIR"
    export NOTEDOCK_SKIP_INITIAL_APP_STATE_RESTORE="1"
    export NOTEDOCK_SKIP_INITIAL_SYNC_CONFIG_RESTORE="1"
    printf "Fresh user data: %s\n" "$FRESH_USER_DATA_DIR"
  fi
  if [[ "$ALLOW_SELF_SIGNED_CLOUD_CERT" -eq 1 ]]; then
    export NODE_TLS_REJECT_UNAUTHORIZED="0"
    export NOTEDOCK_ALLOW_SELF_SIGNED_SYNC_CERT="1"
  fi
  npm run dev
fi
