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
 * Academia Graph Controller - Reusable graph visualization component for the academia
 * ONLY manipulates graph visualization. NEVER mutates state directly.
 * Passes events back to calling controller via callbacks.
 */
class AcademiaGraphController {
    /**
     * @param {HTMLElement|string} container - Container element or ID
     * @param {Object} callbacks - { onNodeClick, onPathwayClick, onEdgeClick (legacy), onDomainClick, onUnfocus, onPositionChange }
     */
    constructor(container, callbacks = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.callbacks = {
            onNodeClick: callbacks.onNodeClick || (() => {}),
            // `onPathwayClick(nodeId, pathwayIndex)` is the new pathway-aware callback
            onPathwayClick: callbacks.onPathwayClick || (() => {}),
            // Legacy edge-click hook kept for back-compat.
            onEdgeClick: callbacks.onEdgeClick || (() => {}),
            onDomainClick: callbacks.onDomainClick || (() => {}),
            onUnfocus: callbacks.onUnfocus || (() => {}),
            onPositionChange: callbacks.onPositionChange || (() => {}),
            ...callbacks
        };

        this.visualizer = null;
        this.graphData = null;
        this.nodePathwayIndex = new Map();

        this.initializeVisualizer();
    }

    /**
     * Initialize the GraphVisualizer component
     */
    initializeVisualizer() {
        if (!this.container) {
            console.error('AcademiaGraphController: Container not found');
            return;
        }

        this.visualizer = new GraphVisualizer(this.container, {
            onNodeClick: (nodeId) => this.handleNodeClick(nodeId),
            onPathwayClick: (nodeId, pathwayIndex) =>
                this.handlePathwayClick(nodeId, pathwayIndex),
            onEdgeClick: () => {},   // legacy stub
            onDomainClick: (domainId) => this.handleDomainClick(domainId),
            onUnfocus: () => this.handleUnfocus(),
            onPositionChange: (nodeId, pos) => this.handlePositionChange(nodeId, pos)
        });
    }

    /**
     * Update the graph visualization with new data
     * @param {Object} graphData - The graph state (nodes, edges, cycles, domains)
     */
    update(graphData) {
        if (!graphData) {
            console.log('No graph data provided, returning');
            return;
        }
        this.graphData = graphData;

        // Initialize pathway indices for new nodes
        if (graphData.nodes) {
            graphData.nodes.forEach(node => {
                if (node.pathways && node.pathways.length > 0 && !this.nodePathwayIndex.has(node.id)) {
                    this.nodePathwayIndex.set(node.id, 0);
                }
            });
        }

        // Apply pathway highlights (visualizer renders)
        this.applyPathwayHighlights();

        // Pass to visualizer
        this.visualizer.updateVisualization(graphData);
    }

    /**
     * Handle node click from visualizer
     */
    handleNodeClick(nodeId) {
        // Apply visual highlight immediately in visualizer (ephemeral UI state)
        // Only clear group 0 highlights (click highlights), preserve status highlights (groups 1-3)
        this.clearGroup0Highlights();
        
        // Add this node with group 0 (click highlight)
        this.visualizer.assignable.highlightedNodes.add({ id: nodeId, group: 0 });
        
        // Re-render visualizer to show highlight
        this.visualizer.updateVisualization(this.graphData);

        // Notify parent controller
        this.callbacks.onNodeClick(nodeId);
    }

    /**
     * Clear only group 0 highlights (click/selection highlights)
     * Preserves status-based highlights (groups 1-3)
     */
    clearGroup0Highlights() {
        const nodes = this.visualizer.assignable.highlightedNodes;
        const domains = this.visualizer.assignable.highlightedDomains;
        
        // Remove only items with group 0 or no group (backward compat)
        for (const item of Array.from(nodes)) {
            const group = typeof item === 'object' && item !== null ? item.group : 0;
            if (group === 0 || group === undefined) {
                nodes.delete(item);
            }
        }
        
        for (const item of Array.from(domains)) {
            const group = typeof item === 'object' && item !== null ? item.group : 0;
            if (group === 0 || group === undefined) {
                domains.delete(item);
            }
        }
    }

    /**
     * Handle domain click from visualizer
     */
    handleDomainClick(domainId) {
        // Apply visual highlight immediately in visualizer
        // Only clear group 0 highlights, preserve status highlights
        this.clearGroup0Highlights();
        
        // Add this domain with group 0 (click highlight)
        this.visualizer.assignable.highlightedDomains.add({ id: domainId, group: 0 });

        // Re-render visualizer to show highlight
        this.visualizer.updateVisualization(this.graphData);

        // Notify parent controller
        this.callbacks.onDomainClick(domainId);
    }

