// Configuration for the Public Gallery Frontend
// This file can be replaced in Docker/Render deployments to point to the correct API URL.

window.AppConfig = {
    // The base URL of the Brotherhood API (FastAPI backend)
    // This value is replaced at runtime by the Docker entrypoint script
    // If not replaced (local dev), it falls back to localhost
    API_BASE_URL: '__API_URL__'.startsWith('__') ? 'http://localhost:8000' : '__API_URL__',

    // The URL of the main application (Workspace/Login)
    APP_URL: '__API_URL__'.startsWith('__') ? 'http://localhost:8000' : '__API_URL__'
};
