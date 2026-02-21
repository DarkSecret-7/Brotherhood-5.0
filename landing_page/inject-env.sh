#!/bin/sh
set -e

# Default to localhost if not set
if [ -z "$API_URL" ]; then
    echo "API_URL environment variable is not set. Using default http://localhost:8000"
    API_URL="http://localhost:8000"
fi

echo "Injecting API_URL=$API_URL into js/config.js..."

# Only update js/config.js
sed -i "s|__API_URL__|$API_URL|g" /usr/share/nginx/html/js/config.js

echo "Environment configuration complete."