    /**
     * Handle a pathway click, cycles through distinct available pathways starting from the reference index
     * @param {Object} edgeData - Edge data of the form {source: {id, type}, target: {id, type}}
     */
    handlePathwayClick(edgeData) {
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
     * Handle unfocus (click on empty space)
     */
    handleUnfocus() {
        this.visualizer.assignable.highlightedNodes.clear();
        this.visualizer.assignable.highlightedDomains.clear();
        this.visualizer.updateVisualization(this.graphData);
        
        this.callbacks.onUnfocus();
    }

    /**
     * Handle simple position change
     * @param {number} nodeId 
     * @param {Object} position 
     */
    handlePositionChange(nodeId, position) {
        // Update position in graphData.nodes (real-time update)
        const node = this.graphData.nodes.find(n => n.id === nodeId);
        if (node) {
            node.position = { x: position.x, y: position.y };
        }

        this.callbacks.onPositionChange(nodeId, position);
    }

    /**
     * Apply pathway highlights based on internal state. Writes
     * `(nodeId, pathwayIndex)` pairs to the visualizer's `highlightedPathways` map
     */
    applyPathwayHighlights() {
        if (!this.visualizer || !this.graphData) return;
        this.visualizer.assignable.highlightedPathways.clear();
        this.nodePathwayIndex.forEach((pathwayIndex, nodeId) => {
            const node = this.graphData.nodes.find(n => n.id === nodeId);
            if (node && node.pathways && pathwayIndex < node.pathways.length) {
                this.visualizer.assignable.highlightedPathways.set(nodeId, pathwayIndex);
            }
        });
    }

    /**
     * Handle container resize
     */
    handleResize() {
        if (this.visualizer) {
            this.visualizer.handleResize();
        }
    }

    /**
     * Destroy the visualizer
     */
    destroy() {
        if (this.visualizer) {
            this.visualizer.destroy();
            this.visualizer = null;
        }
    }

    /**
     * Set assignable highlights (nodes, edges, domains with group assignments)
     * @param {Object} assignables - { highlightedNodes: Set, highlightedEdges: Set (legacy), highlightedDomains: Set, highlightedPathways: Map (optional) }
     *   Each Set contains objects: {id, group} where group is 0-4
     */
    setAssignables(assignables) {
        if (!this.visualizer) return;
        if (!assignables) return;

        // Helper to clear only non-group-0 items
        const clearNonGroup0 = (set) => {
            for (const item of Array.from(set)) {
                const group = typeof item === 'object' && item !== null ? item.group : 0;
                if (group !== 0) {
                    set.delete(item);
                }
            }
        };

        // Apply new assignables, preserving group 0 (click) highlights
        if (assignables.hasOwnProperty('highlightedNodes')) {
            clearNonGroup0(this.visualizer.assignable.highlightedNodes);
            if (assignables.highlightedNodes) {
                assignables.highlightedNodes.forEach(item => {
                    this.visualizer.assignable.highlightedNodes.add(item);
                });
            }
        }
        if (assignables.hasOwnProperty('highlightedEdges')) {
            // `highlightedEdges` is the legacy index-based highlight set.
            // The visualizer reads its active pathway highlights from
            // `highlightedPathways`; we still let callers write
            // `highlightedEdges` for backward compat, but it is not
            // used by the new render pipeline.
            if (assignables.highlightedEdges) {
                this.visualizer.assignable.highlightedEdges.clear();
                assignables.highlightedEdges.forEach(item => {
                    this.visualizer.assignable.highlightedEdges.add(item);
                });
            }
        }
        if (assignables.hasOwnProperty('highlightedPathways')) {
            // NEW: replace the (nodeId, pathwayIndex) map wholesale.
            this.visualizer.assignable.highlightedPathways.clear();
            if (assignables.highlightedPathways) {
                assignables.highlightedPathways.forEach((pathwayIndex, nodeId) => {
                    this.visualizer.assignable.highlightedPathways.set(nodeId, pathwayIndex);
                });
            }
        }
        if (assignables.hasOwnProperty('highlightedDomains')) {
            clearNonGroup0(this.visualizer.assignable.highlightedDomains);
            if (assignables.highlightedDomains) {
                assignables.highlightedDomains.forEach(item => {
                    this.visualizer.assignable.highlightedDomains.add(item);
                });
            }
        }

        // Re-render
        if (this.graphData) {
            this.visualizer.updateVisualization(this.graphData);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AcademiaGraphController };
} else {
    window.AcademiaGraphController = AcademiaGraphController;
}
