/*
 * Database Manager
 * Handles database operations and snapshot management for the database page
 * Uses DatabaseStateManager for state management
 */
class DatabaseManager {
    constructor(stateManager) {
        this.snapshotsApiService = window.snapshotsApiService;
        this.stateManager = stateManager;
        this.initializeEventListeners();
        
        // Subscribe to state changes
        this.stateManager.subscribe(this.handleStateChange.bind(this));
    }

    initializeEventListeners() {
        // Add event listeners for modal triggers if they exist
        document.addEventListener('click', (e) => {
            if (e.target.id === 'global-import-btn') {
                this.openGlobalImportModal();
            }
            if (e.target.id === 'refresh-btn') {
                this.refreshSnapshots(force=true);
            }
        });

        // Dialog button handlers using event delegation
        document.addEventListener('click', (e) => {
            // Close button (X) click
            if (e.target.closest('#dialogModal .close')) {
                e.preventDefault();
                e.stopPropagation();
                this.stateManager.closeDialog(false);
                return;
            }

            // Cancel button click
            if (e.target.id === 'dialog-cancel-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.stateManager.closeDialog(false);
                return;
            }

            // OK/Confirm button click
            if (e.target.id === 'dialog-confirm-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.stateManager.closeDialog(true);
                return;
            }
        });

        // Overlay click to close
        const dialogModal = document.getElementById('dialogModal');
        if (dialogModal) {
            dialogModal.addEventListener('click', (e) => {
                if (e.target === dialogModal) {
                    this.stateManager.closeDialog(false);
                }
            });
        }
    }

    /**
     * Handle state changes from state manager
     */
    handleStateChange(state) {
        // On first call, ensure all modals are hidden (defensive)
        if (!this._initialized) {
            this._initialized = true;
            const graphActionModal = document.getElementById('graphActionModal');
            const globalImportModal = document.getElementById('globalImportModal');
            const dialogModal = document.getElementById('dialogModal');
            if (graphActionModal) graphActionModal.style.display = 'none';
            if (globalImportModal) globalImportModal.style.display = 'none';
            if (dialogModal) dialogModal.style.display = 'none';
        }

        // Handle loading states
        if (state.isLoading || state.isRefreshing) {
            // Update UI to show loading state if needed
        }

        // Handle errors
        if (state.error) {
            console.error('Database manager error:', state.error);
        }

        // Handle modal states
        if (state.modals.graphAction !== undefined) {
            const modal = document.getElementById('graphActionModal');
            if (modal) {
                modal.style.display = state.modals.graphAction ? 'flex' : 'none';
            }
        }

        if (state.modals.globalImport !== undefined) {
            const modal = document.getElementById('globalImportModal');
            if (modal) {
                modal.style.display = state.modals.globalImport ? 'flex' : 'none';
            }
        }

        // Handle dialog modal
        if (state.modals.dialog !== undefined) {
            const modal = document.getElementById('dialogModal');
            const dialog = state.dialog;
            if (modal) {
                modal.style.display = state.modals.dialog ? 'flex' : 'none';
                
                // Update dialog content
                if (state.modals.dialog) {
                    document.getElementById('dialog-title').textContent = dialog.title;
                    document.getElementById('dialog-body').textContent = dialog.message;
                    
                    const inputContainer = document.getElementById('dialog-input-container');
                    const inputEl = document.getElementById('dialog-input');
                    const cancelBtn = document.getElementById('dialog-cancel-btn');
                    const confirmBtn = document.getElementById('dialog-confirm-btn');
                    
                    if (dialog.type === 'prompt') {
                        inputContainer.style.display = 'block';
                        inputEl.value = dialog.defaultValue || '';
                        cancelBtn.style.display = 'inline-block';
                    } else if (dialog.type === 'confirm') {
                        inputContainer.style.display = 'none';
                        cancelBtn.style.display = 'inline-block';
                    } else {
                        inputContainer.style.display = 'none';
                        cancelBtn.style.display = 'none';
                    }
                    
                    confirmBtn.textContent = dialog.confirmText || 'OK';
                    cancelBtn.textContent = dialog.cancelText || 'Cancel';
                }
            }
        }
    }

