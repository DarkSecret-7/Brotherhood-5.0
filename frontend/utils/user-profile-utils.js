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
