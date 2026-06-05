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
 * Database State Manager
 * Handles state management for the database page including snapshots, modals, and caching
 */
class DatabaseStateManager {
    constructor() {
        this.state = {
            // Snapshot data
            loadedSnapshots: [],
            cachedSnapshots: null,
            
            // Current action state
            currentGraphActionSnapshot: null,

            // Pending proposals for current graph
            pendingProposals: [],
            joinRequest: null,

            // Current proposal detail
            currentProposalDetail: null,

            // Modal states
            modals: {
                graphAction: false,
                globalImport: false,
                dialog: false,
                proposalDetail: false
            },
            
            // Dialog state
            dialog: {
                title: 'Confirm',
                message: '',
                type: 'alert', // 'alert', 'confirm', 'prompt'
                confirmText: 'OK',
                cancelText: 'Cancel',
                defaultValue: '',
                resolve: null
            },
            
            // Loading states
            isLoading: false,
            isRefreshing: false,
            
            // Error state
            error: null
        };

        // Initialize subscribers array
        this.subscribers = [];

        // Load cached data from localStorage
        this.loadCachedSnapshots();
        
        // Use global services from scope
    }


    /**
     * Stage transformed snapshot for workspace consumption.
     * Communication between frontend layers uses UUID as canonical identifier.
     * @param {Object} frontendSnapshot - Transformed snapshot object
     */
    stagePendingWorkspaceSnapshot(frontendSnapshot) {
        if (!frontendSnapshot || !frontendSnapshot.currentSnapshotUuid) {
            throw new Error('Cannot stage pending snapshot without UUID');
        }

        const pendingEnvelope = {
            snapshotUuid: frontendSnapshot.currentSnapshotUuid,
            stagedAt: new Date().toISOString(),
            snapshot: frontendSnapshot
        };

        localStorage.setItem('pendingSnapshotLoad', JSON.stringify(pendingEnvelope));
        return pendingEnvelope;
    }

    /**
     * Consume staged snapshot payload for workspace.
     * Supports both current envelope format and legacy direct snapshot payload.
     * @returns {Object|null} Frontend snapshot object
     */
    consumePendingWorkspaceSnapshot() {
        const rawPayload = localStorage.getItem('pendingSnapshotLoad');
        if (!rawPayload) {
            return null;
        }

        try {
            const parsed = JSON.parse(rawPayload);
            const snapshot = parsed?.snapshot ? parsed.snapshot : parsed;

            if (!snapshot || !snapshot.currentSnapshotUuid) {
                localStorage.removeItem('pendingSnapshotLoad');
                return null;
            }

            // Convert date strings back to Date objects
            if (snapshot.createdAt) {
                snapshot.createdAt = new Date(snapshot.createdAt);
            }
            if (snapshot.lastUpdated) {
                snapshot.lastUpdated = new Date(snapshot.lastUpdated);
            }

            localStorage.removeItem('pendingSnapshotLoad');
            return snapshot;
        } catch (error) {
            console.warn('Invalid pending snapshot payload. Clearing it.', error);
            localStorage.removeItem('pendingSnapshotLoad');
            return null;
        }
    }

    /**
     * Load cached snapshots from localStorage
     */
    loadCachedSnapshots() {
        try {
            const cached = localStorage.getItem('cachedSnapshots');
            if (cached) {
                const cachedData = JSON.parse(cached);
                if (Array.isArray(cachedData)) {
                    this.state.cachedSnapshots = cachedData;
                }
            }
        } catch (error) {
            console.warn('Failed to load cached snapshots:', error);
            this.state.cachedSnapshots = null;
        }
    }

    /**
     * Cache snapshots to localStorage
     */
    cacheSnapshots(snapshots) {
        try {
            if (Array.isArray(snapshots)) {
                localStorage.setItem('cachedSnapshots', JSON.stringify(snapshots));
                this.state.cachedSnapshots = snapshots;
            } else {
                localStorage.removeItem('cachedSnapshots');
                this.state.cachedSnapshots = null;
            }
        } catch (error) {
            console.warn('Failed to cache snapshots:', error);
        }
    }