    async refreshSnapshots(force = false) {
        const listDiv = document.getElementById('snapshots-list');
        if (!listDiv) return;

        listDiv.innerHTML = '<p class="empty-state">Loading database snapshots...</p>';
        
        try {
            const snapshots = await this.stateManager.refreshSnapshots(force);
            
            if (!snapshots || snapshots.length === 0) {
                listDiv.innerHTML = '<p class="empty-state">No saved graphs found. Import a .knw file to get started!</p>';
                return;
            }

            this.renderSnapshots(snapshots);
        } catch (error) {
            console.error('Failed to refresh snapshots:', error);
            listDiv.innerHTML = '<p class="empty-state">Error loading snapshots. Please try again.</p>';
        }
    }

    renderSnapshots(snapshots) {
        this.stateManager.setLoadedSnapshots(snapshots);
        const listDiv = document.getElementById('snapshots-list');
        if (!listDiv) return;
        
        let html = '<table class="snapshots-table"><thead><tr><th>Version</th><th>Nodes</th><th>Assessable</th><th>Authors</th><th>Based On</th><th>Actions</th></tr></thead><tbody>';
        
        for (let i = 0; i < snapshots.length; i++) {
            const s = snapshots[i];
            console.log(s);
            
            const createdDate = s.createdAt ? s.createdAt.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown';
            const updatedDate = s.lastUpdated ? s.lastUpdated.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown';
            const versionLabel = s.versionLabel || '#' + s.uuid;
            const authors = s.authors && s.authors.length > 0 
                ? s.authors.map(author => author.username || author.displayName || 'Unknown').join(', ')
                : 'None';
            
            html += '<tr>' +
                '<td style="cursor: pointer; color: #1a73e8; font-weight: 500;" onclick="databaseManager.openGraphActionModal(' + i + ')">' +
                    '<div class="version-badge">' + versionLabel + '</div>' +
                    '<div style="font-size: 0.7em; color: #9aa0a6; margin-top: 6px; line-height: 1.3;">' +
                        '<b>C:</b> ' + createdDate + '<br>' +
                        '<b>U:</b> ' + updatedDate +
                    '</div>' +
                '</td>' +
                '<td>' + (s.nodeCount || 0) + '</td>' +
                '<td>' + (s.assessableNodeCount || 0) + '</td>' +
                '<td>' + (authors) + '</td>' +
                '<td>' + (s.baseGraphLabel || 'None') + '</td>' +
                '<td>' +
                    '<div style="display: flex; gap: 5px;">' +
                        '<button class="btn-secondary btn-small" onclick="databaseManager.fetchSnapshotToWorkspace(event, \'' + s.uuid + '\')">Fetch</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }
        
        html += '</tbody></table>';
        listDiv.innerHTML = html;
    }

    openGraphActionModal(index) {
        const snapshots = this.stateManager.getLoadedSnapshots();
        const snapshot = snapshots[index];
        if (!snapshot) return;

        console.log(snapshot);
        
        this.stateManager.setCurrentGraphActionSnapshot(snapshot);
        
        // Set Graph Name
        document.getElementById('graph-action-label-input').value = snapshot.versionLabel || ('v' + snapshot.uuid);
        
        // Set Info
        document.getElementById('graph-action-uuid').textContent = snapshot.uuid;
        document.getElementById('graph-action-created').textContent = snapshot.createdAt ? snapshot.createdAt.toLocaleString() : 'Unknown';
        document.getElementById('graph-action-updated').textContent = snapshot.lastUpdated ? snapshot.lastUpdated.toLocaleString() : 'Unknown';
        document.getElementById('graph-action-nodes').textContent = snapshot.nodeCount || 0;
        
        // Set Author
        const authorElement = document.getElementById('graph-action-author');
        if (snapshot.authors && snapshot.authors.length > 0) {
            authorElement.textContent = snapshot.authors.map(author => author.username || 'Unknown').join(', ');
        } else {
            authorElement.textContent = 'Unknown';
        }
        
        // Set Public Toggle
        document.getElementById('graph-action-public-toggle').checked = snapshot.isPublic || false;
        
        // Reset file input
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) fileInput.value = '';
        
        this.stateManager.setModal('graphAction', true);
        document.getElementById('graphActionModal').style.display = 'flex';
    }

