#!/bin/sh
# Run database migrations first
cd /app
echo "Running database migrations..."
python -m alembic upgrade head
if [ $? -ne 0 ]; then
    echo "Migration failed! Check database connection and alembic configuration."
    exit 1
fi
echo "Database migrations completed."

# Start backend API in background
cd /app
uvicorn app.main:app --host 0.0.0.0 --port 10000 &

# Wait a moment for API to start
sleep 3

# Start frontend server
cd /app/frontend
python -m http.server 3000
