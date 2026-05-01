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

        // Track active pathway index for each node (local to graph controller)
        this.nodePathwayIndex = new Map();
        
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
        // Clear only node highlights (edge highlights are independent)
        this.visualizer.assignable.highlightedNodes.clear();
        
        // Highlight clicked node
        this.visualizer.assignable.highlightedNodes.add(nodeId);
        
        // Re-render to apply highlight
        this.updateVisualization();
        
        console.log('Node clicked and highlighted:', nodeId);
    }

    /**
     * Get the edge index from an edge ID
     * @param {string} edgeId - Edge ID (e.g., "1-5")
     * @returns {number} Edge index or -1 if not found
     */
    getEdgeIndex(edgeId) {
        return this.graphState.edges.findIndex(e => e.id === edgeId);
    }

    /**
     * Handle edge click
     * @param {number} edgeIndex - Edge index (from vis.js)
     */
    handleEdgeClick(edgeIndex) {
        console.log('Edge clicked:', edgeIndex);
        
        // Get the edge from the graph state
        const edge = this.graphState.edges[edgeIndex];
        if (!edge) return;
        
        // Find the target node of this edge
        const targetNodeId = edge.to;
        const targetNode = this.graphState.nodes.find(n => n.id === targetNodeId);
        if (!targetNode || !targetNode.pathways || targetNode.pathways.length === 0) return;
        
        // Find which pathway this edge belongs to
        const edgeId = edge.id;
        let pathwayIndex = -1;
        for (let i = 0; i < targetNode.pathways.length; i++) {
            if (targetNode.pathways[i].includes(edgeId)) {
                pathwayIndex = i;
                break;
            }
        }
        if (pathwayIndex === -1) return; // Edge not in any pathway
        
        // Get current pathway index for this node (always initialized to 0)
        let currentIndex = this.nodePathwayIndex.get(targetNodeId) || 0;
        
        // If clicking a different pathway edge, switch to it; otherwise cycle
        if (currentIndex !== pathwayIndex) {
            currentIndex = pathwayIndex;
        } else {
            // Cycle to the next pathway index
            currentIndex = (currentIndex + 1) % targetNode.pathways.length;
        }
        
        this.nodePathwayIndex.set(targetNodeId, currentIndex);
        
        // Re-render to apply highlights (updateVisualization handles edge highlighting)
        this.updateVisualization();
        
        console.log(`Showing pathway ${currentIndex + 1}/${targetNode.pathways.length} for node ${targetNodeId}`);
    }

    /**
     * Handle domain hull click
     * @param {number} domainId - Domain ID
     */
    handleDomainClick(domainId) {
        // Clear any existing domain highlights
        this.visualizer.assignable.highlightedDomains.clear();

        // Highlight clicked domain
        this.visualizer.assignable.highlightedDomains.add(domainId);

        // Re-render to apply highlight
        this.updateVisualization();

        console.log('Domain clicked and highlighted:', domainId);
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

        // Initialize pathway indices for all nodes with pathways to 0
        this.graphState.nodes.forEach(node => {
            if (node.pathways && node.pathways.length > 0 && !this.nodePathwayIndex.has(node.id)) {
                this.nodePathwayIndex.set(node.id, 0);
            }
        });
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
            // GraphController assigns edge highlights (not the visualizer)
            this.applyPathwayHighlights();
            this.visualizer.updateVisualization(this.graphState);
        }
    }

    /**
     * Apply pathway edge highlights based on nodePathwayIndex
     * Called by updateVisualization to set highlighted edges
     */
    applyPathwayHighlights() {
        this.visualizer.assignable.highlightedEdges.clear();
        
        // For each node with an active pathway, highlight ALL edges in that pathway
        this.nodePathwayIndex.forEach((pathwayIndex, nodeId) => {
            const node = this.graphState.nodes.find(n => n.id === nodeId);
            if (node && node.pathways && node.pathways.length > pathwayIndex) {
                const activePathway = node.pathways[pathwayIndex]; // Array of edge IDs
                // Highlight all edges in this pathway
                activePathway.forEach(edgeId => {
                    const edgeIndex = this.getEdgeIndex(edgeId);
                    if (edgeIndex !== -1) {
                        this.visualizer.assignable.highlightedEdges.add(edgeIndex);
                    }
                });
            }
        });
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
