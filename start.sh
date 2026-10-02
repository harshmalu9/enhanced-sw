#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# Enhanced SW - Unified Development Startup Script
# Starts:
#   1. Python FastAPI AI Service (:8000 in background)
#   2. Node.js Express Backend (:3001 in background)
#   3. Expo React Native Dev Server (:8081 in foreground with interactive QR code)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

AI_PID=""
BACKEND_PID=""
CLEANED_UP=0

cleanup() {
  if [ "$CLEANED_UP" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1

  echo ""
  echo "Stopping Enhanced SW services..."

  if [ -n "$AI_PID" ] && kill -0 "$AI_PID" 2>/dev/null; then
    kill "$AI_PID" 2>/dev/null || true
  fi

  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  # Terminate any remaining background jobs started by this script
  local pids
  pids="$(jobs -p 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  echo "All Enhanced SW services stopped."
}

trap cleanup INT TERM EXIT

echo "=================================================================="
echo " Starting Enhanced SW Development Environment"
echo "=================================================================="

# ------------------------------------------------------------------------------
# 1. Pre-flight Checks
# ------------------------------------------------------------------------------
echo "[1/4] Running pre-flight checks..."

# Check required binaries
for cmd in node npm curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Required command '$cmd' is not installed or not in PATH."
    exit 1
  fi
done

# Check AI virtualenv
if [ ! -d "ai-service/.venv" ] || [ ! -f "ai-service/.venv/bin/python" ]; then
  echo "ERROR: Python virtual environment not found at ai-service/.venv."
  echo "Please set it up with:"
  echo "  cd ai-service && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

# Check Node modules
if [ ! -d "backend/node_modules" ]; then
  echo "ERROR: Backend dependencies not found at backend/node_modules."
  echo "Please run: cd backend && npm install"
  exit 1
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "ERROR: Frontend dependencies not found at frontend/node_modules."
  echo "Please run: cd frontend && npm install"
  exit 1
fi

# Port check helper
check_port() {
  local port="$1"
  local service_name="$2"
  local pid=""

  if command -v lsof >/dev/null 2>&1; then
    pid="$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  fi

  if [ -n "$pid" ] || (echo > /dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
    echo "ERROR: Port $port ($service_name) is already in use."
    if [ -n "$pid" ]; then
      local proc_info
      proc_info="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
      echo "Occupying PID: $pid ($proc_info)"
    fi
    echo "Please stop the existing process before running ./start.sh."
    exit 1
  fi
}

check_port 8000 "Python AI Service"
check_port 3001 "Node.js Backend"
check_port 8081 "Expo Dev Server"

echo "✓ Dependencies and ports (8000, 3001, 8081) verified."

# ------------------------------------------------------------------------------
# 2. Database Status & Setup
# ------------------------------------------------------------------------------
echo "[2/4] Checking database connection..."

DB_STATUS="fallback"
if command -v pg_isready >/dev/null 2>&1 && pg_isready -q 2>/dev/null; then
  DB_STATUS="postgres"
  echo "✓ PostgreSQL is active on port 5432."
  echo "  Applying pending migrations..."
  if (cd backend && npm run db:migrate >/dev/null 2>&1); then
    echo "✓ Database migrations applied."
  else
    echo "ℹ Note: PostgreSQL is active but migration check fell back to in-memory store."
  fi
else
  echo "ℹ PostgreSQL is not reachable on port 5432."
  echo "  Backend will use in-memory store fallback for this session."
fi

# Create runtime directory for logs
mkdir -p "$SCRIPT_DIR/.runtime"

# ------------------------------------------------------------------------------
# 3. Start Python AI Service (Background)
# ------------------------------------------------------------------------------
echo "[3/4] Starting AI Service on port 8000..."

(cd ai-service && .venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8000) > "$SCRIPT_DIR/.runtime/ai-service.log" 2>&1 &
AI_PID=$!

# Wait for AI service health check
echo -n "  Waiting for AI service to be healthy..."
AI_READY=0
for i in $(seq 1 60); do
  if ! kill -0 "$AI_PID" 2>/dev/null; then
    echo ""
    echo "ERROR: AI service process exited unexpectedly."
    echo "Recent log output:"
    tail -n 25 "$SCRIPT_DIR/.runtime/ai-service.log" 2>/dev/null || true
    exit 1
  fi

  if curl -s -f http://localhost:8000/health >/dev/null 2>&1; then
    AI_READY=1
    break
  fi
  sleep 0.5
  echo -n "."
done

if [ "$AI_READY" -ne 1 ]; then
  echo ""
  echo "ERROR: AI service failed to respond within 30 seconds."
  echo "Recent log output:"
  tail -n 25 "$SCRIPT_DIR/.runtime/ai-service.log" 2>/dev/null || true
  exit 1
fi
echo " Ready! (PID: $AI_PID)"

# ------------------------------------------------------------------------------
# 4. Start Node.js Express Backend (Background)
# ------------------------------------------------------------------------------
echo "  Starting Node Backend on port 3001..."

(cd backend && npm run dev) > "$SCRIPT_DIR/.runtime/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend health check
echo -n "  Waiting for Backend service to be healthy..."
BE_READY=0
for i in $(seq 1 60); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "ERROR: Backend service process exited unexpectedly."
    echo "Recent log output:"
    tail -n 25 "$SCRIPT_DIR/.runtime/backend.log" 2>/dev/null || true
    exit 1
  fi

  if curl -s -f http://localhost:3001/api/health >/dev/null 2>&1; then
    BE_READY=1
    break
  fi
  sleep 0.5
  echo -n "."
done

if [ "$BE_READY" -ne 1 ]; then
  echo ""
  echo "ERROR: Backend service failed to respond within 30 seconds."
  echo "Recent log output:"
  tail -n 25 "$SCRIPT_DIR/.runtime/backend.log" 2>/dev/null || true
  exit 1
fi
echo " Ready! (PID: $BACKEND_PID)"

# Display frontend configuration if present
if [ -f "frontend/.env" ]; then
  CURRENT_API_URL="$(grep -E '^EXPO_PUBLIC_API_URL=' frontend/.env | cut -d '=' -f2- || true)"
  if [ -n "$CURRENT_API_URL" ]; then
    echo "  Frontend API URL: $CURRENT_API_URL"
  fi
fi

# ------------------------------------------------------------------------------
# 5. Start Expo Frontend (Foreground Interactive)
# ------------------------------------------------------------------------------
echo "[4/4] Starting Expo Frontend on port 8081..."
echo "=================================================================="
echo " Press 'w' in Expo for Web, 'a' for Android, or scan QR code."
echo " Press Ctrl+C to shut down all services."
echo "=================================================================="
echo ""

cd frontend
npx expo start
