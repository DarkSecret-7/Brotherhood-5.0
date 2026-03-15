#!/bin/sh
# Start backend API in background
cd /app
uvicorn app.main:app --host 0.0.0.0 --port 10000 &

# Wait a moment for API to start
sleep 3

# Start frontend server
cd /app/frontend
python -m http.server 3000