    closeGraphActionModal() {
        const modal = document.getElementById('graphActionModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.stateManager.setCurrentGraphActionSnapshot(null);
        this.stateManager.setModal('graphAction', false);
    }

    async fetchSnapshotToWorkspace(event, snapshotUuid) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Find the snapshot to get its version label for display
        const snapshots = this.stateManager.getLoadedSnapshots();
        const snapshot = snapshots.find(s => s.uuid === snapshotUuid);
        const displayLabel = snapshot ? snapshot.versionLabel : '#' + snapshotUuid;

        const confirmMsg = `STOP! This will clear your current workspace and load snapshot "${displayLabel}" (UUID: ${snapshotUuid}). Continue?`;
        
        const confirmed = await this.stateManager.customConfirm(confirmMsg);
        if (confirmed) {
            try {
                await this.stateManager.fetchSnapshotToWorkspace(snapshotUuid);
                window.location.href = '/lab/workspace';
            } catch (err) {
                this.stateManager.customAlert('Error fetching snapshot: ' + err.message);
            }
        }
    }

    async saveGraphChanges() {
        const newLabel = document.getElementById('graph-action-label-input').value;
        const isPublic = document.getElementById('graph-action-public-toggle').checked;
        
        try {
            await this.stateManager.saveGraphChanges(newLabel, isPublic);
            this.stateManager.customAlert('Changes saved successfully!');
            this.closeGraphActionModal();
            this.refreshSnapshots(true);
        } catch (err) {
            this.stateManager.customAlert('Error saving changes: ' + err.message);
        }
    }

    async triggerExportGraph() {
        try {
            const { blob, label } = await this.stateManager.exportGraph();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = label + '.knw';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            this.stateManager.customAlert('Export failed: ' + err.message);
        }
    }

    async triggerImportGraph() {
        const fileInput = document.getElementById('import-file-input');
        
        if (!fileInput || fileInput.files.length === 0) {
            this.stateManager.customAlert('Please select a .knw file.');
            return;
        }
        
        const file = fileInput.files[0];
        
        const confirmed = await this.stateManager.customConfirm('WARNING: This will completely replace the current graph with the imported file. Are you sure?');
        if (confirmed) {
            try {
                await this.stateManager.importGraph(file);
                this.stateManager.customAlert('Graph overwritten successfully!');
                this.closeGraphActionModal();
            } catch (err) {
                this.stateManager.customAlert('Import error: ' + err.message);
            }
        }
    }

    async triggerDeleteGraph() {
        const confirmed = await this.stateManager.customConfirm('PERMANENT DELETE! Are you sure you want to remove this graph?');
        if (confirmed) {
            try {
                await this.stateManager.deleteGraph();
                this.closeGraphActionModal();
                this.refreshSnapshots(true);
            } catch (err) {
                this.stateManager.customAlert('Error deleting snapshot: ' + err.message);
            }
        }
    }

    openGlobalImportModal() {
        document.getElementById('global-import-file').value = '';
        document.getElementById('global-import-overwrite').checked = false;
        this.stateManager.setModal('globalImport', true);
        document.getElementById('globalImportModal').style.display = 'flex';
    }

    closeGlobalImportModal() {
        const modal = document.getElementById('globalImportModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.stateManager.setModal('globalImport', false);
    }

    async submitGlobalImport() {
        const fileInput = document.getElementById('global-import-file');
        const overwrite = document.getElementById('global-import-overwrite').checked;

        if (!fileInput || fileInput.files.length === 0) {
            this.stateManager.customAlert('Please select a .knw file.');
            return;
        }

        const file = fileInput.files[0];
        
        try {
            await this.stateManager.globalImportGraph(file, overwrite);
            this.stateManager.customAlert('Graph imported successfully!');
            this.closeGlobalImportModal();
            this.refreshSnapshots(true);
        } catch (err) {
            this.stateManager.customAlert('Import error: ' + err.message);
        }
    }
}

// Initialize database manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if required services are available
    if (window.snapshotsApiService && window.databaseStateManager && window.snapshotsTransformer) {
        // Initialize services in state manager
        window.databaseStateManager.initializeServices(window.snapshotsApiService, window.snapshotsTransformer);
        
        // Initialize database manager
        window.databaseManager = new DatabaseManager(window.databaseStateManager);
        
        // Auto-load snapshots
        window.databaseManager.refreshSnapshots(false);
    } else {
        console.error('Required services not available:', {
            snapshotsApiService: !!window.snapshotsApiService,
            databaseStateManager: !!window.databaseStateManager,
            snapshotsTransformer: !!window.snapshotsTransformer
        });
    }
});

