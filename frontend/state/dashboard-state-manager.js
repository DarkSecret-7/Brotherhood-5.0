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
            proposalsError: null
            
        };

        this.listeners = [];
    }

    // --- State Access ---
    getState() {
        console.log('Getting state:', this.state);
        
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
        console.log(proposal);
        
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
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardStateManager };
} else {
    window.DashboardStateManager = DashboardStateManager;
}
