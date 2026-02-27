// Configuration for the Public Gallery Frontend
// This file can be replaced in Docker/Render deployments to point to the correct API URL.

window.AppConfig = {
    // The base URL of the Brotherhood API (FastAPI backend)
    API_BASE_URL: window.location.origin,

    // The URL of the main application (Workspace/Login)
    APP_URL: window.location.origin
};
