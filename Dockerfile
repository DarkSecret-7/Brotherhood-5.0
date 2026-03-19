FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY app/ ./app/
COPY frontend/ ./frontend/
COPY docs/ ./docs/
COPY cli.py .
COPY self_assessment/ ./self_assessment/
COPY start-services.sh /app/start-services.sh

# Copy .env file for development (Render uses its own environment variables)
COPY .env .env

# Make startup script executable
RUN chmod +x /app/start-services.sh

# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Expose both ports
EXPOSE 3000 10000

# Health check for frontend
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start both services
CMD ["/bin/sh", "/app/start-services.sh"]
