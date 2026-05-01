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
 * Auth Transformer - Convert between backend and frontend auth data structures
 * Handles user profile, authentication data transformation
 */
class AuthTransformer {
    
    /**
     * Transform backend user data to frontend format
     * @param {Object} backendUser - Backend user response
     * @returns {Object} Frontend user object
     */
    transformUserFromBackend(backendUser) {
        if (!backendUser) return null;

        return {
            uuid: backendUser.user_uuid,
            username: backendUser.username,
            email: backendUser.email || '',
            phone: backendUser.phone || '',
            dob: this.convertDate(backendUser.dob) || null,
            bio: backendUser.bio || '',
            location: backendUser.location || '',
            socialLinks: {
                github: backendUser.social_github || '',
                linkedin: backendUser.social_linkedin || ''
            },
            profileImage: backendUser.profile_image || '',
            isActive: backendUser.is_active !== false,
            createdAt: backendUser.created_at ? new Date(backendUser.created_at) : null,
            // Computed properties
            displayName: backendUser.username,
            initials: this.getInitials(backendUser.username)
        };
    }

    /**
     * Convert date string to YYYY-MM-DD format without timezone issues
     * Extracts date portion directly to avoid UTC conversion shifting the date
     * @param {string} date - Date string (e.g., "1990-05-15" or "1990-05-15T00:00:00")
     * @returns {string} YYYY-MM-DD date string
     */
    convertDate(date) {
        if (!date) return null;
        // Extract YYYY-MM-DD directly from the string to avoid timezone conversion
        // Backend sends "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss", we just need the date part
        const dateMatch = date.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        }
        return null;
    }

    /**
     * Transform frontend user data to backend format
     * Converts empty strings to null for proper database handling
     * @param {Object} frontendUser - Frontend user object
     * @returns {Object} Backend user update data
     */
    transformUserToBackend(frontendUser) {
        const backendData = {
            user_uuid: frontendUser.uuid
        };

        // Helper to convert empty string to null, or keep value if present
        const toNullable = (value) => {
            if (value === undefined) return undefined;
            if (value === null || value === '') return null;
            return value;
        };

        // Only include fields that are being updated
        if (frontendUser.username !== undefined) backendData.username = frontendUser.username;
        if (frontendUser.email !== undefined) backendData.email = toNullable(frontendUser.email);
        if (frontendUser.phone !== undefined) backendData.phone = toNullable(frontendUser.phone);
        if (frontendUser.dob !== undefined) backendData.dob = toNullable(frontendUser.dob);
        if (frontendUser.bio !== undefined) backendData.bio = toNullable(frontendUser.bio);
        if (frontendUser.location !== undefined) backendData.location = toNullable(frontendUser.location);
        if (frontendUser.socialLinks) {
            if (frontendUser.socialLinks.github !== undefined) backendData.social_github = toNullable(frontendUser.socialLinks.github);
            if (frontendUser.socialLinks.linkedin !== undefined) backendData.social_linkedin = toNullable(frontendUser.socialLinks.linkedin);
        }
        if (frontendUser.profileImage !== undefined) backendData.profile_image = toNullable(frontendUser.profileImage);

        return backendData;
    }

    /**
     * Transform frontend signup data to backend format
     * @param {Object} signupData - Frontend signup form data
     * @returns {Object} Backend signup request data
     */
    transformSignupToBackend(signupData) {
        return {
            username: signupData.username,
            password: signupData.password,
            email: signupData.email || '',
            invitation_code: signupData.invitationCode
        };
    }

    /**
     * Transform login credentials (form data format)
     * @param {Object} credentials - Login credentials
     * @returns {Object} Form data ready for API
     */
    transformLoginToBackend(credentials) {
        return {
            username: credentials.username,
            password: credentials.password
        };
    }

    /**
     * Transform password update data
     * @param {Object} passwordData - Password update form data
     * @returns {Object} Backend password update data
     */
    transformPasswordUpdateToBackend(passwordData) {
        return {
            old_password: passwordData.oldPassword,
            new_password: passwordData.newPassword
        };
    }

    /**
     * Transform backend token response to frontend format
     * @param {Object} tokenResponse - Backend token response
     * @returns {Object} Frontend auth data
     */
    transformTokenFromBackend(tokenResponse) {
        return {
            accessToken: tokenResponse.access_token,
            tokenType: tokenResponse.token_type || 'bearer',
            // Store token expiration if provided
            expiresAt: tokenResponse.expires_at ? new Date(tokenResponse.expires_at) : null
        };
    }

    /**
     * Transform user search results
     * @param {Array} backendResults - Backend search results
     * @returns {Array} Frontend user search results
     */
    transformSearchResultsFromBackend(backendResults) {
        if (!Array.isArray(backendResults)) return [];

        return backendResults.map(user => ({
            uuid: user.user_uuid,
            username: user.username,
            displayName: user.username,
            initials: this.getInitials(user.username),
            bio: user.bio || '',
            profileImage: user.profile_image || '',
            isPublic: user.is_public !== false,
            stats: user.stats || {
                snapshotCount: 0,
                capabilityCount: 0,
                followerCount: 0
            }
        }));
    }

    /**
     * Transform user statistics
     * @param {Object} backendStats - Backend user stats
     * @returns {Object} Frontend user stats
     */
    transformStatsFromBackend(backendStats) {
        return {
            snapshotCount: backendStats.snapshot_count || 0,
            publicSnapshotCount: backendStats.public_snapshot_count || 0,
            capabilityCount: backendStats.capability_count || 0,
            publicCapabilityCount: backendStats.public_capability_count || 0,
            followerCount: backendStats.follower_count || 0,
            followingCount: backendStats.following_count || 0,
            assessmentCount: backendStats.assessment_count || 0,
            joinedAt: backendStats.joined_at ? new Date(backendStats.joined_at) : null,
            lastActive: backendStats.last_active ? new Date(backendStats.last_active) : null
        };
    }

    /**
     * Transform user activity feed
     * @param {Array} backendActivity - Backend activity data
     * @returns {Array} Frontend activity feed
     */
    transformActivityFromBackend(backendActivity) {
        if (!Array.isArray(backendActivity)) return [];

        return backendActivity.map(activity => ({
            id: activity.id,
            type: activity.activity_type,
            description: activity.description,
            timestamp: activity.timestamp ? new Date(activity.timestamp) : new Date(),
            metadata: activity.metadata || {},
            // Computed display properties
            relativeTime: this.getRelativeTime(activity.timestamp),
            icon: this.getActivityIcon(activity.activity_type)
        }));
    }

    /**
     * Get initials from username
     * @param {string} username - Username
     * @returns {string} Initials
     */
    getInitials(username) {
        if (!username) return '?';
        const parts = username.trim().split(/\s+/);
        if (parts.length >= 2) {
            return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
        }
        return username.substring(0, 2).toUpperCase();
    }

    /**
     * Get relative time string
     * @param {string|Date} timestamp - Timestamp
     * @returns {string} Relative time
     */
    getRelativeTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }

    /**
     * Get activity icon based on type
     * @param {string} activityType - Activity type
     * @returns {string} Icon name
     */
    getActivityIcon(activityType) {
        const iconMap = {
            'snapshot_created': 'document-plus',
            'snapshot_updated': 'document-edit',
            'assessment_completed': 'check-circle',
            'capability_shared': 'share',
            'user_followed': 'user-plus',
            'profile_updated': 'user-edit'
        };
        return iconMap[activityType] || 'activity';
    }

    /**
     * Validate user data
     * @param {Object} userData - User data to validate
     * @returns {Object} Validation result
     */
    validateUserData(userData) {
        const errors = [];

        if (!userData.username || userData.username.trim().length < 3) {
            errors.push('Username must be at least 3 characters long');
        }

        if (userData.email && !this.isValidEmail(userData.email)) {
            errors.push('Invalid email format');
        }

        if (userData.bio && userData.bio.length > 500) {
            errors.push('Bio must be less than 500 characters');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// Export singleton instance
const authTransformer = new AuthTransformer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthTransformer, authTransformer };
} else {
    window.AuthTransformer = AuthTransformer;
    window.authTransformer = authTransformer;
}
