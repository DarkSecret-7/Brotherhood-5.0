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
 * Graph Controller - Manages graph tab functionality
 * Handles data management, DNF transformation, and graph operations
 */
class GraphController {
    constructor(stateManager, opsController = null) {
        this.stateManager = stateManager;
        this.opsController = opsController;

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
        // TODO: Replace with authorative state from stateManager
        this.graphState = {
            nodes: [],
            cycles: [],
            domains: []
        };

        // Track active pathway index for each node (local to graph controller)
        this.nodePathwayIndex = new Map();

        // Prerequisite adding states
        this.addingPrerequisiteId = null;
        this.removingPrerequisiteId = null;
        this.addAlpha = false;
        this.removeAlpha = false;
        
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

    beginAddPrerequisite(nodeId, alpha = false) {
        // Reset existing operations
        this.removingPrerequisiteId = null;
        this.removeAlpha = false;
        document.getElementById('prerequisite-removing-helper-text').style.display = 'none';

        this.addingPrerequisiteId = nodeId;
        this.addAlpha = alpha;
        document.getElementById('prerequisite-adding-helper-text').style.display = 'block';
    }

    finishAddPrerequisite(nodeId, alpha = false) {
        // If not adding a prerequisite, return
        if (!this.addingPrerequisiteId) throw new Error('Not adding a prerequisite');
        if (nodeId === this.addingPrerequisiteId) throw new Error('Cannot add a node as a prerequisite to itself');

        // Get node (shared by both branches)
        const node = this.graphState.nodes.find(node => node.id === this.addingPrerequisiteId);
        if (!node) throw new Error('Node not found');
        if (alpha) {
            // If alpha, add to all pathways
            node.pathways.forEach(pathway => {
                if (!pathway.includes(nodeId)) pathway.push(nodeId);
            });
        } else {
            // Get current pathway
            const pathwayIndex = this.nodePathwayIndex.get(this.addingPrerequisiteId) || 0;
            if (pathwayIndex >= node.pathways?.length && node.pathways?.length > 0) throw new Error('Pathway index out of range');
            // Could have no pathways yet
            const pathway = node.pathways?.[pathwayIndex] || [];

            // Add selected node
            if (pathway.includes(nodeId)) throw new Error('Node already in pathway');
            
            pathway.push(nodeId);
            node.pathways[pathwayIndex] = pathway;
        }
        console.log(node.pathways);

        // Simply pass this to the state manager, it will validate and simplify it
        const filteredPathways = (node.pathways || []).filter(p => Array.isArray(p) && p.length > 0);
        const prerequisites = window.ExpressionUtils.dnfToExpr(filteredPathways);

        // Update node
        this.stateManager.updateNode(this.addingPrerequisiteId, { prerequisites });
    }

    beginRemovePrerequisite(nodeId, alpha = false) {
        // Reset existing operations
        this.addingPrerequisiteId = null;
        this.addAlpha = false;
        document.getElementById('prerequisite-adding-helper-text').style.display = 'none';

        this.removingPrerequisiteId = nodeId;
        this.removeAlpha = alpha;
        document.getElementById('prerequisite-removing-helper-text').style.display = 'block';
    }

    finishRemovePrerequisite(nodeId, alpha = false) {
        // If not removing a prerequisite, return
        if (!this.removingPrerequisiteId) throw new Error('Not removing a prerequisite');
        if (nodeId === this.removingPrerequisiteId) throw new Error('Cannot remove a node as a prerequisite to itself');

        // Get node
        const node = this.graphState.nodes.find(node => node.id === this.removingPrerequisiteId);
        if (!node) throw new Error('Node not found');
        if (alpha) {
            // If alpha, remove selected node from ALL pathways
            node.pathways.forEach(pathway => {
                if (pathway.includes(nodeId)) {
                    const index = pathway.indexOf(nodeId);
                    pathway.splice(index, 1);
                }
            });
        } else {
            // Get current pathway
            const pathwayIndex = this.nodePathwayIndex.get(this.removingPrerequisiteId) || 0;
            if (pathwayIndex >= node.pathways?.length || node.pathways?.length <= 0) throw new Error('Pathway index out of range');
            const pathway = node.pathways?.[pathwayIndex];
            if (!pathway) throw new Error('Pathway not found');
            if (!pathway.includes(nodeId)) throw new Error('Node not in pathway');
            
            // Remove selected node
            const index = pathway.indexOf(nodeId);
            if (index !== -1) {
                pathway.splice(index, 1);
            }

            node.pathways[pathwayIndex] = pathway;
        }
        console.log(node.pathways);
        

        // Filter empty clauses so removing the final item from a pathway
        // cannot trigger AST validation errors downstream.
        const filteredPathways = (node.pathways || []).filter(p => Array.isArray(p) && p.length > 0);

        // Simply pass this to the state manager, it will validate and simplify it
        const prerequisites = filteredPathways.length
            ? window.ExpressionUtils.dnfToExpr(filteredPathways)
            : '';

        // Update node
        this.stateManager.updateNode(this.removingPrerequisiteId, { prerequisites });
    }

    /**
     * Handle node click
     * @param {MouseEvent} event - Click event
     * @param {number} nodeId - Node ID
     */
    async handleNodeClick(event, nodeId) {
        // Check if adding prerequisite     
        if (this.addingPrerequisiteId != null) {
            try {
                this.finishAddPrerequisite(nodeId, this.addAlpha);
            } catch (error) {
                console.error('Error adding prerequisite:', error);
            } finally {
                console.log('Node ', nodeId, ' added as prerequisite to node ', this.addingPrerequisiteId);
            }
            
            // Reset
            this.addingPrerequisiteId = null;
            document.getElementById('prerequisite-adding-helper-text').style.display = 'none';

            // Unfocus and skip rest of the normal click handling
            this.handleUnfocus();
            return;
        }
        
        // Check if removing prerequisite     
        if (this.removingPrerequisiteId != null) {
            try {
                this.finishRemovePrerequisite(nodeId, this.removeAlpha);
            } catch (error) {
                console.error('Error removing prerequisite:', error);
            } finally {
                console.log('Node ', nodeId, ' removed as a prerequisite to node ', this.removingPrerequisiteId);
            }
            
            // Reset
            this.removingPrerequisiteId = null;
            document.getElementById('prerequisite-removing-helper-text').style.display = 'none';

            // Unfocus and skip rest of the normal click handling
            this.handleUnfocus();
            return;
        }
        
        // Unfocus first
        this.handleUnfocus();
        
        // Highlight clicked node
        this.visualizer.assignable.highlightedNodes.add(nodeId);

        // Open context menu
        this.openNodeContextMenu(event, nodeId);
        
        // Re-render to apply highlight
        this.updateVisualization();
        
        console.log('Node clicked and highlighted:', nodeId);
    }

    /**
     * Handle a pathway click, cycles through distinct available pathways starting from the reference index
     * @param {Object} edgeData - Edge data of the form {source: {id, type}, target: {id, type}}
     */
    handlePathwayClick(edgeData) {
        // Unfocus first
        this.handleUnfocus();

        const { pathways, referenceIndex } = this.visualizer.getUniqueEdgeContribution(edgeData, true);

        // If no available pathways, return
        if (pathways == null || pathways.length === 0) return;

        let nextIndex = null;
        // If reference index is null, unhighlighted edge clicked, choose the first pathway
        if (referenceIndex == null) nextIndex = 0;
        // Else, cycle to the next pathway
        else nextIndex = (referenceIndex + 1) % pathways.length;

        this.nodePathwayIndex.set(pathways[nextIndex].nodeId, pathways[nextIndex].pathwayIndex);
        this.updateVisualization();

        console.log('Pathway clicked. Cycling and highlighting:',
            this.graphState.nodes.find(n => n.id === pathways[nextIndex].nodeId)?.pathways[pathways[nextIndex].pathwayIndex] || 'undefined',
            ', at index:', pathways[nextIndex].pathwayIndex, ', for target:', pathways[nextIndex].nodeId);
    }

    /**
     * Handle domain hull click
     * @param {MouseEvent} event - Click event
     * @param {number} domainId - Domain ID
     */
    handleDomainClick(event, domainId) {
        // Unfocus first
        this.handleUnfocus();

        // Highlight clicked domain
        this.visualizer.assignable.highlightedDomains.add(domainId);
        
        // Open context menu
        this.openDomainContextMenu(event, domainId);

        // Re-render to apply highlight
        this.updateVisualization();

        console.log('Domain clicked and highlighted:', domainId);
    }

    /**
     * Open node context menu
     * @param {MouseEvent} event - Click event
     * @param {number} nodeId - Node ID
     */
    openNodeContextMenu(event, nodeId) {
        // A dictionary of title and function pairs
        const contextMenuItems = {
            'Edit Node': () => { this.opsController.editNode(nodeId); this.handleUnfocus(); },
            'Delete Node': () => { this.opsController.deleteNode(nodeId); this.handleUnfocus(); },
            'Add Prerequisite': () => this.beginAddPrerequisite(nodeId, false),
            'Remove Prerequisite': () => this.beginRemovePrerequisite(nodeId, false)
            // Alpha moves will be added later
        };

        // Build context menu with html
        this.buildContextMenu(event.clientX, event.clientY, contextMenuItems);
    }
    
    /**
     * Open domain context menu
     * @param {MouseEvent} event - Click event
     * @param {number} domainId - Domain ID
     */
    openDomainContextMenu(event, domainId) {
        // A dictionary of title and function pairs
        const contextMenuItems = {
            'Edit Domain': () => { this.opsController.editDomain(domainId); this.handleUnfocus(); },
            'Delete Domain': () => { this.opsController.deleteDomain(domainId); this.handleUnfocus(); }
        };

        // Collapse/Expand domain
        const domain = this.graphState.domains.find(d => d.id === domainId);
        if (domain) {
            const collapseTitle = domain.isCollapsed ? 'Expand Domain' : 'Collapse Domain';
            contextMenuItems[collapseTitle] = () => { this.stateManager.toggleDomainCollapse(domainId); this.handleUnfocus(); };
        }

        // Build context menu with html
        this.buildContextMenu(event.clientX, event.clientY, contextMenuItems);
    }

    /**
     * Build context menu with html
     * @param {number} x - X position of the context menu
     * @param {number} y - Y position of the context menu
     * @param {Dictionary} contextMenuItems - Dictionary of title and function pairs
     */
    buildContextMenu(x, y, contextMenuItems) {
        // Destroy any existing context menu, only one at a time is allowed
        this.destroyContextMenu();

        const contextMenu = document.createElement('div');
        contextMenu.classList.add('graph-context-menu');
        Object.keys(contextMenuItems).forEach(title => {
            const menuItem = document.createElement('div');
            menuItem.classList.add('context-menu-item');
            menuItem.textContent = title;

            // Add click event listener with automatic unfocusing
            menuItem.addEventListener('click', () => contextMenuItems[title]());
            contextMenu.appendChild(menuItem);
        });

        // Set position
        const parentPosition = this.elements.graphContainer.getBoundingClientRect();
        contextMenu.style.left = `${x - parentPosition.left}px`;
        contextMenu.style.top = `${y - parentPosition.top}px`;

        // Show context menu
        contextMenu.style.display = 'flex';

        // Append to graph container
        this.elements.graphContainer.appendChild(contextMenu);
    }

    /**
     * Destroy any existing context menu
     */
    destroyContextMenu() {
        const contextMenuMenus = document.querySelectorAll('.graph-context-menu');
        contextMenuMenus.forEach(menu => menu.remove());
    }
    
    /**
     * Update graph data from state manager
     */
    updateGraphData() {
        // Get graph data from state manager (already built by transformer)
        console.log(this.stateManager.state.graphState, this.graphState);
        console.log(this.nodePathwayIndex);
        
        const graphState = this.stateManager.state.graphState;

        // Update local graph state
        this.graphState.nodes = graphState.nodes || [];
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
                onNodeClick: (event, nodeId) => this.handleNodeClick(event, nodeId),
                onPathwayClick: (edgeData) =>
                    this.handlePathwayClick(edgeData),
                // Legacy edge-click hook
                onEdgeClick: () => {},
                onPositionChange: (nodeId, position) => this.handleNodePositionChange(nodeId, position),
                onDomainClick: (event, domainId) => this.handleDomainClick(event, domainId),
                onUnfocus: () => this.handleUnfocus(),
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
            this.applyPathwayHighlights();        
            this.visualizer.updateVisualization(this.graphState);
        }
    }

