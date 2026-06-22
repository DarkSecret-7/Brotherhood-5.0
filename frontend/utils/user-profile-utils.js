/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project Developers
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
 * User Profile Utility
 * Handles user profile URL generation and user data management
 */
class UserProfileUtils {
    
    /**
     * Get the current user's profile URL
     * @returns {string} - Profile URL with user UUID or fallback
     */
    static getCurrentProfileUrl() {
        const userUuid = authApiService?.getCurrentUserUuid();
        if (userUuid) {
            return `/profile/${userUuid}`;
        }
        // Fallback if UUID not available
        return '/profile/current-user';
    }
    
    /**
     * Update profile links in the page
     * @param {string} selector - CSS selector for profile links
     */
    static updateProfileLinks(selector = '.profile-link') {
        const profileLinks = document.querySelectorAll(selector);
        const profileUrl = this.getCurrentProfileUrl();
        
        profileLinks.forEach(link => {
            if (link.getAttribute('href')?.includes('/profile/')) {
                link.setAttribute('href', profileUrl);
            }
        });
    }
    
    /**
     * Initialize profile links when page loads
     */
    static initialize() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updateProfileLinks('.side-panel-link[href*="/profile/"]');
            });
        } else {
            this.updateProfileLinks('.side-panel-link[href*="/profile/"]');
        }
    }
}

// Auto-initialize when script loads
UserProfileUtils.initialize();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UserProfileUtils };
} else {
    window.UserProfileUtils = UserProfileUtils;
}
