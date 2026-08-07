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
 * Graph Visualizer - Simple vis.js visualization component
 * Handles basic graph rendering with minimal data
 */
class GraphVisualizer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            // Assignable event handlers
            onNodeClick: options.onNodeClick || (() => {}),
            onEdgeClick: options.onEdgeClick || (() => {}),  // legacy stub; preserved for back-compat
            onPathwayClick: options.onPathwayClick || (() => {}),  // new pathway-aware click
            onPositionChange: options.onPositionChange || (() => {}),
            onDomainClick: options.onDomainClick || (() => {}),
            onUnfocus: options.onUnfocus || (() => {}),
            ...options
        };

        // Assignable system - supports both flat IDs (backward compat) and {id, group} format
        this.assignable = {
            highlightedNodes: new Set(),        // Set of {id, group} or just IDs
            highlightedEdges: new Set(),        // LEGACY: no longer used by the component; kept for back-compat
            highlightedDomains: new Set(),      // Set of {id, group} or just IDs
            // NEW: Map of nodeId -> pathwayIndex. The component is the sole
            // owner of the state->vis remap, so it applies the active
            // pathway highlight during render. Controllers only need to
            // set the desired (nodeId, pathwayIndex) here.
            highlightedPathways: new Map()
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
        this.currentDomains = {}; // Store hulls for hit-testing (visible domains only)
        this.currentDomainHulls = this.currentDomains; // Backwards-compatible alias

        // Translation layer (state <-> vis). The component is the only
        // place that knows collapsed domains become `domain-{id}` vis.js
        // nodes and that several state nodes may map to the same vis
        // node after collapsing.
        this.stateToVisMap = new Map();   // state nodeId/domainId -> vis id
        this.visToStateMap = new Map();   // vis id -> { type: 'node'|'domain', id: stateId }
        // visEdgeId -> [{ from, to, pathwayIndex, prereqId }, ...]
        // Records which state-level connection each visual edge came from.
        this.visEdgeContributions = new Map();
        this.pathwaySignatures = new Map();

        // Last-render cached derived data. Reset on every updateVisualization.
        this.collapsedDomainIds = new Set();
        this.lastVisNodes = [];        // [{ visId, stateId, type }]
        this.lastVisEdges = [];        // [{ visId, visFrom, visTo }]

        // Internal drag state for a collapsed-domain drag operation.
        this.draggingDomainId = null;
        this.dragStartPos = null; // {x, y} of the collapsed domain at drag start
        this.dragStartBases = new Map(); // nodeId -> original {x, y} for contained nodes

        this.initializeNetwork();
    }

    /**
     * Derive the set of collapsed domain ids straight from
     * `graphState.domains[i].isCollapsed`. The visualizer never stores its
     * own copy of this; the state manager is the single source of truth.
     * @param {Object} graphState
     * @returns {Set<number>}
     */
    deriveCollapsedDomainIds(graphState) {
        const out = new Set();
        const domains = graphState?.domains || [];
        domains.forEach(d => {
            if (d && d.isCollapsed) out.add(d.id);
        });
        return out;
    }

    /**
     * Get the current vis.js position of a domain node (collapsed view).
     * Returns null when the domain is not currently rendered as a collapsed node.
     * @param {number} domainId
     * @returns {{x:number, y:number}|null}
     */
    getCollapsedDomainPosition(domainId) {
        if (!this.network) return null;
        const visId = GraphUtils.getCollapsedDomainNodeId(domainId);
        if (!this.nodes || !this.nodes.get(visId)) return null;
        return this.network.getPosition(visId);
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

        // Enhanced click handler for domain hulls and collapsed domain nodes
        this.network.on('click', (params) => {
            this.handleDomainHullClickEvent(params);
        });
    }

    /**
     * Render domain hulls for uncollapsed, visible domains.
     * Collapsed domains and descendants of collapsed domains are skipped.
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

            this.currentDomains = {}; // Reset hulls (only visible domains)

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
                // Skip collapsed domains - they render as a single vis.js node.
                if (this.collapsedDomainIds.has(domain.id)) return;
                // Skip domains hidden behind a collapsed ancestor.
                if (GraphUtils.isAnyParentCollapsed(
                    domain.id, this.graphState.domains, this.collapsedDomainIds
                )) return;

                const points = GraphUtils.getDomainPoints(
                    domain, positions, this.graphState, this.collapsedDomainIds
                );

                if (points.length === 0) return;

                const hullPoints = GraphUtils.getConvexHull(points);

                if (hullPoints.length > 0) {
                    // Expand hull points
                    const expandedHull = GraphUtils.expandHullPoints(hullPoints);
                    this.currentDomains[domain.id] = expandedHull;

                    // Calculate deterministic hue based on title + id
                    const hue = GraphUtils.getDeterministicHue(domain.title, domain.id);
                    const alpha = 0.15;
                    const domainGroup = this.getAssignmentGroup(this.assignable.highlightedDomains, domain.id);
                    const isHighlighted = domainGroup >= 0;

                    // Domain keeps its own color, but border changes when highlighted
                    ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    const config = isHighlighted ? this.highlightConfigs[domainGroup] : null;
                    ctx.strokeStyle = config ? config.domain.border : `hsl(${hue}, 70%, 60%)`;
                    ctx.lineWidth = isHighlighted ? 15 : 10;
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
     * Handle click events for domain hulls, collapsed domain nodes, regular
     * nodes, and edges. The click event is dispatched to the matching
     * `options.on*` callback after translating the vis.js id back to a
     * state id via `visToStateMap`.
     * @param {Object} params - Click parameters from vis.js
     */
    handleDomainHullClickEvent(params) {
        // First check if click is on nodes (handle those normally)
        if (params.nodes && params.nodes.length > 0) {
            const visNodeId = params.nodes[0];
            // Translate vis id back to a state id. A collapsed-domain
            // vis.js node id has the "domain-" prefix.
            const domainId = GraphUtils.parseCollapsedDomainNodeId(visNodeId);
            if (domainId !== null) {
                this.options.onDomainClick(params.event.srcEvent, domainId);
            } else {
                this.options.onNodeClick(params.event.srcEvent, visNodeId);
            }
            return;
        }

        if (params.edges && params.edges.length > 0) {
            const visEdgeId = params.edges[0];
            const visEdge = this.edges.get(visEdgeId);           
            if (!visEdge) return;

            // Resolve the clicked edge back to a state-level target node,
            // the visualizer is the only place that knows how collapsed domains remapped the source endpoint,
            // we walk the contribution list to find a state node id
            const contributions = this.visEdgeContributions.get(visEdgeId) || [];
            if (contributions.length === 0) {
                // Legacy fall-through (no state-level mapping; e.g. before the first updateVisualization)
                // fire the legacy stub with the raw visEdgeId.
                this.options.onEdgeClick(visEdgeId);
                return;
            }

            // General case: simply send back edgeData in the format {source: {id: number, type: 'domain' | 'node'}, target: {id: number, type: 'domain' | 'node'}}
            const source = GraphUtils.parseVisId(visEdge.from);
            const target = GraphUtils.parseVisId(visEdge.to);
            if (source != null || target != null)
                // Simply call the pathway click callback
                this.options.onPathwayClick({source, target});
            return;
        }

        // Trigger click on the deepest domain, or unfocus if no domain clicked
        const deepestDomainId = this.getDeepestDomainId(params);
        if (deepestDomainId !== null) {
            this.options.onDomainClick(params.event.srcEvent, parseInt(deepestDomainId, 10));
        } else {
            // Clicked empty space
            this.options.onUnfocus();
        }
    }

    /**
     * Get the deepest visible domain containing the click point
     * @param {Object} params - Click parameters from vis.js
     * @returns {number|null} - The deepest domain ID, or null if no domain clicked
     */
    getDeepestDomainId(params) {
        // Check for domain hull clicks (uncollapsed domains only)
        const clickX = params.pointer.canvas.x;
        const clickY = params.pointer.canvas.y;
        const clickPoint = {x: clickX, y: clickY};

        // Find the deepest visible domain containing the click point
        let deepestDomainId = null;
        let maxDepth = -1;

        Object.keys(this.currentDomains).forEach(domainId => {
            const hull = this.currentDomains[domainId];
            if (hull && GraphUtils.isPointInPolygon(clickPoint, hull)) {
                // Calculate depth of this domain
                const domain = this.graphState.domains.find(d => d.id === parseInt(domainId, 10));
                if (!domain) return;
                const depth = GraphUtils.calculateDepth(domain, this.graphState.domains);
                // Keep track of the deepest domain
                if (depth > maxDepth) {
                    maxDepth = depth;
                    deepestDomainId = domainId;
                }
            }
        });
        return deepestDomainId;
    }

    /**
     * Bind network event handlers
     */
    bindEventHandlers() {
        if (!this.network) return;

        // Capture the start of a drag on a collapsed-domain node. The
        // contained (hidden) nodes are NOT in the vis.js DataSet, so we
        // can't read their live position; we snapshot their original
        // (pre-drag) stored position here, then on each `dragging` tick
        // we apply the domain's delta on top of those originals.
        this.network.on('dragStart', (params) => {
            this.draggingDomainId = null;
            this.dragStartPos = null;
            this.dragStartBases = new Map();
            if (!params.nodes || params.nodes.length === 0) return;
            const visNodeId = params.nodes[0];
            const domainId = GraphUtils.parseCollapsedDomainNodeId(visNodeId);
            if (domainId === null) return;
            const domain = this.graphState?.domains?.find(d => d.id === domainId);
            if (!domain) return;
            this.draggingDomainId = domainId;
            const startPos = this.network.getPosition(visNodeId);
            if (startPos) this.dragStartPos = { x: startPos.x, y: startPos.y };
            const contained = GraphUtils.getContainedNodes(
                domain, this.graphState.domains, this.graphState.nodes
            );
            contained.forEach(node => {
                const base = node.position || node.defaultPosition;
                if (base && base.x !== null && base.y !== null
                    && Number.isFinite(base.x) && Number.isFinite(base.y)) {
                    this.dragStartBases.set(node.id, { x: base.x, y: base.y });
                }
            });
        });

        // On every drag tick, apply the domain's delta to the original
        // bases captured in `dragStart`. Same pattern as the single-node
        // drag (vis.js already moved the domain node itself; we just
        // mirror the shift onto the hidden contained nodes).
        this.network.on('dragging', (params) => {
            if (this.draggingDomainId !== null) {
                const visId = GraphUtils.getCollapsedDomainNodeId(this.draggingDomainId);
                const currentPos = this.network.getPosition(visId);
                if (!this.dragStartPos || !currentPos) return;
                const dx = currentPos.x - this.dragStartPos.x;
                const dy = currentPos.y - this.dragStartPos.y;
                if (dx === 0 && dy === 0) return;
                this.dragStartBases.forEach((base, nodeId) => {
                    this.options.onPositionChange(nodeId, {
                        x: base.x + dx,
                        y: base.y + dy
                    });
                });
                return;
            }
            if (params.nodes && params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const position = this.network.getPosition(nodeId);
                this.options.onPositionChange(nodeId, position);
            }
        });

        // Reset drag state when the user releases the mouse.
        this.network.on('dragEnd', () => {
            this.draggingDomainId = null;
            this.dragStartPos = null;
            this.dragStartBases = new Map();
        });
    }

    /**
     * Update visualization with new graph state. The visualizer is the
     * SOLE place that turns `node.pathways` and the current
     * `domain.isCollapsed` flags into vis.js nodes/edges. Callers do not
     * pass pre-built edges anymore; they only pass the clean
     * `{ nodes, cycles, domains }` shape.
     * @param {Object} graphState - Graph state with nodes, cycles, domains
     */
    updateVisualization(graphState) {
        // Store graph state for domain hull rendering and remap lookups
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

        // Derive the collapsed-domain set straight from state. The state
        // manager is the single source of truth; the visualizer never
        // stores its own copy of this between calls.
        this.collapsedDomainIds = this.deriveCollapsedDomainIds(graphState);

        // Reset the translation layer before the new render.
        this.stateToVisMap = new Map();
        this.visToStateMap = new Map();
        this.visEdgeContributions = new Map();
        this.pathwaySignatures = new Map();
        this.lastVisNodes = [];
        this.lastVisEdges = [];
        
        // Build vis datasets. The visualizer is the only place that
        // knows collapsed domains are rendered as `domain-{id}` vis.js
        // nodes, and that several state-level connections may collapse
        // into a single visual edge.
        const visNodes = this.createVisNodes(graphState.nodes || [], graphState.domains || []);
        const visEdges = this.createVisEdges(graphState.nodes || [], graphState.domains || []);

        this.nodes.clear();
        this.nodes.add(visNodes);
        this.edges.clear();
        this.edges.add(visEdges);

        this.network.redraw();
    }

    /**
     * Create vis.js nodes from graph nodes plus one synthetic vis.js node
     * per collapsed domain. Hidden nodes (those whose ancestor chain
     * contains a collapsed domain) are filtered out. Any node whose
     * position is missing is laid out deterministically in a horizontal
     * line.
     * @param {Array} graphNodes
     * @param {Array} graphDomains
     * @returns {Array} vis.js node objects
     */
    createVisNodes(graphNodes, graphDomains) {
        const visNodes = [];
        let nullIndex = 0;
        const nullSpacing = 200;

        // Pass 1: regular nodes that are visible.
        graphNodes.forEach(node => {
            // Hide a node if any of its domain ancestors is collapsed.
            if (node.domainId != null
                && GraphUtils.isAncestorCollapsed(
                    node.domainId, graphDomains, this.collapsedDomainIds
                )) {
                return;
            }

            const position = node.position || node.defaultPosition;
            const visNode = {
                id: node.id,
                label: `${node.id}: ${node.title || 'Untitled'}`,
                shape: 'box'
            };

            if (position && position.x !== null && position.y !== null
                && Number.isFinite(position.x) && Number.isFinite(position.y)) {
                visNode.x = position.x;
                visNode.y = position.y;
            } else {
                // Deterministic horizontal placement for null-position nodes.
                visNode.x = nullIndex * nullSpacing;
                visNode.y = 0;
                nullIndex += 1;
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

            visNodes.push(visNode);
            // State node id == vis id (no remap needed for normal nodes).
            this.stateToVisMap.set(node.id, node.id);
            this.visToStateMap.set(node.id, { type: 'node', id: node.id });
            this.lastVisNodes.push({ visId: node.id, stateId: node.id, type: 'node' });
        });

        // Pass 2: collapsed-domain synthetic nodes.
        const collapsedDomainNodes = [];
        graphDomains.forEach(domain => {
            if (!this.collapsedDomainIds.has(domain.id)) return;

            // Filter out domains that have a collapsed parent (excluding themselves)
            if (GraphUtils.isAnyParentCollapsed(domain.id, graphDomains, this.collapsedDomainIds)) return;

            const contained = GraphUtils.getContainedNodes(
                domain, graphDomains, graphNodes
            );
            // Center of gravity over the descendant nodes (ignoring nulls).
            const cog = GraphUtils.getCenterOfGravity(contained);
            const hue = GraphUtils.getDeterministicHue(domain.title, domain.id);
            const visId = GraphUtils.getCollapsedDomainNodeId(domain.id);

            const visDomainNode = {
                id: visId,
                label: domain.title || `Domain ${domain.id}`,
                shape: 'ellipse',
                color: {
                    border: `hsl(${hue}, 70%, 45%)`,
                    background: `hsla(${hue}, 70%, 80%, 0.85)`
                },
                borderWidth: 2,
                margin: 12,
                font: { size: 14, face: 'Arial', multi: 'html' },
                widthConstraint: { maximum: 180 }
            };

            if (cog.x !== null && cog.y !== null
                && Number.isFinite(cog.x) && Number.isFinite(cog.y)) {
                visDomainNode.x = cog.x;
                visDomainNode.y = cog.y;
            } else {
                visDomainNode.x = nullIndex * nullSpacing;
                visDomainNode.y = 0;
                nullIndex += 1;
            }

            // Apply highlight if the domain itself is highlighted.
            const domainGroup = this.getAssignmentGroup(
                this.assignable.highlightedDomains, domain.id
            );
            if (domainGroup >= 0) {
                const config = this.highlightConfigs[domainGroup];
                if (config && config.node) {
                    visDomainNode.color = {
                        border: config.node.border,
                        background: config.node.background
                    };
                    visDomainNode.borderWidth = 3;
                }
            }

            collapsedDomainNodes.push(visDomainNode);
            // Domain vis id is `domain-{id}` and maps back to the state.
            this.stateToVisMap.set(domain.id, visId);
            this.visToStateMap.set(visId, { type: 'domain', id: domain.id });
            this.lastVisNodes.push({ visId, stateId: domain.id, type: 'domain' });
        });

        return visNodes.concat(collapsedDomainNodes);
    }

    /**
     * Reconstruct every visual edge from `node.pathways` (state-level
     * DNF: `[[prereqId, ...], ...]`). Each connection
     * `prereqId -> dependentId` is remapped to the visible
     * representation (collapsing routes to the topmost collapsed
     * ancestor), self-loops are dropped, and duplicate visual edges
     * are merged. The resulting `visEdgeContributions` lets the
     * edge-click handler recover the underlying state-level
     * connection for pathway cycling.
     *
     * The component also performs transitive reduction visually so
     * that `A -> B -> C` collapses into a single `A -> C` arrow.
     * @param {Array} graphNodes
     * @param {Array} graphDomains
     * @returns {Array} vis.js edge objects
     */
    createVisEdges(graphNodes, graphDomains) {
        // Populate pathway signatures given the current collapsed states
        this.pathwaySignatures = new Map();
        graphNodes.forEach(node => {
            const pathways = node.pathways || [];
            pathways.forEach((pathway, pathwayIndex) => {
                const address = `${node.id}-${pathwayIndex}`;
                const sig = GraphUtils.getPathwaySignature(
                    { nodeId: node.id, pathwayIndex },
                    graphNodes,
                    graphDomains,
                    this.collapsedDomainIds
                );
                this.pathwaySignatures.set(address, sig);
            });
        });

        // 1) Build the list of state-level connections from pathways.
        //    Each connection: { from, to, pathwayIndex, prereqId }
        const stateConnections = [];
        graphNodes.forEach(node => {
            const pathways = node.pathways || [];
            pathways.forEach((pathway, pathwayIndex) => {
                if (!Array.isArray(pathway)) return;
                pathway.forEach(prereqId => {
                    if (prereqId == null) return;
                    stateConnections.push({
                        from: prereqId,
                        to: node.id,
                        pathwayIndex,
                        prereqId
                    });
                });
            });
        });

        // 2) Remap endpoints and merge by visible key.
        //    visibleKey = `${visFrom}->${visTo}` -> { visEdge, contributions }
        const nodeById = new Map();
        graphNodes.forEach(n => nodeById.set(n.id, n));
        const nodeByIdStr = new Map();
        graphNodes.forEach(n => nodeByIdStr.set(String(n.id), n));
        const lookupNode = (id) => {
            if (id == null) return null;
            return nodeById.get(id) || nodeByIdStr.get(String(id)) || null;
        };

        const combined = new Map();
        let nextId = 0;
        stateConnections.forEach(conn => {
            const fromNode = lookupNode(conn.from);
            const toNode = lookupNode(conn.to);
            const visFrom = GraphUtils.remapNodeId(
                {
                    id: conn.from,
                    domainId: fromNode ? fromNode.domainId : null
                },
                graphDomains, this.collapsedDomainIds
            );
            const visTo = GraphUtils.remapNodeId(
                {
                    id: conn.to,
                    domainId: toNode ? toNode.domainId : null
                },
                graphDomains, this.collapsedDomainIds
            );
            if (visFrom === visTo) return; // self-loop inside a collapsed domain
            const key = `${visFrom}->${visTo}`;
            if (!combined.has(key)) {
                combined.set(key, {
                    visEdge: {
                        id: nextId++,
                        from: visFrom,
                        to: visTo,
                        arrows: 'to'
                    },
                    contributions: [conn]
                });
            } else {
                combined.get(key).contributions.push(conn);
            }
        });

        // 3) Transitive reduction. We want to drop visual edges `A->C`
        //    when there is a path `A -> ... -> C` of length >= 2.
        const reducedSet = this._transitiveReduceCombinedEdges(combined);

        // 4) Build the visEdge array, applying pathway highlights.
        const visEdges = [];
        combined.forEach((entry, key) => {
            if (!reducedSet.has(key)) return;
            const { visEdge, contributions } = entry;
            this.visEdgeContributions.set(visEdge.id, contributions);
            this.lastVisEdges.push({
                visId: visEdge.id,
                visFrom: visEdge.from,
                visTo: visEdge.to
            });

            // Highlight the edge if any contribution's target node is
            // currently showing the pathway that contribution belongs to.         
            const isHighlighted = contributions.some(c => {
                const activeIdx = this.assignable.highlightedPathways.get(c.to);
                return activeIdx !== undefined && activeIdx === c.pathwayIndex;
            });
            if (isHighlighted) {
                const cfg = this.highlightConfigs[0];
                visEdge.color = { color: cfg.edge.border, highlight: cfg.edge.border };
                visEdge.width = 3;
            }
            visEdges.push(visEdge);
        });
        return visEdges;
    }

    /**
     * Gets unique pathway contributions for a given edge.
     * @param {Object} edgeData - Edge data of the form {source: {id, type}, target: {id, type}}
     * @param {boolean} filterHighlighted - Whether to filter out highlighted pathways.
     * @returns {Object} returns {pathways: Array<{nodeId, referenceIndex}>,
     * referenceIndex is the largest index of the filtered pathways that triggered the duplicate check, or null if none}
     */
    getUniqueEdgeContribution(edgeData, filterHighlighted = true) {
        const { source, target } = edgeData;
        // Guard clause
        if (source.id == null || target.id == null || (source.type != 'node' && source.type != 'domain') || (target.type != 'node' && target.type != 'domain'))
            return { pathways: [], referenceIndex: null };

        const sourceId = GraphUtils.convertToVisNodeId(source.id, source.type);
        const targetId = GraphUtils.convertToVisNodeId(target.id, target.type);
        
        const visEdge = this.lastVisEdges.find(e => String(e.visFrom) === sourceId && String(e.visTo) === targetId);
        if (!visEdge) return { pathways: [], referenceIndex: null };
        const edgeId = visEdge.visId;
        const contributions = this.visEdgeContributions.get(edgeId);
        if (!contributions) return { pathways: [], referenceIndex: null };

        const seenSignatures = new Set();
        const uniquePathways = [];
        contributions.forEach(con => {
            const address = `${con.to}-${con.pathwayIndex}`;
            const signature = this.pathwaySignatures.get(address);
            if (!seenSignatures.has(signature)) {
                seenSignatures.add(signature);
                uniquePathways.push({
                    nodeId: con.to,
                    pathwayIndex: con.pathwayIndex
                });
            }
        });

        if (filterHighlighted) {
            const { filteredPathways, referenceIndex } = this.filterHighlightedPathways(uniquePathways, this.assignable.highlightedPathways);
            return { pathways: filteredPathways, referenceIndex };
        }
        else return { pathways: uniquePathways, referenceIndex: null };
    }

    /**
     * Filters out highlighted pathways from the unique pathways.
     * @param {Array<Object>} uniquePathways - Unique pathways of the form {nodeId, pathwayIndex}
     * @param {Map<Number, Number>} allCurrentPathwayIndices - Map of node ID to all pathway index.
     * @returns {Object} returns {filteredPathways: Array<{nodeId, referenceIndex}>,
     * referenceIndex is the largest index of the filtered pathways that triggered the duplicate check, or null if none}
     */
    filterHighlightedPathways(uniquePathways, allCurrentPathwayIndices) {
        const filteredPathways = [];
        
        // 1) Remap the pathways to vis node signatures.
        const remap = (nodeId, pathwayIndex) => {
            if (pathwayIndex == null) return '';
            // Remap the pathway to vis node signature
            const address = `${nodeId}-${pathwayIndex}`;
            const signature = this.pathwaySignatures.get(address);
            
            if (!signature) return '';
            return signature;
        };

        const activeSignatures = new Set([...allCurrentPathwayIndices.entries()].map(([nodeId, pathwayIndex]) => remap(nodeId, pathwayIndex)));

        // 2) Sort the list for deterministic reference index generation
        uniquePathways.sort((a, b) => a.nodeId - b.nodeId || a.pathwayIndex - b.pathwayIndex);

        // 3) Filter out currently highlighted pathways.
        // referenceIndex is the largest index of the filtered pathways that triggered the duplicate check
        let referenceIndex = null;
        let counter = -1;
        uniquePathways.forEach(({ nodeId, pathwayIndex }) => {
            const address = `${nodeId}-${pathwayIndex}`;
            const signature = this.pathwaySignatures.get(address);
            if (!signature) return;
            if (activeSignatures.has(signature)) {
                // This pathway is highlighted already, so we filter it out
                // Note that this also automatically filters out the selected pathway
                referenceIndex = counter
                return;
            }
            // If no remapped pathways have this signature, then it is not highlighted
            filteredPathways.push({nodeId, pathwayIndex});
            counter++;
        });

        return {filteredPathways, referenceIndex};
    }

    /**
     * Transitive reduction on the visual-edge map. Returns the set of
     * `visibleKey`s that should be kept. An edge `A->C` is removed when
     * there exists some intermediate vis node `B` such that `A->B` and
     * `B->C` are both currently in the map.
     * @param {Map<string, Object>} combined
     * @returns {Set<string>}
     */
    _transitiveReduceCombinedEdges(combined) {
        // Adjacency: visFrom -> Set<visTo>
        const adj = new Map();
        combined.forEach((entry) => {
            const { visEdge } = entry;
            if (!adj.has(visEdge.from)) adj.set(visEdge.from, new Set());
            adj.get(visEdge.from).add(visEdge.to);
        });

        // Floyd-Warshall over the small vis-node set.
        const nodes = Array.from(adj.keys());
        const reach = new Map();
        nodes.forEach(n => {
            const s = new Set(adj.get(n) || []);
            reach.set(n, s);
        });
        for (const k of nodes) {
            for (const i of nodes) {
                if (!reach.get(i).has(k)) continue;
                for (const j of nodes) {
                    if (reach.get(k).has(j)) reach.get(i).add(j);
                }
            }
        }

        // Drop direct edges A->C when an intermediate B exists.
        const keep = new Set();
        combined.forEach((entry, key) => {
            const { visEdge } = entry;
            let isTransitive = false;
            const reachableFromA = reach.get(visEdge.from) || new Set();
            for (const intermediate of nodes) {
                if (intermediate === visEdge.from || intermediate === visEdge.to) continue;
                if (reachableFromA.has(intermediate)) {
                    const reachableFromInter = reach.get(intermediate) || new Set();
                    if (reachableFromInter.has(visEdge.to)) {
                        isTransitive = true;
                        break;
                    }
                }
            }
            if (!isTransitive) keep.add(key);
        });
        return keep;
    }

    /**
     * Apply positions to visible nodes and re-centre collapsed domains.
     *
     * Contained (hidden) nodes are not in the vis.js DataSet, so they are
     * skipped here. Their new positions are already in the state, set by
     * the caller, and will take effect when the domain is uncollapsed.
     *
     * After moving visible nodes, the position of every visible collapsed
     * domain is recomputed from the new CoG of its contained nodes.
     *
     * @param {Map} positions - Map of node ID to `{x, y}`
     */
    applyPositions(positions) {
        if (!this.network) return;

        positions.forEach((position, nodeId) => {
            if (!position || position.x === null || position.y === null
                || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
                return;
            }
            // Skip nodes that are not in the DataSet (e.g. nodes hidden
            // behind a collapsed ancestor).
            if (this.nodes && !this.nodes.get(nodeId)) return;
            this.network.moveNode(nodeId, position.x, position.y);
        });

        // Re-centre collapsed domain nodes on the new CoG of their
        // contained nodes (whose live vis.js positions have just been
        // updated).
        if (this.graphState && this.collapsedDomainIds.size > 0) {
            this.graphState.domains.forEach(domain => {
                if (!this.collapsedDomainIds.has(domain.id)) return;
                const visId = GraphUtils.getCollapsedDomainNodeId(domain.id);
                if (!this.nodes.get(visId)) return;
                const contained = GraphUtils.getContainedNodes(
                    domain, this.graphState.domains, this.graphState.nodes
                );
                const cog = GraphUtils.getCenterOfGravity(contained);
                if (cog.x !== null && cog.y !== null
                    && Number.isFinite(cog.x) && Number.isFinite(cog.y)) {
                    this.network.moveNode(visId, cog.x, cog.y);
                }
            });
        }

        this.network.redraw();
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
