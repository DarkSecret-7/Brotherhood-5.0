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
            ...options
        };
        
        this.network = null;
        this.nodes = null;
        this.edges = null;
        this.currentDomainHulls = {}; // Store hulls for hit-testing
        
        this.initializeNetwork();
    }

    /**
     * Initialize vis.js network
     */
    initializeNetwork() {
        if (!this.container || typeof vis === 'undefined') {
            console.error('GraphVisualizer: Container or vis.js not available');
            return;
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
                        background: '#D2E5FF'
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
                    highlight: '#2B7CE9'
                },
                width: 2
            },
            physics: {
                enabled: false
            },
            interaction: {
                hover: true,
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
     * Check if point is in polygon
     * @param {Object} point - Point with x, y
     * @param {Array} vs - Array of vertices
     * @returns {boolean} Whether point is inside polygon
     */
    isPointInPolygon(point, vs) {
        const x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;
            const intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Calculate convex hull using monotone chain algorithm
     * @param {Array} points - Array of points with x, y
     * @returns {Array} Convex hull points
     */
    getConvexHull(points) {
        if (points.length < 3) return points;
        
        // Sort by x, then y
        const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);

        const cross = (o, a, b) => {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        };

        const lower = [];
        for (let i = 0; i < sorted.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
                lower.pop();
            }
            lower.push(sorted[i]);
        }

        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
                upper.pop();
            }
            upper.push(sorted[i]);
        }

        upper.pop();
        lower.pop();
        return lower.concat(upper);
    }

    /**
     * Draw smooth hull with quadratic bezier curves
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Array} points - Hull points
     */
    drawSmoothHull(ctx, points) {
        if (points.length < 1) return;
        
        // 1 point: Circle
        if (points.length === 1) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[0].x, points[0].y);
            return;
        }
        
        // 2 points: Line
        if (points.length === 2) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            return;
        }

        // 3+ points: Quadratic Bezier Curve loop
        const len = points.length;
        const pLast = points[len - 1];
        const pFirst = points[0];
        const midX = (pLast.x + pFirst.x) / 2;
        const midY = (pLast.y + pFirst.y) / 2;

        ctx.moveTo(midX, midY);

        for (let i = 0; i < len; i++) {
            const p = points[i]; // Control point
            const nextP = points[(i + 1) % len];
            
            const nextMidX = (p.x + nextP.x) / 2;
            const nextMidY = (p.y + nextP.y) / 2;
            
            ctx.quadraticCurveTo(p.x, p.y, nextMidX, nextMidY);
        }
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
            
            // Process domains (assuming graphState.domains exists)
            this.graphState.domains.forEach(domain => {
                const points = this.getDomainPoints(domain, positions);
                
                if (points.length === 0) return;

                const hullPoints = this.getConvexHull(points);
                
                if (hullPoints.length > 0) {
                    // Expand hull points
                    const expandedHull = this.expandHullPoints(hullPoints);
                    this.currentDomainHulls[domain.id] = expandedHull;
                    
                    // Draw hull
                    const hue = (parseInt(domain.id) * 137.508) % 360;
                    const alpha = 0.15;
                    
                    ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    ctx.strokeStyle = `hsl(${hue}, 70%, 60%)`;
                    ctx.lineWidth = 20;
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";
                    
                    ctx.beginPath();
                    this.drawSmoothHull(ctx, expandedHull);
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
     * Get points for domain hull calculation
     * @param {Object} domain - Domain object
     * @param {Object} positions - Node positions
     * @returns {Array} Array of points
     */
    getDomainPoints(domain, positions) {
        const points = [];
        const baseMargin = 15;  // Base margin around the node
        const maxWidth = 150;   // Same as widthConstraint.maximum
        const charWidth = 7;    // Approximate width per character
        const lineHeight = 20;  // Height per line of text

        // Add points for nodes in this domain
        if (this.graphState && this.graphState.nodes) {
            this.graphState.nodes.forEach(node => {
                // Handle both string and number domain IDs
                const nodeDomainId = String(node.domainId || '');
                const domainId = String(domain.id || '');

                if (nodeDomainId === domainId) {
                    const pos = positions[node.id] || positions[String(node.id)] || positions[parseInt(node.id)];
                    if (pos) {
                        // Calculate node box dimensions based on label text
                        const label = `${node.id}: ${node.title || 'Untitled'}`;

                        // Calculate how many lines the text will wrap to
                        const textWidth = label.length * charWidth;
                        const numLines = Math.ceil(textWidth / maxWidth);
                        const actualLines = Math.max(1, numLines);

                        // Calculate dimensions
                        const halfWidth = Math.min(maxWidth, textWidth) / 2 + baseMargin;
                        const halfHeight = (actualLines * lineHeight) / 2 + baseMargin;

                        // Add bounding box corners (full extent of the node box)
                        points.push({x: pos.x - halfWidth, y: pos.y - halfHeight});
                        points.push({x: pos.x + halfWidth, y: pos.y - halfHeight});
                        points.push({x: pos.x + halfWidth, y: pos.y + halfHeight});
                        points.push({x: pos.x - halfWidth, y: pos.y + halfHeight});
                    }
                }
            });
        }

        return points;
    }

    /**
     * Expand hull points outward
     * @param {Array} hullPoints - Original hull points
     * @returns {Array} Expanded hull points
     */
    expandHullPoints(hullPoints) {
        const centroid = {x: 0, y: 0};
        hullPoints.forEach(p => {
            centroid.x += p.x;
            centroid.y += p.y;
        });
        centroid.x /= hullPoints.length;
        centroid.y /= hullPoints.length;

        const expansionDistance = 30;
        
        return hullPoints.map(p => {
            const dx = p.x - centroid.x;
            const dy = p.y - centroid.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 0.1) return p;
            const scale = (dist + expansionDistance) / dist;
            return {
                x: centroid.x + dx * scale,
                y: centroid.y + dy * scale
            };
        });
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

        // Check for domain hull clicks
        const clickX = params.pointer.canvas.x;
        const clickY = params.pointer.canvas.y;
        const clickPoint = {x: clickX, y: clickY};

        // Check each domain hull (sorted by some criteria if needed)
        Object.keys(this.currentDomainHulls).forEach(domainId => {
            const hull = this.currentDomainHulls[domainId];
            if (hull && this.isPointInPolygon(clickPoint, hull)) {
                this.options.onDomainClick(domainId);
                return; // Handle only the first matching domain
            }
        });
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

        // Stabilization done - disabled since physics is always off
        // this.network.on('stabilizationIterationsDone', () => {
        //     this.network.setOptions({ physics: { enabled: false } });
        // });
    }

    /**
     * Update visualization with new graph data
     * @param {Object} graphState - Graph state with nodes, edges, cycles, domains
     */
    updateVisualization(graphState) {
        // Store graph state for domain hull rendering
        this.graphState = graphState;

        if (!this.network) {
            this.initializeNetwork();
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

        // Fit network to view
        setTimeout(() => {
            if (this.network) {
                this.network.fit({
                    animation: {
                        duration: 1000,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }
        }, 100);
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

            return visNode;
        });
    }

    /**
     * Create vis.js edges from graph edges
     * @param {Array} graphEdges - Graph edges
     * @returns {Array} vis.js edge objects
     */
    createVisEdges(graphEdges) {
        return graphEdges.map((edge, index) => ({
            id: index,
            from: edge.from,
            to: edge.to,
            arrows: edge.arrows || 'to'
        }));
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
     * Get current node positions
     * @returns {Map} Map of node ID to current position
     */
    getCurrentPositions() {
        if (!this.network) return new Map();

        const positions = new Map();
        const nodeIds = this.nodes.getIds();
        
        nodeIds.forEach(nodeId => {
            const position = this.network.getPosition(nodeId);
            positions.set(nodeId, position);
        });

        return positions;
    }

    /**
     * Fix positions - update local node positions to current x,y coordinates
     * @returns {Map} Map of node ID to current position
     */
    fixPositions() {
        if (!this.network) return new Map();

        const positions = this.getCurrentPositions();
        
        // Return positions so they can be sent to backend
        return positions;
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
