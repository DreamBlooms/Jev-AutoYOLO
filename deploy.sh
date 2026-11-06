#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv"
PYTHON="${PYTHON:-python3}"
VENV_PY="$VENV/bin/python"
PIDFILE="$ROOT/.deploy.pid"
LOGFILE="${DEPLOY_LOG:-$ROOT/deploy.log}"
HOST="${HOST:-0.0.0.0}"
PORT="${BACKEND_PORT:-8000}"
URL="http://127.0.0.1:$PORT"

usage() {
  cat <<'USAGE'
Jev-AutoYOLO deployment helper

Usage: ./deploy.sh <command>

Commands:
  setup      Install backend/frontend dependencies and initialize the database
  build      Build the frontend for backend static serving
  start      Build if needed, run migrations, and start the backend
  stop       Stop the running backend
  restart    Restart the backend
  status     Show process and health status
  logs       Follow the deployment log

Environment:
  HOST          Bind address (default: 0.0.0.0)
  BACKEND_PORT  Backend/frontend port (default: 8000)
  DEPLOY_LOG    Log file (default: ./deploy.log)
  PYTHON        Python executable used for setup (default: python3)
  ROCM_TORCH_INDEX  Override ROCm PyTorch wheel index during setup
USAGE
}

require_venv() {
  if [ ! -x "$VENV_PY" ]; then
    echo "Backend virtual environment not found: $VENV" >&2
    echo "Run: ./deploy.sh setup" >&2
    exit 1
  fi
}

pid_running() {
  [ -f "$PIDFILE" ] || return 1
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

health_check() {
  "$VENV_PY" - "$URL/api/health" <<'PY'
import json
import sys
import urllib.request

try:
    with urllib.request.urlopen(sys.argv[1], timeout=2) as response:
        print(json.loads(response.read()).get("status", "unknown"))
except Exception:
    raise SystemExit(1)
PY
}

ensure_env() {
  if [ ! -f "$BACKEND/.env" ]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    echo "Created backend/.env from .env.example."
    echo "Set TYPESAFE_API_KEY or OPENROUTER_API_KEY before production use."
  fi
}

build_frontend() {
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$FRONTEND" && pnpm install --frozen-lockfile && pnpm run build)
  elif command -v npm >/dev/null 2>&1; then
    (cd "$FRONTEND" && npm install && npm run build)
  else
    echo "pnpm/npm not found. Install Node.js 22+ and pnpm first." >&2
    exit 1
  fi
}

cmd_setup() {
  ensure_env
  echo "Installing application dependencies (no model download)..."
  "$PYTHON" "$ROOT/cli.py" setup --no-models
  build_frontend
  echo "Setup complete. Start with: ./deploy.sh start"
}

cmd_build() {
  ensure_env
  build_frontend
}

cmd_start() {
  require_venv
  ensure_env
  if [ ! -d "$FRONTEND/dist" ]; then
    echo "Frontend build not found; building now..."
    build_frontend
  fi

  if pid_running; then
    echo "Backend already running (PID $(cat "$PIDFILE"))."
    return 0
  fi

  echo "Running database migrations..."
  (cd "$BACKEND" && PYTHONPATH=. "$VENV/bin/alembic" upgrade head)

  echo "Starting backend on $HOST:$PORT..."
  (
    cd "$BACKEND"
    PYTHONPATH=. nohup "$VENV_PY" -m uvicorn app.main:app \
      --host "$HOST" --port "$PORT" >>"$LOGFILE" 2>&1 &
    echo $! >"$PIDFILE"
  )

  for _ in $(seq 1 30); do
    if health_check >/dev/null 2>&1; then
      echo "Started: $URL"
      echo "API docs: $URL/docs"
      echo "Log: $LOGFILE"
      return 0
    fi
    sleep 1
  done

  echo "Backend did not become healthy. Recent log:" >&2
  tail -n 40 "$LOGFILE" >&2 || true
  cmd_stop || true
  exit 1
}

cmd_stop() {
  local stopped=0
  if pid_running; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    stopped=1
  fi
  rm -f "$PIDFILE"

  if command -v lsof >/dev/null 2>&1; then
    for pid in $(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
      kill "$pid" 2>/dev/null || true
      stopped=1
    done
  fi

  if [ "$stopped" -eq 1 ]; then
    echo "Stopped."
  else
    echo "No running backend found."
  fi
}

cmd_status() {
  if pid_running; then
    echo "Backend PID: $(cat "$PIDFILE")"
    echo "Listening: $HOST:$PORT"
    if health_check >/dev/null 2>&1; then
      echo "Health: $(health_check)"
      echo "URL: $URL"
    else
      echo "Health: unavailable (see $LOGFILE)"
    fi
  else
    echo "Backend: stopped"
  fi
}

cmd_logs() {
  touch "$LOGFILE"
  tail -f "$LOGFILE"
}

case "${1:-}" in
  setup) cmd_setup ;;
  build) cmd_build ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  -h|--help|help|"") usage ;;
  *) echo "Unknown command: $1" >&2; usage; exit 1 ;;
esac