    /**
     * Clear cached snapshots
     */
    clearCachedSnapshots() {
        localStorage.removeItem('cachedSnapshots');
        this.state.cachedSnapshots = null;
    }

    /**
     * Set loaded snapshots
     */
    setLoadedSnapshots(snapshots) {
        this.state.loadedSnapshots = Array.isArray(snapshots) ? snapshots : [];
        this.notifyStateChange();
    }

    /**
     * Get loaded snapshots
     */
    getLoadedSnapshots() {
        return this.state.loadedSnapshots;
    }

    /**
     * Get cached snapshots
     */
    getCachedSnapshots() {
        return this.state.cachedSnapshots;
    }

    /**
     * Set current graph action snapshot
     */
    setCurrentGraphActionSnapshot(snapshot) {
        this.state.currentGraphActionSnapshot = snapshot;
        this.notifyStateChange();
    }

    /**
     * Get current graph action snapshot
     */
    getCurrentGraphActionSnapshot() {
        return this.state.currentGraphActionSnapshot;
    }

    /**
     * Set pending proposals for current graph
     */
    setPendingProposals(proposals) {
        this.state.pendingProposals = Array.isArray(proposals) ? proposals : [];
        this.notifyStateChange();
    }

    /**
     * Get pending proposals
     */
    getPendingProposals() {
        return this.state.pendingProposals;
    }

    /**
     * Set current proposal detail
     */
    setCurrentProposalDetail(proposal) {
        this.state.currentProposalDetail = proposal;
        this.notifyStateChange();
    }

    /**
     * Get current proposal detail
     */
    getCurrentProposalDetail() {
        return this.state.currentProposalDetail;
    } 

    /**
     * Fetch proposals for a specific graph
     * @param {string} graphUuid - The graph UUID
     * @returns {Promise} Array of transformed proposals
     */
    async fetchProposalsForGraph(graphUuid) {
        const currentUserUuid = localStorage.getItem('user_uuid');

        try {
            const backendProposals = await window.proposalsApiService.getProposalsForGraph(graphUuid, true);
            const frontendProposals = window.proposalsTransformer.transformProposalListFromBackend(
                backendProposals || [],
                currentUserUuid
            );
            this.setPendingProposals(frontendProposals);
            return frontendProposals;
        } catch (error) {
            console.error('Failed to fetch proposals:', error);
            this.setPendingProposals([]);
            throw error;
        }
    }

    /**
     * Set join request
     */
    setJoinRequest(joinRequest) {
        this.state.joinRequest = joinRequest;
        this.notifyStateChange();
    }

    /**
     * Get join request
     */
    getJoinRequest() {
        return this.state.joinRequest;
    }

    /**
     * Fetch Join Request for current graph
     * @param {string} graphUuid - The graph UUID
     * @returns {Promise} Resolves with join request data
     */
    async fetchJoinRequestForGraph(graphUuid) {
        try {
            const backendJoinRequest = await window.proposalsApiService.getJoinRequestForGraph(graphUuid);
            const frontendJoinRequest = window.proposalsTransformer.transformJoinRequestFromBackend(backendJoinRequest);
            this.setJoinRequest(frontendJoinRequest);
            return frontendJoinRequest;
        } catch (error) {
            console.error('Failed to fetch join request:', error);
            this.setJoinRequest(null);
            throw error;
        }
    }

    /**
     * Set modal state
     */
    setModal(modalName, isOpen) {
        if (this.state.modals.hasOwnProperty(modalName)) {
            this.state.modals[modalName] = isOpen;
            this.notifyStateChange();
        }
    }

    /**
     * Get modal state
     */
    getModal(modalName) {
        return this.state.modals[modalName] || false;
    }