    /**
     * Apply pathway highlights by writing `(nodeId, pathwayIndex)`
     * pairs to the visualizer's `highlightedPathways` map. The
     * visualizer owns the edge reconstruction and applies the visual
     * highlight itself during the render.
     */
    applyPathwayHighlights() {
        this.visualizer.assignable.highlightedPathways.clear();
        this.nodePathwayIndex.forEach((pathwayIndex, nodeId) =>
            this.visualizer.assignable.highlightedPathways.set(nodeId, pathwayIndex)
        );
    }

    /**
     * Handle unfocus, clears all highlights
     */
    handleUnfocus() {
        // Clear all highlights
        this.visualizer.assignable.highlightedPathways.clear();
        this.visualizer.assignable.highlightedNodes.clear();
        this.visualizer.assignable.highlightedDomains.clear();
        
        // Context menu
        this.destroyContextMenu();
        
        // Operations
        this.addingPrerequisiteId = null;
        document.getElementById('prerequisite-adding-helper-text').style.display = 'none';
        this.removingPrerequisiteId = null;
        document.getElementById('prerequisite-removing-helper-text').style.display = 'none';

        this.updateVisualization();
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

            const newPositions = window.GraphUtils.generateDefaultPositions(fullNodes, {
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
        // Handle collapsed domains: every descendant of a collapsed domain
        // gets an actual, non-null position centered around the domain's
        // current position in the network.
        const allDomains = this.stateManager.state.domains || [];
        const allNodes = this.stateManager.state.nodes || [];
        const collapsedIds = new Set(
            (allDomains || [])
                .filter(d => d && d.isCollapsed)
                .map(d => d.id)
        );

        collapsedIds.forEach(domainId => {
            const domain = allDomains.find(d => d.id === domainId);
            if (!domain) return;
            const domainPos = this.visualizer
                ? this.visualizer.getCollapsedDomainPosition(domainId)
                : null;
            const contained = GraphUtils.getContainedNodes(domain, allDomains, allNodes);
            GraphUtils.positionContainedNodes(contained, domainPos);
        });

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
        // The visualizer is the only place that counts visible edges
        // (it remaps by collapsed domain, merges duplicates, and may
        // transitively reduce). We surface its count.
        const edgeCount = this.visualizer
            ? (this.visualizer.lastVisEdges || []).length
            : 0;
        return {
            nodeCount: this.graphState.nodes.length,
            edgeCount: edgeCount,
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
