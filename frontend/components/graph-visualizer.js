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
 * Graph Visualizer - Simple vis.js visualization component
 * Handles basic graph rendering with minimal data
 */
class GraphVisualizer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            // Assignable event handlers
            onNodeClick: options.onNodeClick || (() => {}),
            onEdgeClick: options.onEdgeClick || (() => {}),
            onPositionChange: options.onPositionChange || (() => {}),
            onDomainClick: options.onDomainClick || (() => {}),
            onUnfocus: options.onUnfocus || (() => {}),
            ...options
        };

        // Assignable system - supports both flat IDs (backward compat) and {id, group} format
        this.assignable = {
            highlightedNodes: new Set(),        // Set of {id, group} or just IDs
            highlightedEdges: new Set(),        // Set of {id, group} or just IDs
            highlightedDomains: new Set()       // Set of {id, group} or just IDs
        };

        // 5 highlight configurations (group 0-4)
        // Group 0: Click-selected/highlighted (default for backward compat)
        // Groups 1-3: Assessment states (Unknown=0, Familiar=1, Mastered=2)
        // Group 4: Empty/default
        this.highlightConfigs = [
            {   // Group 0: Click-selected
                node: { border: '#541a96', background: '#ba92ee' },
                edge: { border: '#99e0c9', background: '#7cdabb' },
                domain: { border: '#eb7474' }
            },
            {   // Group 1: Unknown (assessment value 0)
                node: { border: '#9e9e9e', background: '#e0e0e0' },
                edge: { border: '#9e9e9e', background: '#bdbdbd' },
                domain: { border: '#9e9e9e' }
            },
            {   // Group 2: Familiar (assessment value 1)
                node: { border: '#ff9800', background: '#ffe0b2' },
                edge: { border: '#ff9800', background: '#ffcc80' },
                domain: { border: '#ff9800' }
            },
            {   // Group 3: Mastered (assessment value 2)
                node: { border: '#4caf50', background: '#c8e6c9' },
                edge: { border: '#4caf50', background: '#a5d6a7' },
                domain: { border: '#4caf50' }
            },
            {   // Group 4: Empty/default
                node: { border: '#2B7CE9', background: '#97C2FC' },
                edge: { border: '#848484', background: '#848484' },
                domain: { border: 'transparent' }
            }
        ];
        
        this.network = null;
        this.nodes = null;
        this.edges = null;
        this.currentDomainHulls = {}; // Store hulls for hit-testing
        
        this.initializeNetwork();
    }

    /**
     * Normalize assignment to {id, group} format
     * Supports backward compatibility with flat IDs
     * @param {any} item - Assignment item (id, {id, group}, {nodeId, assignedGroup}, etc.)
     * @returns {Object} - Normalized {id, group} object
     */
    normalizeAssignment(item) {
        // If primitive (string/number), default to group 0
        if (typeof item === 'string' || typeof item === 'number') {
            return { id: item, group: 0 };
        }
        
        // If object, check for various property names
        if (item && typeof item === 'object') {
            // Direct {id, group} format
            if ('id' in item && 'group' in item) {
                return { id: item.id, group: Math.max(0, Math.min(4, item.group)) };
            }
            
            // {nodeId, assignedGroup} or {edgeId, assignedGroup} or {domainId, assignedGroup}
            if ('assignedGroup' in item) {
                const id = item.nodeId ?? item.edgeId ?? item.domainId;
                if (id !== undefined) {
                    return { id: id, group: Math.max(0, Math.min(4, item.assignedGroup)) };
                }
            }
            
            // Fallback: look for id-like property
            const id = item.id ?? item.nodeId ?? item.edgeId ?? item.domainId;
            if (id !== undefined) {
                return { id: id, group: 0 };
            }
        }
        
        return null;
    }

    /**
     * Get the group for a given ID from a Set of assignments
     * @param {Set} assignmentSet - Set of assignments
     * @param {string|number} id - ID to look up
     * @returns {number} - Group number (0-4), or -1 if not found
     */
    getAssignmentGroup(assignmentSet, id) {
        for (const item of assignmentSet) {
            const normalized = this.normalizeAssignment(item);
            if (normalized && String(normalized.id) === String(id)) {
                return normalized.group;
            }
        }
        return -1;
    }

    /**
     * Initialize vis.js network
     * @returns {boolean} - True if initialization succeeded, false otherwise
     */
    initializeNetwork() {
        if (!this.container || typeof vis === 'undefined') {
            console.error('GraphVisualizer: Container or vis.js not available');
            return false;
        }

        // Create datasets
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();

        // Network configuration
        const config = {
            nodes: {
                shape: 'box',
                margin: 10,
                font: {
                    size: 14,
                    face: 'Arial',
                    multi: 'html'
                },
                widthConstraint: {
                    maximum: 150
                },
                borderWidth: 2,
                color: {
                    border: '#2B7CE9',
                    background: '#97C2FC',
                    highlight: {
                        border: '#2B7CE9',
                        background: '#7ba2d4'
                    }
                }
            },
            edges: {
                arrows: 'to',
                smooth: {
                    type: 'cubicBezier',
                    roundness: 0.4
                },
                color: {
                    color: '#848484',
                    highlight: '#848484'
                },
                width: 2
            },
            physics: {
                enabled: false
            },
            interaction: {
                hover: false,
                tooltipDelay: 200,
                zoomView: true,
                dragView: true,
                dragNodes: true,
                navigationButtons: false,
                keyboard: false
            }
        };

        // Create network
        this.network = new vis.Network(this.container, {
            nodes: this.nodes,
            edges: this.edges
        }, config);

        // Bind event handlers
        this.bindEventHandlers();
        
        // Initialize domain hull rendering
        this.initializeDomainHullRendering();
        
        return true;
    }

    /**
     * Initialize domain hull rendering
     */
    initializeDomainHullRendering() {
        if (!this.network) return;

        // Domain hull rendering on afterDrawing
        this.network.on('afterDrawing', (ctx) => {
            this.renderDomainHulls(ctx);
        });

        // Enhanced click handler for domain hulls
        this.network.on('click', (params) => {
            this.handleDomainHullClick(params);
        });
    }

    /**
     * Render domain hulls
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderDomainHulls(ctx) {
        if (!this.network || !this.graphState || !this.graphState.domains) {
            return;
        }

        try {
            const positions = this.network.getPositions();
            if (!positions || Object.keys(positions).length === 0) {
                return;
            }

            this.currentDomainHulls = {}; // Reset hulls
            
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            
            
            // Sort domains by depth (deepest first) so nested domains render on top
            const sortedDomains = [...this.graphState.domains].sort((a, b) => {
                const depthA = GraphUtils.calculateDepth(a, this.graphState.domains);
                const depthB = GraphUtils.calculateDepth(b, this.graphState.domains);
                return depthB - depthA; // Descending order (deepest first)
            });
            
            // Process domains in depth order (nested first)
            sortedDomains.forEach(domain => {
                const points = GraphUtils.getDomainPoints(domain, positions, this.graphState);

                if (points.length === 0) return;

                const hullPoints = GraphUtils.getConvexHull(points);

                if (hullPoints.length > 0) {
                    // Expand hull points
                    const expandedHull = GraphUtils.expandHullPoints(hullPoints);
                    this.currentDomainHulls[domain.id] = expandedHull;

                    // Calculate deterministic hue based on title + id
                    const hue = GraphUtils.getDeterministicHue(domain.title, domain.id);
                    const alpha = 0.15;
                    const domainGroup = this.getAssignmentGroup(this.assignable.highlightedDomains, domain.id);
                    const isHighlighted = domainGroup >= 0;

                    // Domain keeps its own color, but border changes when highlighted
                    ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    const config = isHighlighted ? this.highlightConfigs[domainGroup] : null;
                    ctx.strokeStyle = config ? config.domain.border : `hsl(${hue}, 70%, 60%)`;
                    ctx.lineWidth = isHighlighted ? 30 : 20;
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";

                    ctx.beginPath();
                    GraphUtils.drawSmoothHull(ctx, expandedHull);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.fill();
                }
            });
            
            ctx.restore();
        } catch (e) {
            console.warn("Error in renderDomainHulls:", e);
        }
    }

    /**
     * Handle domain hull clicks
     * @param {Object} params - Click parameters from vis.js
     */
    handleDomainHullClick(params) {
        // First check if click is on nodes or edges (handle those normally)
        if (params.nodes && params.nodes.length > 0) {
            this.options.onNodeClick(params.nodes[0]);
            return;
        }
        
        if (params.edges && params.edges.length > 0) {
            this.options.onEdgeClick(params.edges[0]);
            return;
        }

        // Click on empty space - clear node and domain highlighting only (keep edge highlighting)
        /*const hadHighlights = this.assignable.highlightedNodes.size > 0 || this.assignable.highlightedDomains.size > 0;
        if (hadHighlights) {
            this.assignable.highlightedNodes.clear();
            this.assignable.highlightedDomains.clear()
            // Trigger re-render to remove node highlights
            if (this.graphState) {
                this.updateVisualization(this.graphState);
            }
        }*/

        // Check for domain hull clicks
        const clickX = params.pointer.canvas.x;
        const clickY = params.pointer.canvas.y;
        const clickPoint = {x: clickX, y: clickY};

        // Find the deepest domain containing the click point
        let deepestDomainId = null;
        let maxDepth = -1;
        
        Object.keys(this.currentDomainHulls).forEach(domainId => {
            const hull = this.currentDomainHulls[domainId];
            if (hull && GraphUtils.isPointInPolygon(clickPoint, hull)) {
                // Calculate depth of this domain
                const domain = this.graphState.domains.find(d => d.id === parseInt(domainId, 10));
                const depth = GraphUtils.calculateDepth(domain, this.graphState.domains);
                // Keep track of the deepest domain
                if (depth > maxDepth) {
                    maxDepth = depth;
                    deepestDomainId = domainId;
                }
            }
        });
        
        // Trigger click on the deepest domain, or unfocus if no domain clicked
        if (deepestDomainId !== null) {
            this.options.onDomainClick(parseInt(deepestDomainId, 10));
        } else {
            // Clicked empty space - trigger unfocus to close details panels
            this.options.onUnfocus();
        }
    }

    /**
     * Bind network event handlers
     */
    bindEventHandlers() {
        if (!this.network) return;

        // Node clicking is handled by handleDomainHullClick
        // Edge clicking is handled by handleDomainHullClick

        // Node dragging
        this.network.on('dragging', (params) => {
            if (params.nodes && params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const position = this.network.getPosition(nodeId);
                this.options.onPositionChange(nodeId, position);
            }
        });

        /* Stabilization done - disabled since physics is always off
        this.network.on('stabilizationIterationsDone', () => {
            this.network.setOptions({ physics: { enabled: false } });
        }); */
    }

    /**
     * Update visualization with new graph data
     * @param {Object} graphState - Graph state with nodes, edges, cycles, domains
     */
    updateVisualization(graphState) {
        // Store graph state for domain hull rendering
        this.graphState = graphState;

        if (!this.network) {
            // Try to initialize - if it fails, don't retry (will just fail again)
            const initialized = this.initializeNetwork();
            if (!initialized) {
                return; // Initialization failed, don't retry
            }
            // After network is created, update with data
            setTimeout(() => this.updateVisualization(graphState), 100);
            return;
        }

        // Update data sets
        const visNodes = this.createVisNodes(graphState.nodes);
        const visEdges = this.createVisEdges(graphState.edges);

        this.nodes.clear();
        this.nodes.add(visNodes);
        this.edges.clear();
        this.edges.add(visEdges);

        // Fit network to view [NO, only do it upon creation, or when refreshed]
        /*setTimeout(() => {
            if (this.network) {
                this.network.fit({
                    animation: {
                        duration: 1000,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }
        }, 100);*/
    }

    /**
     * Create vis.js nodes from graph nodes
     * @param {Array} graphNodes - Graph nodes with position data
     * @returns {Array} vis.js node objects
     */
    createVisNodes(graphNodes) {
        return graphNodes.map(node => {
            // Use position override if available, otherwise use defaultPosition
            const position = node.position || node.defaultPosition;

            const visNode = {
                id: node.id,
                label: `${node.id}: ${node.title || 'Untitled'}`
            };

            // Set position if available
            if (position && position.x !== null && position.y !== null) {
                visNode.x = position.x;
                visNode.y = position.y;
            }

            // Apply highlight based on group assignment
            const nodeGroup = this.getAssignmentGroup(this.assignable.highlightedNodes, node.id);
            if (nodeGroup >= 0) {
                const config = this.highlightConfigs[nodeGroup];
                visNode.color = {
                    border: config.node.border,
                    background: config.node.background
                };
                visNode.borderWidth = 3;
            }

            return visNode;
        });
    }

    /**
     * Create vis.js edges from graph edges
     * @param {Array} graphEdges - Graph edges
     * @returns {Array} vis.js edge objects
     */
    createVisEdges(graphEdges) {
        return graphEdges.map((edge, index) => {
            const visEdge = {
                id: index,
                from: edge.from,
                to: edge.to,
                arrows: edge.arrows || 'to'
            };

            // Apply highlight based on group assignment
            const edgeGroup = this.getAssignmentGroup(this.assignable.highlightedEdges, index);
            if (edgeGroup >= 0) {
                const config = this.highlightConfigs[edgeGroup];
                visEdge.color = {
                    color: config.edge.border,
                    highlight: config.edge.border
                };
                visEdge.width = 3;
            }

            return visEdge;
        });
    }

    /**
     * Apply positions to nodes
     * @param {Map} positions - Map of node ID to position
     */
    applyPositions(positions) {
        if (!this.network) return;

        positions.forEach((position, nodeId) => {
            this.network.moveNode(nodeId, position.x, position.y);
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.network) {
            setTimeout(() => {
                this.network.fit();
            }, 100);
        }
    }

    /**
     * Fit network to view
     * @param {Object} options - Fit options
     */
    fitToView(options = {}) {
        if (this.network) {
            this.network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                },
                ...options
            });
        }
    }

    /**
     * Destroy the visualizer and clean up resources
     */
    destroy() {
        if (this.network) {
            this.network.destroy();
            this.network = null;
        }
        
        if (this.nodes) {
            this.nodes.clear();
            this.nodes = null;
        }
        
        if (this.edges) {
            this.edges.clear();
            this.edges = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphVisualizer;
} else {
    window.GraphVisualizer = GraphVisualizer;
}
