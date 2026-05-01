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
 * Dashboard API Service
 * Handles bookmarks, full profile, and public graph browsing
 */
class DashboardApiService extends BaseApiService {
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
     * Get full user profile
     */
    async getFullProfile() {
        return await this.get('/auth/me/profile');
    }

    /**
     * Update user profile
     * @param {Object} profileData 
     */
    async updateProfile(profileData) {
        return await this.patch('/auth/me/profile/update', profileData);
    }

    /**
     * Search/Browse public graphs
     * @param {number} skip 
     * @param {number} limit 
     */
    async getPublicGraphs(skip = 0, limit = 20) {
        return await this.get(`/public/snapshots?skip=${skip}&limit=${limit}`);
    }

    /**
     * Get details for a specific graph (lazy loading)
     * @param {string} graphUuid 
     */
    async getGraphDetails(graphUuid) {
        return await this.get(`/public/snapshots/${graphUuid}`);
    }
}

const dashboardApiService = new DashboardApiService();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardApiService, dashboardApiService };
} else {
    window.DashboardApiService = DashboardApiService;
    window.dashboardApiService = dashboardApiService;
}
