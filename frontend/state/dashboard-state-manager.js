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
 * Dashboard State Manager
 * Single source of truth for dashboard-related state
 */
class DashboardStateManager {
    constructor() {
        this.state = {
            // Profile
            profile: null,
            profileEditMode: false,
            profileDirty: false,

            // Dialog State
            dialog: {
                isOpen: false,
                type: 'alert', // 'alert', 'confirm'
                title: '',
                message: '',
                confirmText: 'OK',
                cancelText: 'Cancel',
                resolve: null
            },

            // Proposals State
            proposals: {
                authored: { pending: [], notPending: [] },
                join: { pending: [], notPending: [] },
                received: { pending: [], notPending: [] },
                all: []
            },
            currentProposalTab: 'authored',         // authored, join, or received
            currentProposalDetail: null,
            isLoadingProposals: false,
            proposalsError: null,

            // Settings State
            settings: null,             // the canonical (server-confirmed) frontend-shaped settings object
            settingsDraft: null,        // the in-progress local copy the user is editing
            isSettingsDirty: false,     // true when the draft differs from the canonical settings
            isLoadingSettings: false,
            isSavingSettings: false,
            settingsError: null,
            // Transient save status surfaced next to the buttons, null | { type: 'ok'|'err', message: string }
            settingsSaveStatus: null
        };

        this.listeners = [];
    }

    // --- State Access ---
    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    // --- Observer Pattern ---
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // --- Business Logic ---
    setProfile(profile) {
        this.setState({ profile, profileDirty: false });
    }

    toggleProfileEditMode(enabled) {
        this.setState({ profileEditMode: enabled });
    }

    // --- Dialog Management ---

    /**
     * Show custom alert dialog
     * @param {string|Object} message - Alert message or options object { title, message }
     * @param {string} title - Dialog title (default: 'Alert')
     * @returns {Promise<void>} Resolves when dialog is closed
     */
    showAlert(message, title = 'Alert') {
        return new Promise((resolve) => {
            // Handle options object format: { title, message }
            const options = typeof message === 'object' ? message : { message, title };

            this.state.dialog = {
                isOpen: true,
                type: 'alert',
                title: options.title || title,
                message: options.message || message,
                confirmText: options.confirmText || 'OK',
                cancelText: options.cancelText || 'Cancel',
                resolve
            };
            this.notify();
        });
    }

    /**
     * Show custom confirm dialog
     * @param {string|Object} message - Confirm message or options object { title, message, confirmText, cancelText }
     * @param {string} title - Dialog title (default: 'Confirm')
     * @param {Object} dialogOptions - Additional options { confirmText, cancelText }
     * @returns {Promise<boolean>} Resolves with true (confirm) or false (cancel)
     */
    showConfirm(message, title = 'Confirm', dialogOptions = {}) {
        return new Promise((resolve) => {
            // Handle options object format: { title, message, confirmText, cancelText }
            const options = typeof message === 'object' ? message : { message, title, ...dialogOptions };

            this.state.dialog = {
                isOpen: true,
                type: 'confirm',
                title: options.title || title,
                message: options.message || message,
                confirmText: options.confirmText || 'OK',
                cancelText: options.cancelText || 'Cancel',
                resolve
            };
            this.notify();
        });
    }

    /**
     * Close dialog and resolve the promise
     * @param {boolean} result - User response (true for confirm/ok, false for cancel)
     */
    closeDialog(result) {
        const { resolve } = this.state.dialog;
        this.state.dialog = {
            ...this.state.dialog,
            isOpen: false,
            resolve: null
        };
        this.notify();
        if (resolve) {
            resolve(result);
        }
    }

    // --- Proposals Methods ---

    /**
     * Set proposals for a specific tab
     */
    setProposals(tab, categorized) {
        this.state.proposals[tab] = categorized;
        this.state.proposals['all'] = [...this.state.proposals['all'], ...categorized.pending, ...categorized.notPending];
        this.notify();
    }

    /**
     * Get proposals for a specific tab
     */
    getProposals(tab) {
        return this.state.proposals[tab];
    }

    /**
     * Set current proposal detail
     */
    setCurrentProposalDetail(proposal) {
        this.state.currentProposalDetail = proposal;
        this.notify();
    }


    /**
     * Get current proposal detail
     */
    getCurrentProposalDetail() {
        return this.state.currentProposalDetail;
    }

    /**
     * Set proposals loading state
     */
    setLoadingProposals(loading) {
        this.state.isLoadingProposals = loading;
        this.notify();
    }

    /**
     * Set proposals error
     */
    setProposalsError(error) {
        this.state.proposalsError = error;
        this.notify();
    }