    /**
     * Show custom dialog modal
     * @param {Object} options - Dialog options (title, message, type, confirmText, cancelText, defaultValue)
     * @returns {Promise} Resolves with user response
     */
    showDialog(options) {
        this.state.dialog = {
            title: options.title || 'Notification',
            message: options.message || '',
            type: options.type || 'alert',
            confirmText: options.confirmText || 'OK',
            cancelText: options.cancelText || 'Cancel',
            defaultValue: options.defaultValue || '',
            resolve: null
        };
        this.state.modals.dialog = true;
        this.notifyStateChange();
        
        return new Promise((resolve) => {
            this.state.dialog.resolve = resolve;
        });
    }

    /**
     * Close dialog and resolve promise
     * @param {boolean} result - User response
     */
    closeDialog(result) {
        const dialog = this.state.dialog;
        const type = dialog.type;
        
        this.state.modals.dialog = false;
        
        if (dialog.resolve) {
            if (type === 'prompt') {
                const inputValue = document.getElementById('dialog-input')?.value || '';
                dialog.resolve(result ? inputValue : null);
            } else {
                dialog.resolve(result);
            }
            dialog.resolve = null;
        }
        
        this.notifyStateChange();
    }

    /**
     * Show custom alert
     * @param {string} message - Alert message
     */
    customAlert(message) {
        return this.showDialog({ type: 'alert', title: 'Alert', message });
    }

    /**
     * Show custom confirm dialog
     * @param {string} message - Confirm message
     */
    customConfirm(message) {
        return this.showDialog({ type: 'confirm', title: 'Confirm', message });
    }

    /**
     * Get dialog state
     */
    getDialog() {
        return { ...this.state.dialog };
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.notifyStateChange();
    }

    /**
     * Set refreshing state
     */
    setRefreshing(isRefreshing) {
        this.state.isRefreshing = isRefreshing;
        this.notifyStateChange();
    }

    /**
     * Set error state
     */
    setError(error) {
        this.state.error = error;
        this.notifyStateChange();
    }

    /**
     * Clear error
     */
    clearError() {
        this.state.error = null;
        this.notifyStateChange();
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        if (callback && typeof callback === 'function') {
            this.subscribers.push(callback);
        }
    }

    /**
     * Unsubscribe from state changes
     */
    unsubscribe(callback) {
        const index = this.subscribers.indexOf(callback);
        if (index > -1) {
            this.subscribers.splice(index, 1);
        }
    }

