/**
 * Gallery State Manager - State management for public gallery page
 * Handles read-only gallery state, snapshot selection, and UI interactions
 */
class GalleryStateManager {
    constructor() {
        this.state = {
            // Gallery state
            publicSnapshots: [],
            currentSnapshot: null,
            isLoading: false,
            error: null,
            
            // UI state
            sidebarCollapsed: false,
            selectedSnapshotLabel: null,
            
            // Modal states
            modals: {
                nodeDetails: false,
                domainDetails: false
            },
            
            // Details panel state
            detailsPanel: {
                type: null, // 'node' or 'domain'
                data: null
            },
            
            // Graph visualization state
            graphState: {
                nodes: [],
                domains: [],
                network: null
            }
        };
        
        // Visualizer instance for direct access
        this.visualizer = null;

        // Initialize subscribers array
        this.subscribers = [];
        
        // Bind event listeners
        this.bindEventListeners();
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    /**
     * Notify subscribers of state changes
     */
    notify() {
        this.subscribers.forEach(callback => callback(this.state));
    }

    /**
     * Update loading state
     */
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.notify();
    }

    /**
     * Set error state
     */
    setError(error) {
        this.state.error = error;
        this.notify();
    }

    /**
     * Clear error state
     */
    clearError() {
        this.state.error = null;
        this.notify();
    }

    /**
     * Load public snapshots list
     */
    loadPublicSnapshots(snapshots) {
        this.state.publicSnapshots = snapshots;
        this.notify();
    }

    /**
     * Load current snapshot for viewing
     */
    loadCurrentSnapshot(snapshot) {
        this.state.currentSnapshot = snapshot;
        this.state.graphState.nodes = snapshot.nodes || [];
        this.state.graphState.domains = snapshot.domains || [];
        this.notify();
    }

    /**
     * Select a snapshot by label
     */
    selectSnapshot(public_uuid) {
        this.state.selectedSnapshotLabel = public_uuid;
        this.notify();
    }

    /**
     * Toggle sidebar state
     */
    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        this.notify();
    }

    /**
     * Set sidebar state
     */
    setSidebarCollapsed(collapsed) {
        this.state.sidebarCollapsed = collapsed;
        this.notify();
    }

    /**
     * Show node details modal
     */
    showNodeDetails(nodeData) {
        this.state.detailsPanel.type = 'node';
        this.state.detailsPanel.data = nodeData;
        this.state.modals.nodeDetails = true;
        this.notify();
    }

    /**
     * Show domain details modal
     */
    showDomainDetails(domainData) {
        this.state.detailsPanel.type = 'domain';
        this.state.detailsPanel.data = domainData;
        this.state.modals.domainDetails = true;
        this.notify();
    }

    /**
     * Close details modal
     */
    closeDetails() {
        this.state.modals.nodeDetails = false;
        this.state.modals.domainDetails = false;
        this.state.detailsPanel.type = null;
        this.state.detailsPanel.data = null;
        this.notify();
    }

    /**
     * Update graph network instance
     */
    setGraphNetwork(network) {
        this.state.graphState.network = network;
        this.notify();
    }

    /**
     * Destroy current graph network
     */
    destroyGraphNetwork() {
        if (this.state.graphState.network) {
            try {
                this.state.graphState.network.destroy();
            } catch (e) {
                console.warn("Error destroying network:", e);
            }
            this.state.graphState.network = null;
            this.notify();
        }
    }

    /**
     * Toggle domain collapse state (for display)
     */
    toggleDomainCollapse(domainId) {
        const domain = this.state.graphState.domains.find(d => String(d.local_id) === String(domainId));
        if (domain) {
            domain.collapsed = !domain.collapsed;
            this.notify();
        }
    }

    /**
     * Bind event listeners for window events
     */
    bindEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.state.graphState.network) {
                setTimeout(() => {
                    this.state.graphState.network.fit();
                }, 100);
            }
        });
    }

    /**
     * Get current state (for debugging)
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Reset state to initial
     */
    reset() {
        this.state = {
            publicSnapshots: [],
            currentSnapshot: null,
            isLoading: false,
            error: null,
            sidebarCollapsed: false,
            selectedSnapshotLabel: null,
            modals: {
                nodeDetails: false,
                domainDetails: false
            },
            detailsPanel: {
                type: null,
                data: null
            },
            graphState: {
                nodes: [],
                domains: [],
                network: null
            }
        };
        
        // Clear visualizer reference
        this.visualizer = null;
        
        this.notify();
    }
}

// Export singleton instance
const galleryStateManager = new GalleryStateManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GalleryStateManager, galleryStateManager };
} else {
    window.GalleryStateManager = GalleryStateManager;
    window.galleryStateManager = galleryStateManager;
}