    /**
     * Load join requests (Join proposals sent by user)
     */
    async loadJoinRequests() {
        this.setLoadingProposals(true);
        this.setProposalsError(null);
        try {
            const backendRequests = await window.proposalsApiService.getJoinRequests();
            const frontendRequests = window.proposalsTransformer.transformJoinRequestListFromBackend(backendRequests, true);
            this.setProposals('join', frontendRequests);
            return frontendRequests;
        } catch (error) {
            console.error('Failed to load join requests:', error);
            this.setProposalsError('Failed to load join requests');
            throw error;
        } finally {
            this.setLoadingProposals(false);
        }
    }

    /**
     * Load authored proposals (proposals on graphs user is author of)
     */
    async loadAuthoredProposals() {
        this.setLoadingProposals(true);
        this.setProposalsError(null);
        try {
            const currentUserUuid = window.authApiService?.getCurrentUserUuid();
            const backendProposals = await window.proposalsApiService.getAuthoredProposals();
            const frontendProposals = window.proposalsTransformer.transformProposalListFromBackend(backendProposals, currentUserUuid, true);
            this.setProposals('authored', frontendProposals);
            return frontendProposals;
        } catch (error) {
            console.error('Failed to load authored proposals:', error);
            this.setProposalsError('Failed to load authored proposals');
            throw error;
        } finally {
            this.setLoadingProposals(false);
        }
    }

    /**
     * Load received invitations (authorship invitations sent to user)
     */
    async loadReceivedInvitations() {
        this.setLoadingProposals(true);
        this.setProposalsError(null);
        try {
            const backendInvitations = await window.proposalsApiService.getReceivedInvitations();
            const frontendInvitations = window.proposalsTransformer.transformInvitationListFromBackend(backendInvitations, true);
            this.setProposals('received', frontendInvitations);
            return frontendInvitations;
        } catch (error) {
            console.error('Failed to load received invitations:', error);
            this.setProposalsError('Failed to load received invitations');
            throw error;
        } finally {
            this.setLoadingProposals(false);
        }
    }

    /**
     * Load all proposals
     */
    async loadAllProposals() {
        await Promise.all([
            this.loadAuthoredProposals(),
            this.loadJoinRequests(),
            this.loadReceivedInvitations()
        ]);
    }

    /**
     * Vote on a proposal
     */
    async voteProposal(proposalHash, vote) {
        try {
            await window.proposalsApiService.respondToProposal(proposalHash, {
                proposal_hash: proposalHash,
                user_uuid: window.authApiService?.getCurrentUserUuid(),
                user_vote: vote
            });
            // Reload all proposals after voting
            await this.loadAllProposals();
            return true;
        } catch (error) {
            console.error('Failed to vote:', error);
            throw error;
        }
    }

    /**
     * Delete a proposal
     */
    async deleteProposal(proposalHash) {
        try {
            await window.proposalsApiService.deleteProposal(proposalHash);
            // Reload all proposals after deleting
            await this.loadAllProposals();
            return true;
        } catch (error) {
            console.error('Failed to delete proposal:', error);
            throw error;
        }
    }

    /**
     * Respond to an authorship invitation (accept or reject).
     * @param {Object} invitation - Invitation object with graphUuid and publicHash
     * @param {boolean} accept - true to accept, false to reject
     */
    async respondToInvitation(invitation, accept) {
        try {
            await window.authorshipApiService.respondToInvitation(
                invitation.graphUuid,
                invitation.publicHash,
                accept
            );
            await this.loadAllProposals();
            return true;
        } catch (error) {
            console.error('Failed to respond to invitation:', error);
            throw error;
        }
    }

    // --- Settings Methods ---

    /**
     * Set the loaded settings object (frontend-shaped).
     *
     * When the server returned null for a known key (e.g. the user has
     * never saved that preference), the draft is seeded with the
     * localStorage fallback so that recomputeSettingsDirty works
     * correctly from the very first toggle.
     *
     * @param {Object} settings
     */
    setSettings(settings) {
        let draft = null;
        if (settings) draft = this.calculateDraft(settings);
        this.setState({
            settings,
            settingsDraft: draft,
            isSettingsDirty: this.calculateSettingsDiff(settings, draft),
            settingsError: null
        });
    }

    /**
     * Calculate the draft settings given a settings object from the server,
     * Put all interpretation logic here on unknown keys.
     * @param {dict} settings 
     * @returns {dict}
     */
    calculateDraft(settings) {
        const draft = { ...settings };
        // If the server has no stored value for darkMode, seed the draft
        // from localStorage so dirty-detection has a reference point.
        if (typeof draft.darkMode !== 'boolean') {
            console.log(localStorage.getItem('setting_dark_mode'));
            
            draft.darkMode = localStorage.getItem('setting_dark_mode') === 'true';
        }

        return draft;
    }

