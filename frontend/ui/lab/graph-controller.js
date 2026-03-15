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
            pathways: [],
            defaultPositions: new Map(),
            currentPositionOverrides: new Map(),
            cycles: [],
            lastUpdated: null
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
        console.log('GraphController: handleStateChange called, activeTab:', state.activeTab);
        
        // Only update if we're on the graph tab
        if (state.activeTab === 'graph') {
            console.log('GraphController: Graph tab activated, updating graph data first');
            
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
        console.log('GraphController: updateGraphData called');
        
        // Get graph data from state manager - state manager handles all data building
        const graphData = this.stateManager.buildGraphData();
        console.log('GraphController: Got graph data from state manager:', graphData);
        
        // Update graph state with data from state manager
        this.graphState.nodes = graphData.nodes;
        this.graphState.edges = graphData.edges;
        this.graphState.pathways = graphData.pathways;
        this.graphState.defaultPositions = graphData.defaultPositions;
        this.graphState.cycles = graphData.cycles;
        this.graphState.domains = graphData.domains || []; // Add domains for hull rendering
        this.graphState.lastUpdated = new Date();
        
        // Store in state manager for persistence
        this.stateManager.state.graphState = { ...this.graphState };
        
        console.log('GraphController: Graph data updated, nodes:', this.graphState.nodes.length, 'edges:', this.graphState.edges.length);
    }

    
    /**
     * Initialize graph visualizer
     */
    initializeVisualizer() {
        console.log('GraphController: initializeVisualizer called');
        console.log('GraphController: container exists:', !!this.elements.graphContainer);
        console.log('GraphController: visualizer exists:', !!this.visualizer);
        
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
        console.log('GraphController: updateVisualization called');
        console.log('GraphController: visualizer exists:', !!this.visualizer);
        console.log('GraphController: graphState:', this.graphState);
        console.log('GraphController: nodes:', this.graphState.nodes.length, 'edges:', this.graphState.edges.length);
        
        if (this.visualizer) {
            console.log('GraphController: Calling visualizer.updateVisualization');
            this.visualizer.updateVisualization(this.graphState);
        } else {
            console.log('GraphController: No visualizer to update');
        }
    }

    /**
     * Handle node position change
     * @param {number} nodeId - Node ID
     * @param {Object} position - New position {x, y}
     */
    handleNodePositionChange(nodeId, position) {
        // Store position override
        this.graphState.currentPositionOverrides.set(nodeId, position);
        
        // Update state manager
        this.stateManager.state.graphState.currentPositionOverrides = 
            new Map(this.graphState.currentPositionOverrides);
        
    }

    
    /**
     * Reset layout to default positions
     */
    resetLayout() {
        if (this.visualizer) {
            // Clear position overrides
            this.graphState.currentPositionOverrides.clear();
            this.stateManager.state.graphState.currentPositionOverrides = new Map();
            this.graph
            
            // Reset visualizer to default positions
            this.visualizer.applyPositions(this.graphState.defaultPositions);
            
            this.showMessage('Layout reset to default positions', 'info');
        }
    }

    /**
     * Randomize node positions
     */
    randomizePositions() {
        if (this.visualizer) {
            // Generate random positions
            const randomPositions = new Map();
            const containerRect = this.elements.graphContainer.getBoundingClientRect();
            
            this.graphState.nodes.forEach(node => {
                randomPositions.set(node.id, {
                    x: Math.random() * (containerRect.width - 100) + 50,
                    y: Math.random() * (containerRect.height - 100) + 50
                });
            });

            this.graphState.currentPositionOverrides = randomPositions;
            
            // Apply random positions
            this.visualizer.applyPositions(randomPositions);
            
            this.showMessage('Positions randomized', 'info');
        }
    }

    /**
     * Toggle fixed positions
     */
    fixPositions() {
        // Turn all temporary graphnode positions into permanent node positions
        this.graphState.defaultPositions = this.graphState.currentPositionOverrides;

        this.stateManager.freezePositions();
    }

    /**
     * Refresh graph visualization
     */
    refreshGraph() {
        this.updateGraphData();
        this.updateVisualization();
        
        this.showMessage('Graph refreshed', 'success');
    }

    /**
     * Get graph statistics
     * @returns {Object} Graph statistics
     */
    getGraphStatistics() {
        return {
            nodeCount: this.graphState.nodes.length,
            edgeCount: this.graphState.edges.length,
            pathwayCount: this.graphState.pathways.length,
            cycleCount: this.graphState.cycles.length,
            assessableNodeCount: this.graphState.nodes.filter(n => n.assessable).length,
            lastUpdated: this.graphState.lastUpdated
        };
    }

    /**
     * Show message to user
     * @param {string} message - Message to show
     * @param {string} type - Message type
     */
    showMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}]: ${message}`);
        // Could integrate with UI controller for toast notifications
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
