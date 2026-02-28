#!/usr/bin/env bash
# Restart frontend and backend cleanly.
# Usage: ./scripts/restart-dev.sh   (from repo root)

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Stopping any existing processes on 8000 and 5173..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
pkill -f "manage.py runserver" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

echo "Starting backend (Django, SQLite) on http://localhost:8000 ..."
cd "$REPO_ROOT/backend"
USE_SQLITE=1 python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

echo "Starting frontend (Vite) on http://localhost:5173 ..."
cd "$REPO_ROOT/website/cortexmind-dashboard"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000  (PID $BACKEND_PID)"
echo "Frontend: http://localhost:5173  (PID $FRONTEND_PID)"
echo "Press Ctrl+C to stop both."
wait -n 2>/dev/null || true
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
