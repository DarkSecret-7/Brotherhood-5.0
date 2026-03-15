/**
 * Base API Service - Core HTTP communication
 * Handles authentication, headers, and basic request/response
 */
class BaseApiService {
    constructor() {
        // Direct connection to backend (now running on port 8000)
        this.baseURL = 'http://localhost:8000/api/v1';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Get authentication headers
     */
    _getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        const headers = { ...this.defaultHeaders };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    /**
     * Handle HTTP response errors
     */
    async _handleResponse(response) {
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('access_token');
            document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        return response;
    }

    /**
     * Generic fetch method
     */
    async _fetch(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this._getAuthHeaders(),
            ...options
        };

        const response = await fetch(url, config);
        return await this._handleResponse(response);
    }

    /**
     * GET request
     */
    async get(endpoint) {
        const response = await this._fetch(endpoint);
        return await response.json();
    }

    /**
     * POST request
     */
    async post(endpoint, data) {
        const response = await this._fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data) {
        const response = await this._fetch(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        await this._fetch(endpoint, { method: 'DELETE' });
    }

    /**
     * Upload file (multipart/form-data)
     */
    async upload(endpoint, file, overwrite = false) {
        const formData = new FormData();
        formData.append('file', file);
        
        let url = `${this.baseURL}${endpoint}`;
        if (overwrite) {
            url += '?overwrite=true';
        }
        
        const headers = this._getAuthHeaders();
        delete headers['Content-Type']; // Let browser set boundary for multipart
        
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData
        });
        
        await this._handleResponse(response);
        return await response.json();
    }

    /**
     * Download file as blob
     */
    async download(endpoint) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            headers: this._getAuthHeaders()
        });
        
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        return await response.blob();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BaseApiService };
} else {
    window.BaseApiService = BaseApiService;
}