    /**
     * Calculate the difference between the settings object and the draft.
     * @param {Object} settings
     * @param {Object} draft
     * @returns {boolean} True if the settings object and draft are different, false otherwise
     */
    calculateSettingsDiff(settings, draft) {
        if (!settings || !draft) {
            return false;
        }
        return Object.keys(settings).some(key => settings[key] !== draft[key]);
    }

    /**
     * Set the loading flag for the initial settings fetch.
     * @param {boolean} loading
     */
    setSettingsLoading(loading) {
        this.state.isLoadingSettings = loading;
        this.notify();
    }

    /**
     * Set the saving flag for in-flight upserts.
     * @param {boolean} saving
     */
    setSettingsSaving(saving) {
        this.state.isSavingSettings = saving;
        this.notify();
    }

    /**
     * Set the error message for the settings view.
     * @param {string|null} error
     */
    setSettingsError(error) {
        this.state.settingsError = error;
        this.notify();
    }

    // --- Settings Draft Methods (save-driven flow) ---

    /**
     * Update one or more fields on the local draft and recompute
     * `isSettingsDirty`. Visual theme is also flipped immediately
     * via `window.__theme.set` so the user sees the change without
     * waiting for the save round-trip.
     *
     * @param {Object} patch - Partial settings fields to apply
     */
    updateSettingsDraft(patch) {
        if (!this.state.settingsDraft) return;
        const next = { ...this.state.settingsDraft, ...patch };
        this.state.settingsDraft = next;
        this.recomputeSettingsDirty();
        // Flip the document theme eagerly for the user-visible key.
        if (patch && Object.prototype.hasOwnProperty.call(patch, 'darkMode') && window.__theme) {
            window.__theme.set(next.darkMode ? 'dark' : 'light');
        }
        this.notify();
    }

    /**
     * Recompute `isSettingsDirty` from the current canonical/draft pair.
     *
     * When the server has never stored a value for a key (`settings` is null
     * or the key is null on the settings object), we compare the draft against
     * the localStorage fallback value so that a user who toggled the theme
     * locally before ever saving is correctly shown as having unsaved changes.
     */
    recomputeSettingsDirty() {
        const draft = this.state.settingsDraft;
        if (!draft) {
            this.state.isSettingsDirty = false;
            return;
        }

        const canonical = this.state.settings;

        // Resolve the reference dark-mode value:
        //   1. canonical.darkMode if it is a definite boolean from the server
        //   2. localStorage fallback (what was applied on page-load)
        //   3. default false
        let refDarkMode;
        if (canonical && typeof canonical.darkMode === 'boolean') {
            refDarkMode = canonical.darkMode;
        } else {
            refDarkMode = localStorage.getItem('setting_dark_mode') === 'true';
        }

        this.state.isSettingsDirty = !!refDarkMode !== !!draft.darkMode;
    }

    /**
     * Drop the draft and copy the canonical settings back over it.
     * Also clears any stale save status.
     *
     * When the canonical settings is null (never saved) or darkMode is null
     * (key not yet stored), we fall back to localStorage for the theme restore.
     */
    discardSettingsDraft() {
        const canonical = this.state.settings;

        // Re-build the reference draft (mirrors setSettings logic).
        let draft = null;
        if (canonical) {
            draft = { ...canonical };
            if (typeof draft.darkMode !== 'boolean') {
                draft.darkMode = localStorage.getItem('setting_dark_mode') === 'true';
            }
        } else if (this.state.settingsDraft) {
            // If we have no canonical yet, reset the draft to the localStorage value.
            draft = { darkMode: localStorage.getItem('setting_dark_mode') === 'true' };
        } else {
            return;
        }

        this.state.settingsDraft = draft;
        this.state.isSettingsDirty = false;
        this.state.settingsSaveStatus = null;

        // Re-apply the reference theme immediately.
        if (window.__theme) {
            window.__theme.set(draft.darkMode ? 'dark' : 'light');
        }
        this.notify();
    }


    /**
     * Replace the canonical settings with the supplied value (the
     * server-confirmed copy returned by the save) and clear the draft.
     *
     * @param {Object} settings
     */
    acceptSavedSettings(settings) {
        this.setState({
            settings,
            settingsDraft: settings ? { ...settings } : null,
            isSettingsDirty: false,
            settingsSaveStatus: { type: 'ok', message: 'Settings saved.' }
        });
    }

    /**
     * Persist a transient save-status message to be rendered next to
     * the Save/Discard buttons. Cleared on the next user action.
     */
    setSettingsSaveStatus(status) {
        this.state.settingsSaveStatus = status;
        this.notify();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardStateManager };
} else {
    window.DashboardStateManager = DashboardStateManager;
}
