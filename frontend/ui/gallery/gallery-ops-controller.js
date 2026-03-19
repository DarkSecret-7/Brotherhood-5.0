/**
 * Gallery Operations Controller - Business logic for public gallery
 * Handles all user operations, API calls, and state mutations
 */
class GalleryOpsController {
    constructor(stateManager, apiService, transformer) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        this.transformer = transformer;
        this.visualizer = null; // Store visualizer instance like lab
        
        // Setup event listeners for UI events
        this.setupEventListeners();
        
        // Initialize gallery
        this.initializeGallery();
    }

    /**
     * Initialize gallery on page load
     */
    async initializeGallery() {
        await this.loadPublicSnapshots();
    }

    /**
     * Setup event listeners for custom events from UI controller
     */
    setupEventListeners() {
        // Graph selection events
        document.addEventListener('galleryGraphItemSelected', (event) => {
            this.handleGraphSelection(event.detail.public_uuid);
        });
        
        // Domain toggle events
        document.addEventListener('galleryDomainToggleClicked', (event) => {
            this.handleDomainToggle(event.detail.domainId);
        });
        
        // Refresh events
        document.addEventListener('galleryRefreshClicked', () => {
            this.handleRefresh();
        });
        
        // Close details events
        document.addEventListener('galleryCloseDetailsClicked', () => {
            this.handleCloseDetails();
        });
        
        // Sidebar toggle events
        document.addEventListener('galleryToggleSidebarClicked', () => {
            this.handleSidebarToggle();
        });
    }

    /**
     * Load all public snapshots
     */
    async loadPublicSnapshots() {
        try {
            this.stateManager.setLoading(true);
            this.stateManager.clearError();
            
            const backendSnapshots = await this.apiService.getPublicGallerySnapshots();
            const gallerySnapshots = this.transformer.transformPublicSnapshotList(backendSnapshots);
            
            this.stateManager.loadPublicSnapshots(gallerySnapshots);
        } catch (error) {
            console.error('Failed to load public snapshots:', error);
            this.stateManager.setError(error.message);
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    /**
     * Handle graph selection
     */
    async handleGraphSelection(public_uuid) {
        try {
            this.stateManager.setLoading(true);
            this.stateManager.clearError();
            
            // Select the snapshot
            this.stateManager.selectSnapshot(public_uuid);
            
            // Load the full snapshot data
            const backendSnapshot = await this.apiService.getPublicGallerySnapshot(public_uuid);
            const gallerySnapshot = this.transformer.transformGallerySnapshot(backendSnapshot);
            
            // Update state with new snapshot
            this.stateManager.loadCurrentSnapshot(gallerySnapshot);
            
            // Render the graph using existing visualization logic
            this.renderGraph(gallerySnapshot);
            
        } catch (error) {
            console.error('Failed to load graph:', error);
            this.stateManager.setError(error.message);
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    /**
     * Render graph using existing GraphVisualizer (follows lab pattern)
     */
    renderGraph(gallerySnapshot) {
        // Destroy existing network
        this.stateManager.destroyGraphNetwork();
        
        // Process gallery data for GraphVisualizer
        const graphState = this.processGalleryData(gallerySnapshot);
        
        // Get graph container
        const container = document.getElementById('graph-container');
        if (!container) {
            console.error('Graph container not found');
            this.stateManager.setError('Graph container not found');
            return;
        }
        
        // Initialize visualizer if not exists (follows lab pattern)
        if (!this.visualizer) {
            this.visualizer = new GraphVisualizer(container, {
                onNodeClick: (nodeId) => this.handleNodeInteraction(nodeId),
                onDomainClick: (domainId) => this.handleDomainInteraction(domainId),
                onPositionChange: () => {} // Gallery is read-only, no position changes
            });
        }
        
        // Update visualization
        this.visualizer.updateVisualization(graphState);
        
        // Store network in state manager
        this.stateManager.setGraphNetwork(this.visualizer.network);
        this.stateManager.visualizer = this.visualizer; // Store visualizer instance
        
        // Store graph state for domain interactions
        this.stateManager.getState().graphState.nodes = graphState.nodes;
        this.stateManager.getState().graphState.domains = graphState.domains;
        this.stateManager.notify();
        
        // Fit to view
        setTimeout(() => {
            this.visualizer.fitToView();
        }, 100);
    }

    /**
     * Process gallery snapshot data for GraphVisualizer
     * @param {Object} gallerySnapshot - Gallery snapshot data
     * @returns {Object} Processed graph state
     */
    processGalleryData(gallerySnapshot) {
        if (!gallerySnapshot) {
            return {
                nodes: [],
                edges: [],
                pathways: [],
                domains: [],
                defaultPositions: new Map(),
                currentPositionOverrides: new Map(),
            };
        }

        const nodes = this.processNodes(gallerySnapshot.nodes || []);
        const edges = this.processEdges(gallerySnapshot.nodes || []);
        const domains = this.processDomains(gallerySnapshot.domains || []);
        const defaultPositions = this.createDefaultPositions(gallerySnapshot.nodes || []);

        return {
            nodes,
            edges,
            pathways: [], // Gallery doesn't have pathways
            domains,
            defaultPositions,
            currentPositionOverrides: new Map(), // Required for proper visualizer operation
        };
    }

    /**
     * Process gallery nodes for GraphVisualizer
     * @param {Array} galleryNodes - Gallery nodes
     * @returns {Array} Processed nodes
     */
    processNodes(galleryNodes) {
        return galleryNodes.map(node => ({
            id: node.local_id,
            local_id: node.local_id,
            title: node.title || '',
            description: node.description || '',
            prerequisite: node.prerequisite || null,
            source_items: node.source_items || [],
            domain_id: node.domain_id,
            position: {
                x: node.x || 0,
                y: node.y || 0
            },
            saved_x: node.x || 0,
            saved_y: node.y || 0,
            // Gallery-specific properties
            isSelectable: true,
            isEditable: false // Read-only in gallery
        }));
    }

    /**
     * Process edges from node prerequisites
     * @param {Array} galleryNodes - Gallery nodes
     * @returns {Array} Processed edges
     */
    processEdges(galleryNodes) {
        const edges = [];
        
        galleryNodes.forEach(node => {
            if (node.prerequisite) {
                try {
                    const prerequisites = this.parsePrerequisiteExpression(node.prerequisite);
                    
                    prerequisites.forEach(prereqId => {
                        edges.push({
                            from: prereqId,
                            to: node.local_id,
                            arrows: 'to'
                        });
                    });
                } catch (error) {
                    console.warn(`Failed to parse prerequisite for node ${node.local_id}:`, error);
                }
            }
        });

        return edges;
    }

    /**
     * Parse prerequisite expression (simple version for gallery)
     * @param {string|Object} prerequisite - Prerequisite expression
     * @returns {Array} Array of prerequisite node IDs
     */
    parsePrerequisiteExpression(prerequisite) {
        if (typeof prerequisite === 'string') {
            // Simple comma-separated list
            return prerequisite.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (typeof prerequisite === 'object' && prerequisite !== null) {
            // Handle JSON expression (simplified)
            if (prerequisite.type === 'AND' && Array.isArray(prerequisite.children)) {
                return prerequisite.children
                    .map(child => this.parsePrerequisiteExpression(child))
                    .flat();
            } else if (prerequisite.type === 'OR' && Array.isArray(prerequisite.children)) {
                // For OR, just take the first option for visualization
                return this.parsePrerequisiteExpression(prerequisite.children[0]);
            } else if (prerequisite.type === 'LEAF') {
                return [parseInt(prerequisite.value)];
            }
        }
        
        return [];
    }

    /**
     * Process gallery domains for GraphVisualizer
     * @param {Array} galleryDomains - Gallery domains
     * @returns {Array} Processed domains
     */
    processDomains(galleryDomains) {
        return galleryDomains.map(domain => ({
            id: domain.local_id,
            local_id: domain.local_id,
            title: domain.title || '',
            description: domain.description || '',
            parent_id: domain.parent_id,
            collapsed: domain.collapsed || false
        }));
    }

    /**
     * Create default positions map
     * @param {Array} galleryNodes - Gallery nodes
     * @returns {Map} Default positions map
     */
    createDefaultPositions(galleryNodes) {
        const positions = new Map();
        
        galleryNodes.forEach(node => {
            if (node.x !== undefined && node.y !== undefined) {
                positions.set(node.local_id, { x: node.x, y: node.y });
            } else {
                // Generate default position if not provided
                const angle = (node.local_id * 137.5) * Math.PI / 180; // Golden angle
                const radius = 100 + (node.local_id * 10);
                positions.set(node.local_id, {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius
                });
            }
        });

        return positions;
    }

    /**
     * Handle domain toggle (expand/collapse)
     */
    handleDomainToggle(domainId) {
        this.stateManager.toggleDomainCollapse(domainId);
        
        // Update the button text in details panel
        const updatedDomain = this.stateManager.getState().graphState.domains.find(
            d => String(d.local_id) === String(domainId)
        );
        
        if (updatedDomain) {
            // Trigger a re-render of the details panel
            this.stateManager.showDomainDetails(updatedDomain);
        }
        
        // Use stored visualizer to update only the domain hulls, not re-render entire graph
        if (this.visualizer && this.visualizer.network) {
            // Force a redraw of domain hulls by triggering a redraw
            this.visualizer.network.redraw();
        }
    }

    /**
     * Handle refresh button click
     */
    async handleRefresh() {
        await this.loadPublicSnapshots();
    }

    /**
     * Handle close details panel
     */
    handleCloseDetails() {
        this.stateManager.closeDetails();
    }

    /**
     * Handle sidebar toggle
     */
    handleSidebarToggle() {
        this.stateManager.toggleSidebar();
    }

    /**
     * Handle node interaction (show details)
     */
    handleNodeInteraction(nodeId) {
        const state = this.stateManager.getState();
        const node = state.graphState.nodes.find(n => n.local_id === nodeId);
        
        if (node) {
            const nodeDetails = this.transformer.transformNodeForDetails(node);
            this.stateManager.showNodeDetails(nodeDetails);
        }
    }

    /**
     * Handle domain interaction (show details)
     */
    handleDomainInteraction(domainId) {
        const state = this.stateManager.getState();
        const domain = state.graphState.domains.find(d => String(d.local_id) === String(domainId));
        
        if (domain) {
            const domainDetails = this.transformer.transformDomainForDetails(domain);
            this.stateManager.showDomainDetails(domainDetails);
        }
    }

    /**
     * Initialize the operations controller
     */
    initialize() {
        this.initializeGallery();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GalleryOpsController };
} else {
    window.GalleryOpsController = GalleryOpsController;
}