    /**
     * Notify all subscribers of state change
     */
    notifyStateChange() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.getState());
            } catch (error) {
                console.error('Error in state change callback:', error);
            }
        });
    }

    /**
     * Reset all state
     */
    reset() {
        this.state.loadedSnapshots = [];
        this.state.currentGraphActionSnapshot = null;
        this.state.modals.graphAction = false;
        this.state.modals.globalImport = false;
        this.state.isLoading = false;
        this.state.isRefreshing = false;
        this.state.error = null;
        this.notifyStateChange();
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.subscribers = [];
    }

    // ==================== BUSINESS LOGIC METHODS ====================

    /**
     * Refresh snapshots from API
     */
    async refreshSnapshots(force = false) {

        // Cache Check: If force is false, try to load from cache
        if (!force) {
            const cachedSnapshots = this.getCachedSnapshots();
            if (cachedSnapshots) {
                this.setLoadedSnapshots(cachedSnapshots);
                return cachedSnapshots;
            }
        }

        this.setRefreshing(true);
        this.clearError();
        
        try {
            const backendSnapshots = await snapshotsApiService.getSnapshots({ metadataOnly: true });

            console.log('Backend snapshots:', backendSnapshots);
            
            if (!backendSnapshots || backendSnapshots.length === 0) {
                this.clearCachedSnapshots();
                this.setLoadedSnapshots([]);
                return [];
            }

            // Transform backend data to frontend format
            const frontendSnapshots = snapshotsTransformer.transformSnapshotListFromBackend(backendSnapshots);
            console.log('Frontend snapshots:', frontendSnapshots);

            // Cache the new data and update state
            this.cacheSnapshots(frontendSnapshots);
            this.setLoadedSnapshots(frontendSnapshots);
            return frontendSnapshots;
        } catch (error) {
            console.error('Failed to load snapshots:', error);
            this.setError('Failed to load snapshots: ' + error.message);
            throw error;
        } finally {
            this.setRefreshing(false);
        }
    }

    /**
     * Save graph changes (metadata only update)
     * Delegates to transformer for API orchestration.
     */
    async saveGraphChanges(newLabel, isPublic) {
        const currentSnapshot = this.getCurrentGraphActionSnapshot();
        if (!currentSnapshot) {
            throw new Error('No current snapshot selected');
        }
        
        if (!newLabel || newLabel.trim() === "") {
            throw new Error("Graph name cannot be empty");
        }
        
        
        this.setLoading(true);
        this.clearError();
        
        try {
            const snapshotUuid = currentSnapshot.uuid;
            if (!snapshotUuid) {
                throw new Error('Current snapshot is missing UUID');
            }

            // Build workspace draft for metadata-only update
            const workspaceDraft = {
                versionLabel: newLabel.trim(),
                isPublic: !!isPublic,
                nodes: [],
                domains: [],
                currentSnapshotUuid: snapshotUuid,
                overwrite: true
            };

            // Delegate to transformer - it handles transformation + API call + response transformation
            const savedFrontendSnapshot = await snapshotsTransformer.saveSnapshot(workspaceDraft, {
                currentSnapshotUuid: snapshotUuid,
                overwrite: true,
                metadataOnly: true
            });

            if (!savedFrontendSnapshot || !savedFrontendSnapshot.currentSnapshotUuid) {
                throw new Error('Updated snapshot response missing UUID');
            }

            this.setCurrentGraphActionSnapshot(savedFrontendSnapshot);
            
            // Refresh list
            await this.refreshSnapshots(true);
            
            return savedFrontendSnapshot;
        } catch (error) {
            this.setError('Failed to save changes: ' + error.message);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Save workspace draft by delegating persistence to transformer.
     * This method is the only save entry point workspace should use.
     * Transformer handles: data conversion + API call + response transformation.
     * @param {Object} workspaceDraft - Raw workspace draft payload
     * @returns {Object} Transformed saved snapshot
     */
    async saveWorkspaceSnapshot(workspaceDraft) {

        if (!workspaceDraft || !Array.isArray(workspaceDraft.nodes) || !Array.isArray(workspaceDraft.domains)) {
            throw new Error('Invalid workspace draft payload');
        }

        if (!workspaceDraft.versionLabel || workspaceDraft.versionLabel.trim() === '') {
            throw new Error('Version label is required');
        }

        this.setLoading(true);
        this.clearError();

        try {
            // Get current user for author data (transformer will also check this)
            const currentUserUuid = window.authApiService?.getCurrentUserUuid();
            if (!currentUserUuid) {
                throw new Error('User not authenticated');
            }

            // Delegate to transformer - it handles transformation + API call + response transformation
            const overwriteTargetUuid = workspaceDraft.currentSnapshotUuid || null;
            const shouldOverwrite = Boolean(workspaceDraft.overwrite && overwriteTargetUuid);
            
            if (workspaceDraft.overwrite && !overwriteTargetUuid) {
                console.warn('Overwrite requested without existing snapshot UUID. Falling back to create-new.');
            }

            console.log('workspaceDraft', workspaceDraft);
            const savedFrontendSnapshot = await snapshotsTransformer.saveSnapshot(workspaceDraft, {
                currentSnapshotUuid: overwriteTargetUuid,
                overwrite: shouldOverwrite
            });

            if (!savedFrontendSnapshot || !savedFrontendSnapshot.currentSnapshotUuid) {
                throw new Error('Saved snapshot response missing UUID');
            }

            // Clear dirty flags and purge deleted items after successful save
            if (window.labStateManager) {
                window.labStateManager.clearDirtyFlags();
                window.labStateManager.purgeDeletedItems();
            }

            this.stagePendingWorkspaceSnapshot(savedFrontendSnapshot);
            this.clearCachedSnapshots();

            try {
                await this.refreshSnapshots(true);
            } catch (refreshError) {
                console.warn('Snapshot saved, but refresh failed:', refreshError);
            }

            return savedFrontendSnapshot;
        } catch (error) {
            this.setError('Failed to save workspace snapshot: ' + error.message);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Export graph
     */
    async exportGraph() {
        const currentSnapshot = this.getCurrentGraphActionSnapshot();
        if (!currentSnapshot) {
            throw new Error('No current snapshot selected');
        }
        
        try {
            // Use UUID for API call, version label only for filename
            const uuid = currentSnapshot.uuid;
            const label = currentSnapshot.versionLabel || ('graph_' + uuid);
            const blob = await snapshotsApiService.exportSnapshot(uuid);
            return { blob, label };
        } catch (error) {
            this.setError('Export failed: ' + error.message);
            throw error;
        }
    }

    /**
     * Import graph (overwrite existing)
     * Delegates to transformer for proper response transformation.
     */
    async importGraph(file, targetUuid) {
        if (!file) {
            throw new Error('No file selected');
        }
        
        this.setLoading(true);
        this.clearError();
        
        try {
            const result = await snapshotsTransformer.importSnapshot(file, true, targetUuid);
            
            // Refresh list
            await this.refreshSnapshots(true);
            
            return result;
        } catch (error) {
            this.setError('Import error: ' + error.message);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Delete graph
     */
    async deleteGraph() {
        const currentSnapshot = this.getCurrentGraphActionSnapshot();
        if (!currentSnapshot) {
            throw new Error('No current snapshot selected');
        }
        
        this.setLoading(true);
        this.clearError();
        
        try {
            // Use UUID for API call
            const uuid = currentSnapshot.uuid;
            await snapshotsApiService.deleteSnapshot(uuid);
            
            this.clearCachedSnapshots();
            await this.refreshSnapshots(true);
            
            return true;
        } catch (error) {
            this.setError('Error deleting snapshot: ' + error.message);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Global import graph
     * Delegates to transformer for proper response transformation.
     */
    async globalImportGraph(file, overwrite) {
        if (!file) {
            throw new Error('No file selected');
        }
        
        this.setLoading(true);
        this.clearError();
        
        try {
            const result = await this.snapshotsTransformer.importSnapshot(file, overwrite);
            
            // Refresh list
            await this.refreshSnapshots(true);
            
            return result;
        } catch (error) {
            this.setError('Import error: ' + error.message);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Fetch snapshot to workspace
     */
    async fetchSnapshotToWorkspace(snapshotUuid) {
        
        try {
            if (!snapshotUuid) {
                throw new Error('Snapshot UUID is required');
            }

            const backendSnapshot = await snapshotsApiService.getSnapshot(snapshotUuid, { action: 'fetch' });
            
            // Transform backend snapshot to frontend format
            const frontendSnapshot = snapshotsTransformer.transformSnapshotFromBackend(backendSnapshot);

            console.log('fetched snaphot:', frontendSnapshot);
            
            if (!frontendSnapshot || !frontendSnapshot.currentSnapshotUuid) {
                throw new Error('Transformed snapshot missing UUID');
            }

            // Stage transformed snapshot in localStorage for workspace to consume
            this.stagePendingWorkspaceSnapshot(frontendSnapshot);
            
            return frontendSnapshot;
        } catch (error) {
            this.setError('Error fetching snapshot: ' + error.message);
            throw error;
        }
    }
}

// Export singleton instance
const databaseStateManager = new DatabaseStateManager();

// Make globally available
if (typeof window !== 'undefined') {
    window.databaseStateManager = databaseStateManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DatabaseStateManager, databaseStateManager };
}

