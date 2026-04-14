/**
 * Graph Controller - Manages graph tab functionality
 * Handles data management, DNF transformation, and graph operations
 */
class GraphController {
    constructor(stateManager) {
        this.stateManager = stateManager;
        
        // Graph elements
        this.elements = {
            graphContainer: document.getElementById('graph-container'),
            resetLayoutBtn: document.getElementById('btn-reset-layout'),
            randomizeBtn: document.getElementById('btn-randomize'),
            fixBtn: document.getElementById('btn-fix-positions'),
            refreshBtn: document.getElementById('btn-refresh-graph'),
            // Status elements
            graphStatus: document.getElementById('graph-status'),
            cycleWarning: document.getElementById('cycle-warning')
        };
        
        // Graph state
        this.graphState = {
            nodes: [],
            edges: [],
            cycles: [],
            domains: []
        };
        
        this.initializeElements();
        this.bindEventListeners();
        this.subscribeToStateChanges();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            // Graph container
            graphContainer: document.getElementById('graph-container'),
            
            // Control buttons
            resetLayoutBtn: document.querySelector('button[onclick*="restoreSavedPositions"]'),
            randomizeBtn: document.querySelector('button[onclick*="randomisePositions"]'),
            fixBtn: document.querySelector('button[onclick*="fixPositions"]'),
            refreshBtn: document.querySelector('button[onclick*="refreshGraph"]'),
            
            // Status elements
            graphStatus: document.getElementById('graph-status'),
            cycleWarning: document.getElementById('cycle-warning')
        };
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.visualizer) {
                this.visualizer.handleResize();
            }
        });
    }

    /**
     * Subscribe to state changes
     */
    subscribeToStateChanges() {
        console.log('GraphController: Subscribing to state changes');
        this.stateManager.subscribe((state) => {
            console.log('GraphController: State change received:', state.activeTab);
            this.handleStateChange(state);
        });
        console.log('GraphController: Subscription complete');
    }

    /**
     * Handle state changes from state manager
     * @param {Object} state - Current state
     */
    handleStateChange(state) {
        // Only update if we're on the graph tab
        if (state.activeTab === 'graph') {
            // Always update graph data first
            this.updateGraphData();
            
            // Initialize visualizer if not already done
            if (!this.visualizer) {
                this.initializeVisualizer();
            } else {
                this.updateVisualization();
            }
        }
    }

    /**
     * Handle node click
     * @param {number} nodeId - Node ID
     */
    handleNodeClick(nodeId) {
        // For now, do nothing - keep it simple as requested
        console.log('Node clicked:', nodeId);
    }

    /**
     * Handle edge click
     * @param {number} edgeId - Edge ID
     */
    handleEdgeClick(edgeId) {
        // For now, do nothing - keep it simple as requested
        console.log('Edge clicked:', edgeId);
    }

    /**
     * Handle domain hull click
     * @param {number} domainId - Domain ID
     */
    handleDomainClick(domainId) {
        // For now, do nothing - keep it simple as requested
        console.log('Domain hull clicked:', domainId);
    }

    
    /**
     * Update graph data from state manager
     */
    updateGraphData() {
        // Get graph data from state manager (already built by transformer)
        const graphState = this.stateManager.state.graphState;
        
        // Update local graph state
        this.graphState.nodes = graphState.nodes || [];
        this.graphState.edges = graphState.edges || [];
        this.graphState.cycles = graphState.cycles || [];
        this.graphState.domains = graphState.domains || [];
    }

    
    /**
     * Initialize graph visualizer
     */
    initializeVisualizer() {
        if (this.elements.graphContainer && !this.visualizer) {
            console.log('GraphController: Creating new GraphVisualizer');
            // Import and create visualizer (will be created separately)
            this.visualizer = new GraphVisualizer(this.elements.graphContainer, {
                onNodeClick: (nodeId) => this.handleNodeClick(nodeId),
                onEdgeClick: (edgeId) => this.handleEdgeClick(edgeId),
                onPositionChange: (nodeId, position) => this.handleNodePositionChange(nodeId, position),
                onDomainClick: (domainId) => this.handleDomainClick(domainId)
            });
            
            console.log('GraphController: GraphVisualizer created');
            
            // Initial visualization
            this.updateVisualization();
        } else {
            console.log('GraphController: Cannot create visualizer - container:', !!this.elements.graphContainer, 'visualizer:', !!this.visualizer);
        }
    }

    /**
     * Update visualization with current graph data
     */
    updateVisualization() {
        if (this.visualizer) {
            this.visualizer.updateVisualization(this.graphState);
        } else {
        }
    }

    /**
     * Handle node position change
     * @param {number} nodeId - Node ID
     * @param {Object} position - New position {x, y}
     */
    handleNodePositionChange(nodeId, position) {
        // Update position in graphState.nodes (real-time update)
        const node = this.graphState.nodes.find(n => n.id === nodeId);
        if (node) {
            node.position = { x: position.x, y: position.y };
        }

        // Also update in state manager's graphState
        const stateNode = this.stateManager.state.graphState.nodes.find(n => n.id === nodeId);
        if (stateNode) {
            stateNode.position = { x: position.x, y: position.y };
        }
    }

    
    /**
     * Reset layout to default positions
     */
    resetLayout() {
        if (this.visualizer) {
            // Clear position overrides by resetting all node positions to default
            const positions = new Map();
            this.graphState.nodes.forEach(node => {
                node.position = { ...node.defaultPosition };
                positions.set(node.id, node.position);
            });

            // Sync to state manager
            this.stateManager.state.graphState.nodes.forEach(node => {
                const localNode = this.graphState.nodes.find(n => n.id === node.id);
                if (localNode) {
                    node.position = { ...localNode.position };
                }
            });

            // Apply positions to visualizer
            this.visualizer.applyPositions(positions);

            this.stateManager.showMessage('Layout reset to default positions', 'info');
        }
    }

    /**
     * Randomize node positions using algorithmic layout (ignores stored positions)
     */
    randomizePositions() {
        if (this.visualizer) {
            // Use the same algorithmic generation as default positions
            const fullNodes = this.stateManager.state.nodes.map(node => ({
                id: node.id,
                title: node.title,
                domainId: node.domainId,
                prerequisites: node.prerequisites
            }));

            const newPositions = ExpressionUtils.generateDefaultPositions(fullNodes, {
                width: 800,
                height: 600,
                layout: 'hierarchical'
            });

            // Update positions in graphState.nodes
            const positions = new Map();
            this.graphState.nodes.forEach(node => {
                const newPos = newPositions.get(node.id);
                if (newPos) {
                    node.position = { x: newPos.x, y: newPos.y };
                    positions.set(node.id, node.position);
                }
            });

            // Sync to state manager
            this.stateManager.state.graphState.nodes.forEach(node => {
                const localNode = this.graphState.nodes.find(n => n.id === node.id);
                if (localNode) {
                    node.position = { ...localNode.position };
                }
            });

            this.visualizer.applyPositions(positions);
            this.stateManager.showMessage('Positions randomized with algorithmic layout', 'info');
        }
    }

    /**
     * Toggle fixed positions - save current positions as default
     */
    fixPositions() {
        // Copy current position to defaultPosition for all nodes
        this.graphState.nodes.forEach(node => {
            if (node.position && (node.position.x !== null || node.position.y !== null)) {
                node.defaultPosition = { ...node.position };
            }
        });

        // Sync to workspace nodes for persistence
        this.stateManager.state.nodes.forEach(node => {
            const graphNode = this.graphState.nodes.find(n => n.id === node.id);
            if (graphNode && graphNode.position) {
                node.position = { ...graphNode.position };
            }
        });

        // Sync to state manager's graphState
        this.stateManager.state.graphState.nodes.forEach(node => {
            const localNode = this.graphState.nodes.find(n => n.id === node.id);
            if (localNode) {
                node.defaultPosition = { ...localNode.defaultPosition };
            }
        });

        this.stateManager.showMessage('Positions fixed', 'success');
    }

    /**
     * Refresh graph visualization without changing positions
     */
    refreshGraph() {
        // Apply current positions from graphState.nodes
        const positions = new Map();
        this.graphState.nodes.forEach(node => {
            const pos = node.position || node.defaultPosition;
            if (pos && pos.x !== null && pos.y !== null) {
                positions.set(node.id, pos);
            }
        });

        if (this.visualizer && positions.size > 0) {
            this.visualizer.applyPositions(positions);
        }

        this.stateManager.showMessage('Graph refreshed', 'success');
    }

    /**
     * Get graph statistics
     * @returns {Object} Graph statistics
     */
    getGraphStatistics() {
        return {
            nodeCount: this.graphState.nodes.length,
            edgeCount: this.graphState.edges.length,
            cycleCount: this.graphState.cycles.length,
            domainCount: this.graphState.domains.length,
            assessableNodeCount: this.stateManager.state.nodes.filter(n => n.assessable).length
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.visualizer) {
            this.visualizer.destroy();
            this.visualizer = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphController;
} else {
    window.GraphController = GraphController;
}
