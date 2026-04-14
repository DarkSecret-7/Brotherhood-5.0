/**
 * Gallery State Manager - State management for the public gallery page
 * Handles snapshot loading, graph visualization state, and UI interactions (read-only)
 */
class GalleryStateManager {
    constructor() {
        this.state = {
            // Gallery list state
            snapshotList: [],
            currentSnapshot: null,
            
            // Current snapshot data
            nodes: [],
            domains: [],
            redirects: [],
            
            // Snapshot metadata
            currentSnapshotUuid: null,
            currentVersionLabel: '',
            baseGraphUuid: null,
            baseGraphLabel: null,
            createdAt: null,
            lastUpdated: null,
            isPublic: false,
            authors: [],
            
            // UI state
            isLoading: false,
            isLoadingList: false,
            error: null,
            
            // Node details panel state
            selectedNode: null,
            showNodeDetails: false,
            
            // Graph visualization state
            graphState: {
                nodes: [],
                edges: [],
                domains: [],
                defaultPositions: new Map(),
                currentPositionOverrides: new Map(),
                lastUpdated: null
            }
        };

        // Initialize subscribers array
        this.subscribers = [];
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - Callback function
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    /**
     * Notify all subscribers of state change
     */
    notifyStateChange() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Error in state change callback:', error);
            }
        });
    }

    /**
     * Set loading state
     * @param {boolean} isLoading - Loading state
     */
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.notifyStateChange();
    }

    /**
     * Set loading list state
     * @param {boolean} isLoadingList - Loading list state
     */
    setLoadingList(isLoadingList) {
        this.state.isLoadingList = isLoadingList;
        this.notifyStateChange();
    }

    /**
     * Set error state
     * @param {string|null} error - Error message
     */
    setError(error) {
        this.state.error = error;
        this.notifyStateChange();
    }

    /**
     * Load snapshot list from backend
     * @param {Array} frontendList - Frontend snapshot list from transformer
     */
    loadSnapshotList(frontendList) {
        this.state.snapshotList = frontendList || [];
        this.state.isLoadingList = false;
        this.notifyStateChange();
    }

    /**
     * Load snapshot by UUID - receives already transformed data from transformer
     * @param {Object} frontendSnapshot - Frontend snapshot object from transformer
     */
    loadSnapshot(frontendSnapshot) {
        this.setLoading(true);
        this.setError(null);

        try {
            console.log('Loading gallery snapshot:', frontendSnapshot);

            // Update state with transformed data
            this.state.nodes = frontendSnapshot.nodes || [];
            this.state.domains = frontendSnapshot.domains || [];
            this.state.redirects = frontendSnapshot.redirects || [];
            this.state.currentSnapshotUuid = frontendSnapshot.currentSnapshotUuid || null;
            this.state.currentVersionLabel = frontendSnapshot.currentVersionLabel || '';
            this.state.baseGraphUuid = frontendSnapshot.baseGraphUuid || null;
            this.state.baseGraphLabel = frontendSnapshot.baseGraphLabel || null;
            this.state.createdAt = frontendSnapshot.createdAt || null;
            this.state.lastUpdated = frontendSnapshot.lastUpdated || null;
            this.state.isPublic = frontendSnapshot.isPublic || false;
            this.state.authors = frontendSnapshot.authors || [];

            // Clear position overrides when loading a snapshot
            this.state.graphState.currentPositionOverrides = new Map();

            // Update graph visualization
            this.updateGraphVisualization();

            // Mark as clean
            this.state.isDirty = false;

            // Notify listeners
            this.notifyStateChange();

            return frontendSnapshot;

        } catch (error) {
            this.setError(error);
            this.setLoading(false);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Update graph visualization state
     */
    updateGraphVisualization() {
        if (!window.galleryTransformer) {
            console.warn('Gallery transformer not available');
            return;
        }

        const frontendSnapshot = {
            nodes: this.state.nodes,
            domains: this.state.domains
        };

        const graphData = window.galleryTransformer.transformToGraphVisualization(frontendSnapshot);
        
        this.state.graphState.nodes = graphData.nodes;
        this.state.graphState.edges = graphData.edges;
        this.state.graphState.domains = graphData.domains;
        this.state.graphState.defaultPositions = graphData.defaultPositions;
        this.state.graphState.lastUpdated = new Date();
    }

    /**
     * Select node and show details
     * @param {number} nodeId - Node ID
     */
    selectNode(nodeId) {
        const node = this.state.nodes.find(n => n.id === nodeId);
        if (node) {
            this.state.selectedNode = node;
            this.state.showNodeDetails = true;
            this.notifyStateChange();
        }
    }

    /**
     * Close node details panel
     */
    closeNodeDetails() {
        this.state.selectedNode = null;
        this.state.showNodeDetails = false;
        this.notifyStateChange();
    }

    /**
     * Get node by ID
     * @param {number} nodeId - Node ID
     * @returns {Object|null} Node object
     */
    getNodeById(nodeId) {
        return this.state.nodes.find(n => n.id === nodeId) || null;
    }

    /**
     * Get domain by ID
     * @param {number} domainId - Domain ID
     * @returns {Object|null} Domain object
     */
    getDomainById(domainId) {
        return this.state.domains.find(d => d.id === domainId) || null;
    }

    /**
     * Get nodes in domain
     * @param {number} domainId - Domain ID
     * @returns {Array} Nodes in domain
     */
    getNodesInDomain(domainId) {
        return this.state.nodes.filter(n => n.domainId === domainId);
    }

    /**
     * Get current graph state for visualization
     * @returns {Object} Graph state
     */
    getGraphState() {
        return this.state.graphState;
    }

    /**
     * Update graph position override (for drag operations)
     * @param {number} nodeId - Node ID
     * @param {Object} position - Position {x, y}
     */
    updateGraphPosition(nodeId, position) {
        this.state.graphState.currentPositionOverrides.set(nodeId, position);
        this.state.graphState.lastUpdated = new Date();
    }

    /**
     * Clear current snapshot
     */
    clearSnapshot() {
        this.state.currentSnapshot = null;
        this.state.nodes = [];
        this.state.domains = [];
        this.state.redirects = [];
        this.state.currentSnapshotUuid = null;
        this.state.currentVersionLabel = '';
        this.state.baseGraphUuid = null;
        this.state.baseGraphLabel = null;
        this.state.createdAt = null;
        this.state.lastUpdated = null;
        this.state.isPublic = false;
        this.state.authors = [];
        this.state.selectedNode = null;
        this.state.showNodeDetails = false;
        
        // Clear graph state
        this.state.graphState = {
            nodes: [],
            edges: [],
            domains: [],
            defaultPositions: new Map(),
            currentPositionOverrides: new Map(),
            lastUpdated: null
        };
        
        this.notifyStateChange();
    }

    /**
     * Show message (for user feedback)
     * @param {string} message - Message to show
     * @param {string} type - Message type (success, error, info)
     */
    showMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Could be extended to show toast notifications
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
