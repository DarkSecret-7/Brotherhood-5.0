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
            
            // Modal states
            modals: {
                graphAction: false,
                globalImport: false
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
        
        // Initialize service references
        this.snapshotsApiService = null;
        this.snapshotsTransformer = null;
    }

    /**
     * Initialize API service and transformer references
     */
    initializeServices(snapshotsApiService, snapshotsTransformer) {
        this.snapshotsApiService = snapshotsApiService;
        this.snapshotsTransformer = snapshotsTransformer;
    }

    /**
     * Ensure orchestration dependencies are available
     */
    ensureServicesInitialized() {
        if (!this.snapshotsApiService || !this.snapshotsTransformer) {
            throw new Error('Required services not initialized');
        }
    }

    /**
     * Stage transformed snapshot for workspace consumption.
     * Communication between frontend layers uses UUID as canonical identifier.
     * @param {Object} frontendSnapshot - Transformed snapshot object
     */
    stagePendingWorkspaceSnapshot(frontendSnapshot) {
        if (!frontendSnapshot || !frontendSnapshot.uuid) {
            throw new Error('Cannot stage pending snapshot without UUID');
        }

        const pendingEnvelope = {
            snapshotUuid: frontendSnapshot.uuid,
            snapshotHash: frontendSnapshot.hash || null,
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

            if (!snapshot || !snapshot.uuid) {
                localStorage.removeItem('pendingSnapshotLoad');
                return null;
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
     * Toggle modal state
     */
    toggleModal(modalName) {
        if (this.state.modals.hasOwnProperty(modalName)) {
            this.state.modals[modalName] = !this.state.modals[modalName];
            this.notifyStateChange();
        }
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
        this.ensureServicesInitialized();

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
            const backendSnapshots = await this.snapshotsApiService.getUserSnapshots();
            
            if (!backendSnapshots || backendSnapshots.length === 0) {
                this.clearCachedSnapshots();
                this.setLoadedSnapshots([]);
                return [];
            }

            // Transform backend data to frontend format
            const frontendSnapshots = this.snapshotsTransformer.transformSnapshotListFromBackend(backendSnapshots);
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
     * Save graph changes
     */
    async saveGraphChanges(newLabel, isPublic) {
        const currentSnapshot = this.getCurrentGraphActionSnapshot();
        if (!currentSnapshot) {
            throw new Error('No current snapshot selected');
        }
        
        if (!newLabel || newLabel.trim() === "") {
            throw new Error("Graph name cannot be empty");
        }
        
        this.ensureServicesInitialized();
        
        this.setLoading(true);
        this.clearError();
        
        try {
            const snapshotUuid = currentSnapshot.uuid;
            if (!snapshotUuid) {
                throw new Error('Current snapshot is missing UUID');
            }

            // API -> Transformer -> State/operation payload
            const backendSnapshot = await this.snapshotsApiService.getSnapshot(snapshotUuid, 'fetch');
            const frontendSnapshot = this.snapshotsTransformer.transformSnapshotFromBackend(backendSnapshot);

            if (!frontendSnapshot || !frontendSnapshot.uuid) {
                throw new Error('Could not transform snapshot for update');
            }

            frontendSnapshot.versionLabel = newLabel.trim();
            frontendSnapshot.isPublic = !!isPublic;

            const backendUpdatePayload = this.snapshotsTransformer.transformSnapshotToBackend(frontendSnapshot);
            backendUpdatePayload.version_label = frontendSnapshot.versionLabel;
            backendUpdatePayload.is_public = frontendSnapshot.isPublic;

            const updatedBackendSnapshot = await this.snapshotsApiService.updateSnapshot(snapshotUuid, backendUpdatePayload);
            const updatedFrontendSnapshot = this.snapshotsTransformer.transformSnapshotFromBackend(updatedBackendSnapshot);

            if (!updatedFrontendSnapshot || !updatedFrontendSnapshot.uuid) {
                throw new Error('Updated snapshot response missing UUID');
            }

            this.setCurrentGraphActionSnapshot(updatedFrontendSnapshot);
            
            // Refresh list
            await this.refreshSnapshots(true);
            
            return updatedFrontendSnapshot;
        } catch (error) {
            this.setError('Failed to save changes: ' + error.message);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Save workspace draft by delegating persistence to database management orchestration.
     * This method is the only save entry point workspace should use.
     * @param {Object} workspaceDraft - Raw workspace draft payload
     * @returns {Object} Transformed saved snapshot
     */
    async saveWorkspaceSnapshot(workspaceDraft) {
        this.ensureServicesInitialized();

        if (!workspaceDraft || !Array.isArray(workspaceDraft.nodes) || !Array.isArray(workspaceDraft.domains)) {
            throw new Error('Invalid workspace draft payload');
        }

        if (!workspaceDraft.versionLabel || workspaceDraft.versionLabel.trim() === '') {
            throw new Error('Version label is required');
        }

        this.setLoading(true);
        this.clearError();

        try {
            // Get current user for author data
            const currentUserUuid = window.authApiService?.getCurrentUserUuid();
            if (!currentUserUuid) {
                throw new Error('User not authenticated');
            }

            // Frontend draft -> Transformer -> backend payload
            const backendPayload = this.snapshotsTransformer.transformSnapshotToBackend(workspaceDraft);
            backendPayload.version_label = workspaceDraft.versionLabel.trim();
            
            // Add author data (only user_uuid is mandatory)
            backendPayload.created_by = {
                user_uuid: currentUserUuid
            };
            
            console.log('Workspace save payload:', backendPayload);

            const overwriteTargetUuid = workspaceDraft.currentSnapshotUuid || null;
            const shouldOverwrite = Boolean(workspaceDraft.overwrite && overwriteTargetUuid);
            if (workspaceDraft.overwrite && !overwriteTargetUuid) {
                console.warn('Overwrite requested without existing snapshot UUID. Falling back to create-new.');
            }

            let savedBackendSnapshot;
            if (shouldOverwrite) {
                savedBackendSnapshot = await this.snapshotsApiService.updateSnapshot(overwriteTargetUuid, backendPayload);
            } else {
                backendPayload.is_public = false;         // Initiatialise with false
                savedBackendSnapshot = await this.snapshotsApiService.createSnapshot(backendPayload);
            }

            // Backend response -> Transformer -> frontend state shape
            const savedFrontendSnapshot = this.snapshotsTransformer.transformSnapshotFromBackend(savedBackendSnapshot);
            if (!savedFrontendSnapshot || !savedFrontendSnapshot.uuid) {
                throw new Error('Saved snapshot response missing UUID');
            }

            //this.setCurrentGraphActionSnapshot(savedFrontendSnapshot);
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
        
        this.ensureServicesInitialized();
        
        try {
            // Use UUID for API call, version label only for filename
            const uuid = currentSnapshot.uuid;
            const label = currentSnapshot.versionLabel || ('graph_' + uuid);
            const blob = await this.snapshotsApiService.exportSnapshot(uuid);
            return { blob, label };
        } catch (error) {
            this.setError('Export failed: ' + error.message);
            throw error;
        }
    }

    /**
     * Import graph (overwrite existing)
     */
    async importGraph(file) {
        if (!file) {
            throw new Error('No file selected');
        }
        
        this.ensureServicesInitialized();
        
        this.setLoading(true);
        this.clearError();
        
        try {
            const result = await this.snapshotsApiService.importSnapshot(file, true);
            
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
        
        this.ensureServicesInitialized();
        
        this.setLoading(true);
        this.clearError();
        
        try {
            // Use UUID for API call
            const uuid = currentSnapshot.uuid;
            await this.snapshotsApiService.deleteSnapshot(uuid);
            
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
     */
    async globalImportGraph(file, overwrite) {
        if (!file) {
            throw new Error('No file selected');
        }
        
        this.ensureServicesInitialized();
        
        this.setLoading(true);
        this.clearError();
        
        try {
            const result = await this.snapshotsApiService.importSnapshot(file, overwrite);
            
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
        this.ensureServicesInitialized();
        
        try {
            if (!snapshotUuid) {
                throw new Error('Snapshot UUID is required');
            }

            const backendSnapshot = await this.snapshotsApiService.getSnapshot(snapshotUuid, 'fetch');
            
            // Transform backend snapshot to frontend format
            const frontendSnapshot = this.snapshotsTransformer.transformSnapshotFromBackend(backendSnapshot);
            
            if (!frontendSnapshot || !frontendSnapshot.uuid) {
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


