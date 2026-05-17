/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Users API Service - User, profile, and bookmark endpoints
 * Handles dashboard/academia profile and bookmark operations plus user endpoints
 */
class UsersApiService extends BaseApiService {
    /**
     * Get full profile for the authenticated user
     */
    async getFullProfile() {
        return await this.get('/auth/me/profile');
    }

    /**
     * Update profile for the authenticated user
     * @param {Object} profileData
     */
    async updateProfile(profileData) {
        return await this.patch('/auth/me/profile/update', profileData);
    }

    /**
     * Get user bookmarks
     */
    async getBookmarks() {
        return await this.get('/bookmarks');
    }

    /**
     * Add a bookmark
     * @param {string} graphUuid
     */
    async createBookmark(graphUuid) {
        return await this.post('/bookmarks', { graph_uuid: graphUuid });
    }

    /**
     * Remove a bookmark
     * @param {string} graphUuid
     */
    async deleteBookmark(graphUuid) {
        return await this.delete(`/bookmarks/${graphUuid}`);
    }
    
    /**
     * Get user by UUID
     * @param {string} userUuid - The user's public UUID
     */
    async getUser(userUuid) {
        return await this.get(`/users/${userUuid}`);
    }

    /**
     * Get user by username (limited public info)
     * @param {string} username - The username
     */
    async getUserByUsername(username) {
        return await this.get(`/users/username/${username}`);
    }

    /**
     * Update user profile
     * @param {string} userUuid - The user's public UUID
     * @param {Object} updateData - { username?, email?, phone?, bio?, etc. }
     */
    async updateUser(userUuid, updateData) {
        return await this.patch(`/users/${userUuid}`, updateData);
    }

    /**
     * Get user's public capabilities
     * @param {string} userUuid - The user's public UUID
     * @param {Object} options - { skip?, limit?, assessment_type? }
     */
    async getUserPublicCapabilities(userUuid, options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        if (options.assessment_type) params.append('assessment_type', options.assessment_type);
        
        const endpoint = `/users/${userUuid}/capabilities${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Get user's snapshots
     * @param {string} userUuid - The user's public UUID
     * @param {Object} options - { skip?, limit?, public_only? }
     */
    async getUserSnapshots(userUuid, options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        if (options.public_only) params.append('public_only', 'true');
        
        const endpoint = `/users/${userUuid}/snapshots${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Get user's assessment history
     * @param {string} userUuid - The user's public UUID
     * @param {Object} options - { skip?, limit?, graph_label? }
     */
    async getUserAssessmentHistory(userUuid, options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        if (options.graph_label) params.append('graph_label', options.graph_label);
        
        const endpoint = `/users/${userUuid}/assessments${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Search users by username or email
     * @param {string} query - Search query
     * @param {Object} options - { skip?, limit? }
     */
    async searchUsers(query, options = {}) {
        const params = new URLSearchParams();
        params.append('q', query);
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        
        const endpoint = `/users/search${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Follow a user
     * @param {string} userUuid - The user's public UUID to follow
     */
    async followUser(userUuid) {
        return await this.post(`/users/${userUuid}/follow`);
    }

    /**
     * Unfollow a user
     * @param {string} userUuid - The user's public UUID to unfollow
     */
    async unfollowUser(userUuid) {
        return await this.delete(`/users/${userUuid}/follow`);
    }

    /**
     * Get user's followers
     * @param {string} userUuid - The user's public UUID
     * @param {Object} options - { skip?, limit? }
     */
    async getUserFollowers(userUuid, options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        
        const endpoint = `/users/${userUuid}/followers${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Get user's following
     * @param {string} userUuid - The user's public UUID
     * @param {Object} options - { skip?, limit? }
     */
    async getUserFollowing(userUuid, options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        
        const endpoint = `/users/${userUuid}/following${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Get user statistics
     * @param {string} userUuid - The user's public UUID
     */
    async getUserStats(userUuid) {
        return await this.get(`/users/${userUuid}/stats`);
    }

    /**
     * Report user
     * @param {string} userUuid - The user's public UUID
     * @param {Object} reportData - { reason, description }
     */
    async reportUser(userUuid, reportData) {
        return await this.post(`/users/${userUuid}/report`, reportData);
    }

    /**
     * Block user
     * @param {string} userUuid - The user's public UUID
     */
    async blockUser(userUuid) {
        return await this.post(`/users/${userUuid}/block`);
    }

    /**
     * Unblock user
     * @param {string} userUuid - The user's public UUID
     */
    async unblockUser(userUuid) {
        return await this.delete(`/users/${userUuid}/block`);
    }

    /**
     * Get user's recent activity
     * @param {string} userUuid - The user's public UUID
     * @param {Object} options - { skip?, limit?, activity_type? }
     */
    async getUserActivity(userUuid, options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        if (options.activity_type) params.append('activity_type', options.activity_type);
        
        const endpoint = `/users/${userUuid}/activity${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }
}

// Export singleton instance
const usersApiService = new UsersApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UsersApiService, usersApiService };
} else {
    window.UsersApiService = UsersApiService;
    window.usersApiService = usersApiService;
}
