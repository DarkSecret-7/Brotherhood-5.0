/**
 * Auth API Service - Authentication endpoints
 * Handles user login, signup, profile management
 */
class AuthApiService extends BaseApiService {
    
    /**
     * User signup
     * @param {Object} userData - { username, password, invitation_code, email }
     */
    async signup(userData) {
        return await this.post('/auth/signup', userData);
    }

    /**
     * User login
     * @param {Object} credentials - { username, password }
     */
    async login(credentials) {
        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'username': credentials.username,
                'password': credentials.password
            })
        });
        
        if (response.status === 401) {
            throw new Error('Incorrect username or password');
        }
        
        if (!response.ok) {
            throw new Error('Login failed');
        }
        
        const data = await response.json();
        
        // Store token in localStorage
        if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            // Also set cookie for server-side authentication
            document.cookie = `access_token=${data.access_token}; path=/; max-age=604800; secure; samesite=lax`;
            
            // Extract and save user UUID from token
            const userUuid = this.extractUserUuidFromToken(data.access_token);
            if (userUuid) {
                localStorage.setItem('user_uuid', userUuid);
            }
        }
        
        return data;
    }

    /**
     * Extract user UUID from JWT token
     * @param {string} token - JWT token
     * @returns {string|null} - User UUID or null if extraction fails
     */
    extractUserUuidFromToken(token) {
        try {
            // JWT tokens have 3 parts separated by dots
            const parts = token.split('.');
            if (parts.length !== 3) {
                console.error('Invalid JWT token format');
                return null;
            }
            
            // Decode the payload (second part)
            const payload = JSON.parse(atob(parts[1]));
            return payload.user_uuid || null;
        } catch (error) {
            console.error('Failed to extract user UUID from token:', error);
            return null;
        }
    }

    /**
     * Get current user UUID from localStorage
     * @returns {string|null} - User UUID or null if not found
     */
    getCurrentUserUuid() {
        return localStorage.getItem('user_uuid');
    }

    /**
     * User logout
     */
    async logout() {
        try {
            await this.post('/auth/logout');
        } catch (error) {
            console.warn('Logout request failed:', error);
        } finally {
            // Always clear local token and user UUID
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_uuid');
            document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        }
    }

    /**
     * Get current user profile
     * @returns {Object} - { user_uuid, username, email, created_at }
     */
    async getCurrentUser() {
        return await this.get('/auth/me');
    }

    /**
     * Update user profile
     * @param {Object} updateData - { user_uuid, username?, email?, phone?, etc. }
     */
    async updateProfile(updateData) {
        return await this.put('/auth/me', updateData);
    }

    /**
     * Update user password
     * @param {Object} passwordData - { old_password, new_password }
     */
    async updatePassword(passwordData) {
        const response = await fetch(`${this.baseURL}/auth/me/password`, {
            method: 'PUT',
            headers: this._getAuthHeaders(),
            body: JSON.stringify(passwordData)
        });
        
        await this._handleResponse(response);
        // No content returned on success
        return { success: true };
    }

    /**
     * Delete user account
     */
    async deleteAccount() {
        const response = await fetch(`${this.baseURL}/auth/me`, {
            method: 'DELETE',
            headers: this._getAuthHeaders()
        });
        
        await this._handleResponse(response);
        return { success: true };
    }

    /**
     * Create invitation (development/setup only)
     * @param {Object} invitationData - { code }
     */
    async createInvitation(invitationData) {
        return await this.post('/auth/invitations', invitationData);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!localStorage.getItem('access_token');
    }

    /**
     * Get token for API requests
     */
    getToken() {
        return localStorage.getItem('access_token');
    }
}

// Export singleton instance
const authApiService = new AuthApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthApiService, authApiService };
} else {
    window.AuthApiService = AuthApiService;
    window.authApiService = authApiService;
}
