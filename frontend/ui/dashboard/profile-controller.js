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
 * Profile Controller
 * Manages the profile view/edit logic with deterministic avatar generation
 * Architecture: Controller → Transformer → API → State
 */
class ProfileController {
    constructor(stateManager, transformer, apiService) {
        this.stateManager = stateManager;
        this.transformer = transformer;
        this.apiService = apiService;
        this.container = document.getElementById('profile-container');
    }

    async init() {
        this.stateManager.subscribe(this.render.bind(this));
        this.bindDialogEvents();
        await this.loadProfile();
    }

    /**
     * Bind dialog button events
     */
    bindDialogEvents() {
        const confirmBtn = document.getElementById('dialog-confirm');
        const cancelBtn = document.getElementById('dialog-cancel');
        const overlay = document.getElementById('custom-dialog-overlay');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.stateManager.closeDialog(true);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.stateManager.closeDialog(false);
            });
        }

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.stateManager.closeDialog(false);
                }
            });
        }
    }

    async loadProfile() {
        try {
            // Controller → API → Transformer → State
            const backendProfile = await this.apiService.getFullProfile();
            const frontendProfile = this.transformer.transformUserFromBackend(backendProfile);
            this.stateManager.setProfile(frontendProfile);
        } catch (error) {
            console.error('Failed to load profile', error);
            this.showError('Failed to load profile. Please try refreshing.');
        }
    }

    async saveProfile() {
        const form = document.getElementById('profile-form');
        if (!form) return;

        const formData = new FormData(form);
        const currentProfile = this.stateManager.getState().profile;
        
        // Controller → Transformer (FormData → Frontend → Backend) → API → State
        // Step 1: Transform form data to frontend format
        const frontendData = this.transformFormData(formData, currentProfile.uuid);
        
        // Step 2: Validate data
        const validation = this.transformer.validateUserData(frontendData);
        if (!validation.isValid) {
            await this.stateManager.showAlert(
                validation.errors.join('\n'),
                'Validation Error'
            );
            return;
        }
        
        // Step 3: Transform frontend data to backend format (handles null conversion)
        const backendData = this.transformer.transformUserToBackend(frontendData);

        try {
            const updatedBackendProfile = await this.apiService.updateProfile(backendData);
            const updatedFrontendProfile = this.transformer.transformUserFromBackend(updatedBackendProfile);
            this.stateManager.setProfile(updatedFrontendProfile);
            this.stateManager.toggleProfileEditMode(false);
            await this.stateManager.showAlert('Profile updated successfully!', 'Success');
        } catch (error) {
            console.error('Failed to update profile', error);
            await this.stateManager.showAlert(
                'Failed to update profile: ' + (error.message || 'Unknown error'),
                'Error'
            );
        }
    }

    render(state) {
        if (!state.profile) return;

        if (state.profileEditMode) {
            this.renderEditMode(state.profile);
        } else {
            this.renderViewMode(state.profile);
        }
    }

    /**
     * Transform form data to frontend user format for profile updates
     * @param {FormData} formData - Form data from profile edit form
     * @param {string} userUuid - Current user's UUID
     * @returns {Object} Frontend user object ready for transformation
     */
    transformFormData(formData, userUuid) {
        return {
            uuid: userUuid,
            username: formData.get('username'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            dob: formData.get('dob'),
            bio: formData.get('bio'),
            location: formData.get('location'),
            socialLinks: {
                github: formData.get('social_github'),
                linkedin: formData.get('social_linkedin')
            }
        };
    }

    /**
     * Generate a deterministic color from UUID string
     * Uses simple hash algorithm to produce HSL color
     */
    generateAvatarColor(uuid) {
        if (!uuid) return '#1a73e8';
        
        // Simple hash of UUID string
        let hash = 0;
        for (let i = 0; i < uuid.length; i++) {
            const char = uuid.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Use hash to generate HSL color (good saturation and lightness for visibility)
        const hue = Math.abs(hash % 360);
        const saturation = 65 + (Math.abs(hash >> 8) % 20); // 65-85%
        const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    /**
     * Generate SVG avatar data URI with deterministic background color
     */
    generateAvatarSvg(uuid, username) {
        const color = this.generateAvatarColor(uuid);
        const initial = (username || '?').charAt(0).toUpperCase();
        
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E` +
               `%3Crect width='100' height='100' fill='${encodeURIComponent(color)}' rx='50'/%3E` +
               `%3Ctext x='50' y='65' font-size='45' fill='white' text-anchor='middle' ` +
               `font-family='Segoe UI, Tahoma, sans-serif' font-weight='600'%3E${initial}%3C/text%3E` +
               `%3C/svg%3E`;
    }

    renderViewMode(profile) {
        // Profile is now in frontend format from transformer (uuid, socialLinks object)
        const avatarUrl = profile.profileImage || this.generateAvatarSvg(profile.uuid, profile.username);
        const displayUuid = profile.uuid || 'N/A';
        const socialGithub = profile.socialLinks?.github;
        const socialLinkedin = profile.socialLinks?.linkedin;
        
        this.container.innerHTML = `
            <div class="profile-layout">
                <!-- Left Column: Identity Card -->
                <div class="profile-identity-card">
                    <div class="avatar-section">
                        <img src="${avatarUrl}" class="avatar-large" alt="Profile Image" 
                             onerror="this.src='${this.generateAvatarSvg(profile.uuid, profile.username)}'">
                    </div>
                    <h2 class="profile-name">${profile.username}</h2>
                    <p class="profile-uuid" title="User UUID (read-only)">
                        <span class="uuid-label">UUID:</span>
                        <code class="uuid-value">${displayUuid}</code>
                    </p>
                    <button class="btn btn-primary btn-full" onclick="profileController.toggleEdit(true)">
                        Edit Profile
                    </button>
                </div>

                <!-- Right Column: Details -->
                <div class="profile-details-card">
                    <div class="detail-section">
                        <h3>About</h3>
                        <p class="bio-text">${profile.bio || 'No bio provided'}</p>
                    </div>
                    
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${profile.email || 'Not set'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${profile.phone || 'Not set'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${profile.location || 'Not set'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Date of Birth</span>
                            <span class="detail-value">${profile.dob || 'Not set'}</span>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h3>Social Links</h3>
                        <div class="social-links">
                            ${socialGithub ? 
                                `<a href="${socialGithub}" target="_blank" class="social-link github">
                                    <span class="social-icon">GH</span> GitHub
                                </a>` : 
                                '<span class="social-link empty">No GitHub linked</span>'}
                            ${socialLinkedin ? 
                                `<a href="${socialLinkedin}" target="_blank" class="social-link linkedin">
                                    <span class="social-icon">LI</span> LinkedIn
                                </a>` : 
                                '<span class="social-link empty">No LinkedIn linked</span>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderEditMode(profile) {
        // Profile is now in frontend format from transformer
        const avatarUrl = profile.profileImage || this.generateAvatarSvg(profile.uuid, profile.username);
        const socialGithub = profile.socialLinks?.github || '';
        const socialLinkedin = profile.socialLinks?.linkedin || '';
        
        this.container.innerHTML = `
            <div class="profile-layout">
                <!-- Left Column: Identity Preview -->
                <div class="profile-identity-card">
                    <div class="avatar-section">
                        <img src="${avatarUrl}" class="avatar-large" alt="Profile Image"
                             onerror="this.src='${this.generateAvatarSvg(profile.uuid, profile.username)}'">
                    </div>
                    <h2 class="profile-name">${profile.username}</h2>
                    <p class="profile-uuid" title="User UUID (read-only)">
                        <span class="uuid-label">ID:</span>
                        <code class="uuid-value">${profile.uuid || 'N/A'}</code>
                    </p>
                    <div class="edit-hint">
                        <small>Edit your details on the right</small>
                    </div>
                </div>

                <!-- Right Column: Edit Form -->
                <div class="profile-edit-card">
                    <h3 class="edit-title">Edit Profile</h3>
                    
                    <form id="profile-form" onsubmit="event.preventDefault(); profileController.saveProfile()">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="username">Username *</label>
                                <input type="text" id="username" name="username" value="${profile.username}" required>
                            </div>
                            <div class="form-group">
                                <label for="email">Email</label>
                                <input type="email" id="email" name="email" value="${profile.email || ''}">
                            </div>
                            <div class="form-group">
                                <label for="phone">Phone</label>
                                <input type="tel" id="phone" name="phone" value="${profile.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label for="dob">Date of Birth</label>
                                <input type="date" id="dob" name="dob" value="${profile.dob || ''}">
                            </div>
                            <div class="form-group full-width">
                                <label for="location">Location</label>
                                <input type="text" id="location" name="location" value="${profile.location || ''}" 
                                       placeholder="City, Country">
                            </div>
                            <div class="form-group full-width">
                                <label for="bio">Bio <span class="char-limit">(max 500)</span></label>
                                <textarea id="bio" name="bio" maxlength="500" rows="3" 
                                          placeholder="Tell us about yourself...">${profile.bio || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="social_github">GitHub URL</label>
                                <input type="url" id="social_github" name="social_github" 
                                       value="${socialGithub}" placeholder="https://github.com/...">
                            </div>
                            <div class="form-group">
                                <label for="social_linkedin">LinkedIn URL</label>
                                <input type="url" id="social_linkedin" name="social_linkedin" 
                                       value="${socialLinkedin}" placeholder="https://linkedin.com/in/...">
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                            <button type="button" class="btn btn-outline" onclick="profileController.toggleEdit(false)">Cancel</button>
                        </div>
                    </form>

                    <!-- Danger Zone Section -->
                    <div class="danger-section">
                        <h4 class="danger-title">Danger Zone</h4>
                        <div class="danger-actions">
                            <button type="button" class="btn btn-secondary" onclick="profileController.showChangePasswordModal()">
                                Change Password
                            </button>
                            <button type="button" class="btn btn-danger" onclick="profileController.confirmDeleteAccount()">
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    toggleEdit(enabled) {
        this.stateManager.toggleProfileEditMode(enabled);
    }

    /**
     * Show the change password modal
     */
    showChangePasswordModal() {
        const overlay = document.getElementById('password-modal-overlay');
        const modal = document.getElementById('password-modal');
        const form = document.getElementById('password-form');
        const errorDiv = document.getElementById('password-error');

        if (form) form.reset();
        if (errorDiv) errorDiv.textContent = '';

        if (overlay) overlay.style.display = 'block';
        if (modal) modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the change password modal
     */
    closePasswordModal() {
        const overlay = document.getElementById('password-modal-overlay');
        const modal = document.getElementById('password-modal');

        if (overlay) overlay.style.display = 'none';
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    /**
     * Validate and change user password
     * Uses authTransformer for data transformation
     */
    async changePassword() {
        const oldPassword = document.getElementById('old-password')?.value;
        const newPassword = document.getElementById('new-password')?.value;
        const confirmPassword = document.getElementById('confirm-password')?.value;
        const errorDiv = document.getElementById('password-error');

        // Validation
        if (!oldPassword || !newPassword || !confirmPassword) {
            if (errorDiv) errorDiv.textContent = 'All fields are required';
            return;
        }

        if (newPassword.length < 8) {
            if (errorDiv) errorDiv.textContent = 'Password must be at least 8 characters long';
            return;
        }

        if (newPassword !== confirmPassword) {
            if (errorDiv) errorDiv.textContent = 'New passwords do not match';
            return;
        }

        if (newPassword === oldPassword) {
            if (errorDiv) errorDiv.textContent = 'New password must be different from current password';
            return;
        }

        // Clear error
        if (errorDiv) errorDiv.textContent = '';

        // Transform data using authTransformer
        const passwordData = {
            oldPassword: oldPassword,
            newPassword: newPassword
        };
        const backendData = this.transformer.transformPasswordUpdateToBackend(passwordData);

        try {
            await authApiService.updatePassword(backendData);
            this.closePasswordModal();
            await this.stateManager.showAlert('Password changed successfully!', 'Success');
        } catch (error) {
            console.error('Failed to change password', error);
            await this.stateManager.showAlert(
                'Failed to change password: ' + (error.message || 'Unknown error'),
                'Error'
            );
        }
    }

    /**
     * Show confirmation dialog for account deletion
     * Uses dashboard state manager for confirmation
     */
    async confirmDeleteAccount() {
        const confirmed = await this.stateManager.showConfirm({
            title: 'Delete Account?',
            message: 'Are you sure you want to delete your account? This action cannot be undone. All your graphs, assessments, and data will be permanently deleted.',
            confirmText: 'Delete Account',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            await this.deleteAccount();
        }
    }

    /**
     * Delete user account
     * Uses authApiService for deletion
     */
    async deleteAccount() {
        try {
            await authApiService.deleteAccount();
            await this.stateManager.showAlert('Your account has been deleted. Redirecting to login...', 'Account Deleted');
            // Clear auth and redirect after a short delay
            setTimeout(() => {
                authApiService.logout();
                window.location.href = '/auth/login';
            }, 2000);
        } catch (error) {
            console.error('Failed to delete account', error);
            await this.stateManager.showAlert(
                'Failed to delete account: ' + (error.message || 'Unknown error'),
                'Error'
            );
        }
    }

    showError(msg) {
        this.container.innerHTML = `<div class="card error-card"><p>${msg}</p></div>`;
    }

    /**
     * Render dialog modal based on state
     * Called by state manager subscription
     * @param {Object} state - Current state
     */
    renderDialog(state) {
        const overlay = document.getElementById('custom-dialog-overlay');
        const modal = document.getElementById('custom-dialog');
        const title = document.getElementById('dialog-title');
        const message = document.getElementById('dialog-message');
        const cancelBtn = document.getElementById('dialog-cancel');
        const confirmBtn = document.getElementById('dialog-confirm');

        if (!overlay || !modal) return;

        if (state.dialog && state.dialog.isOpen) {
            title.textContent = state.dialog.title;
            message.textContent = state.dialog.message;
            confirmBtn.textContent = state.dialog.confirmText;

            // Show/hide cancel button based on dialog type
            if (state.dialog.type === 'confirm') {
                cancelBtn.style.display = 'inline-block';
                cancelBtn.textContent = state.dialog.cancelText;
            } else {
                cancelBtn.style.display = 'none';
            }

            overlay.style.display = 'block';
            document.body.style.overflow = 'hidden';
        } else {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
}
