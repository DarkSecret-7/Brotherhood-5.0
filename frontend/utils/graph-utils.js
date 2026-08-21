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
 * Graph Utilities - Domain hull calculation and geometry helpers
 * Provides static methods for working with graph visualizations
 */

// Prefix used internally by the visualizer to namespace collapsed-domain
// vis.js node ids. This is the ONLY place outside the visualizer that
// needs to know about it (and it shouldn't: the outside always works
// with integer domain/node ids; the visualizer translates).
const COLLAPSED_DOMAIN_NODE_PREFIX = 'domain-';

class GraphUtils {
    /**
     * Format a domain id as the internal collapsed-domain vis.js node id.
     * @param {number|string} domainId
     * @returns {string}
     */
    static getCollapsedDomainNodeId(domainId) {
        return `${COLLAPSED_DOMAIN_NODE_PREFIX}${domainId}`;
    }

    /**
     * Convert a domain id or node id to the internal vis.js node id.
     * @param {number|string} id
     * @param {string} type - 'domain' or 'node' for the type of id to convert
     * @returns {string|null} The vis.js node id or null if the type is invalid
     */
    static convertToVisNodeId(id, type = 'node') {
        return type === 'domain' ? GraphUtils.getCollapsedDomainNodeId(id)
            : type === 'node' ? String(id) : null;
    }

    /**
     * Parse a vis.js node id back into an integer domain id.
     * Returns null if the input is not a collapsed-domain node id.
     * @param {string|number} nodeId
     * @returns {number|null}
     */
    static parseCollapsedDomainNodeId(nodeId) {
        if (nodeId == null) return null;
        const s = String(nodeId);
        if (!s.startsWith(COLLAPSED_DOMAIN_NODE_PREFIX)) return null;
        const n = parseInt(s.slice(COLLAPSED_DOMAIN_NODE_PREFIX.length), 10);
        return Number.isNaN(n) ? null : n;
    }

    /**
     * Parse a vis.js node id back into an integer domain id or node id.
     * Returns null if the input is not a collapsed-domain node id.
     * @param {string|number|null} visId - The vis.js node id to parse
     * @returns {object|null} An object with properties {id: {number}, type: 'domain' | 'node'}
     */
    static parseVisId(visId) {
        if (visId == null) return null;
        if (String(visId).startsWith(COLLAPSED_DOMAIN_NODE_PREFIX)) return {id: GraphUtils.parseCollapsedDomainNodeId(visId), type: 'domain'};
        return {id: Number(visId), type: 'node'};
    }

    /**
     * Whether the given vis.js node id represents a collapsed domain node.
     * @param {string|number} nodeId
     * @returns {boolean}
     */
    static isCollapsedDomainNode(nodeId) {
        return GraphUtils.parseCollapsedDomainNodeId(nodeId) !== null;
    }

    /**
     * Recursively check whether the given domain id (or any of its ancestors)
     * is in the set of collapsed domain ids.
     * @param {number|string|null} domainId
     * @param {Array} allDomains
     * @param {Set|Array} collapsedDomainIds
     * @returns {boolean}
     */
    static isAncestorCollapsed(domainId, allDomains, collapsedDomainIds) {
        let current = domainId;
        const collapsed = collapsedDomainIds instanceof Set
            ? collapsedDomainIds
            : new Set(collapsedDomainIds || []);
        while (current != null) {
            if (collapsed.has(current)) return true;
            const domain = allDomains.find(d => d.id === current);
            if (!domain || domain.parentId == null) break;
            current = domain.parentId;
        }
        return false;
    }

    /**
     * Recursively check whether any parent of the given domain (excluding the
     * domain itself) is collapsed.
     * @param {number|string|null} domainId
     * @param {Array} allDomains
     * @param {Set|Array} collapsedDomainIds
     * @returns {boolean}
     */
    static isAnyParentCollapsed(domainId, allDomains, collapsedDomainIds) {
        const domain = allDomains.find(d => d.id === domainId);
        if (!domain || domain.parentId == null) return false;
        return GraphUtils.isAncestorCollapsed(domain.parentId, allDomains, collapsedDomainIds);
    }

    /**
     * Walk the parent chain starting from `domainId` and return the top-most
     * collapsed ancestor's id (closest to the root). The domain itself is
     * included in the search. Returns null if no ancestor is collapsed.
     * @param {number|string|null} domainId
     * @param {Array} allDomains
     * @param {Set|Array} collapsedDomainIds
     * @returns {number|string|null}
     */
    static getHighestCollapsedAncestor(domainId, allDomains, collapsedDomainIds) {
        let current = domainId;
        let highest = null;
        const collapsed = collapsedDomainIds instanceof Set
            ? collapsedDomainIds
            : new Set(collapsedDomainIds || []);
        while (current != null) {            
            if (collapsed.has(current)) highest = current;
            const domain = allDomains.find(d => d.id === current);
            if (!domain || domain.parentId == null) break;
            current = domain.parentId;
        }
        return highest;
    }

    /**
     * Collect every node directly or indirectly contained within a domain
     * (including through nested subdomains). Returns node objects, NOT ids.
     * @param {Object} domain
     * @param {Array} allDomains
     * @param {Array} allNodes
     * @returns {Array}
     */
    static getContainedNodes(domain, allDomains, allNodes) {
        if (!domain) return [];
        const targetId = domain.id;
        const contained = [];
        const childIds = new Set();
        const queue = [targetId];
        while (queue.length > 0) {
            const currentId = queue.shift();
            allDomains.forEach(d => {
                if (d.parentId === currentId && !childIds.has(d.id)) {
                    childIds.add(d.id);
                    queue.push(d.id);
                }
            });
        }
        allNodes.forEach(node => {
            if (node.domainId === targetId || childIds.has(node.domainId)) {
                contained.push(node);
            }
        });
        return contained;
    }

    /**
     * Compute the center of gravity (average position) over a set of nodes.
     * Nodes with null/undefined positions are ignored. Returns
     * `{ x: null, y: null }` when no node contributes a valid position.
     * @param {Array} nodes
     * @returns {{x: number|null, y: number|null}}
     */
    static getCenterOfGravity(nodes) {
        if (!nodes || nodes.length === 0) return { x: null, y: null };
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        nodes.forEach(node => {
            const pos = node.position || node.defaultPosition;
            if (pos && pos.x !== null && pos.y !== null
                && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
                sumX += pos.x;
                sumY += pos.y;
                count += 1;
            }
        });
        if (count === 0) return { x: null, y: null };
        return { x: sumX / count, y: sumY / count };
    }

    /**
     * Re-position the nodes contained in a collapsed domain around an anchor
     * (the domain's current position in the network).
     *
     * - Already-positioned descendants are translated to preserve their
     *   relative offsets to the current CoG, then re-centred on `anchor`.
     * - Null-position descendants are placed in a horizontal line around
     *   `anchor`.
     *
     * Mutates each contained node's `position` field in place.
     * @param {Array} contained - Contained node objects (with `position`
     *   and/or `defaultPosition`)
     * @param {{x: number, y: number}|null} anchor - Domain's current position
     * @param {number} [nullSpacing=200] - Horizontal spacing for null nodes
     */
    static positionContainedNodes(contained, anchor, nullSpacing = 200) {
        if (!contained || contained.length === 0 || !anchor) return;

        const positioned = [];
        const nullDescendants = [];
        contained.forEach(n => {
            const p = n.position || n.defaultPosition;
            if (p && p.x !== null && p.y !== null
                && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                positioned.push(n);
            } else {
                nullDescendants.push(n);
            }
        });

        if (positioned.length > 0) {
            const cog = this.getCenterOfGravity(positioned);
            if (cog.x !== null && cog.y !== null) {
                const dx = anchor.x - cog.x;
                const dy = anchor.y - cog.y;
                positioned.forEach(n => {
                    const p = n.position || n.defaultPosition;
                    n.position = { x: p.x + dx, y: p.y + dy };
                });
            }
        }

        if (nullDescendants.length > 0) {
            nullDescendants.forEach((n, i) => {
                const offset = (i - (nullDescendants.length - 1) / 2) * nullSpacing;
                n.position = { x: anchor.x + offset, y: anchor.y };
            });
        }
    }

    /**
     * Check if point is in polygon
     * @param {Object} point - Point with x, y
     * @param {Array} vs - Array of vertices
     * @returns {boolean} Whether point is inside polygon
     */
    static isPointInPolygon(point, vs) {
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
     * Calculate domain nesting depth (how many levels deep from root)
     * @param {Object} domain - Domain object with id and parentId
     * @param {Array} allDomains - Array of all domains for parent lookup
     * @returns {number} Nesting depth (0 for root domains)
     */
    static calculateDepth(domain, allDomains) {
        if (!domain.parentId) return 0;
        const parent = allDomains.find(d => d.id === domain.parentId);
        return parent ? this.calculateDepth(parent, allDomains) + 1 : 0;
    }

    /**
     * Calculate convex hull using monotone chain algorithm
     * @param {Array} points - Array of points with x, y
     * @returns {Array} Convex hull points
     */
    static getConvexHull(points) {
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
    static drawSmoothHull(ctx, points) {
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
     * Get points for domain hull calculation
     * @param {Object} domain - Domain object
     * @param {Object} positions - Node positions
     * @param {Object} graphState - Graph state with nodes
     * @param {Set|Array} [collapsedDomainIds] - Ids of collapsed domains. When a
     *   child domain is collapsed, the parent hull treats it as a single
     *   point (its center of gravity) rather than recursing into its hull.
     * @returns {Array} Array of points
     */
    static getDomainPoints(domain, positions, graphState, collapsedDomainIds) {
        const points = [];
        const baseMargin = 15;  // Base margin around the node
        const maxWidth = 150;   // Same as widthConstraint.maximum
        const charWidth = 7;    // Approximate width per character
        const lineHeight = 20;  // Height per line of text
        const collapsed = collapsedDomainIds instanceof Set
            ? collapsedDomainIds
            : new Set(collapsedDomainIds || []);

        // Helper to push the four corners of a node's bounding box into the
        // given target array.
        const pushNodeCorners = (node, pos, target) => {
            const label = `${node.id}: ${node.title || 'Untitled'}`;
            const textWidth = label.length * charWidth;
            const numLines = Math.ceil(textWidth / maxWidth);
            const actualLines = Math.max(1, numLines);
            const halfWidth = Math.min(maxWidth, textWidth) / 2 + baseMargin;
            const halfHeight = (actualLines * lineHeight) / 2 + baseMargin;
            target.push({x: pos.x - halfWidth, y: pos.y - halfHeight});
            target.push({x: pos.x + halfWidth, y: pos.y - halfHeight});
            target.push({x: pos.x + halfWidth, y: pos.y + halfHeight});
            target.push({x: pos.x - halfWidth, y: pos.y + halfHeight});
        };

        // Helper to collect points for a domain and its child domains
        const collectPoints = (targetDomain, depth = 0) => {
            // Add points for nodes directly in this domain
            if (graphState && graphState.nodes) {
                graphState.nodes.forEach(node => {
                    const nodeDomainId = String(node.domainId || '');
                    const domainId = String(targetDomain.id || '');

                    if (nodeDomainId === domainId) {
                        const pos = positions[node.id] || positions[String(node.id)] || positions[parseInt(node.id)];
                        if (pos) {
                            pushNodeCorners(node, pos, points);
                        }
                    }
                });
            }

            // Recursively collect from child domains and include their expanded hulls
            if (graphState && graphState.domains) {
                graphState.domains.forEach(childDomain => {
                    const childParentId = childDomain.parentId != null ? Number(childDomain.parentId) : null;
                    const targetId = targetDomain.id != null ? Number(targetDomain.id) : null;
                    if (childParentId === targetId) {
                        if (collapsed.has(childDomain.id)) {
                            // Collapsed child: contribute a single point at its
                            // center of gravity so the parent hull still
                            // encloses the child domain's visual mass.
                            const contained = this.getContainedNodes(
                                childDomain,
                                graphState.domains || [],
                                graphState.nodes || []
                            );
                            const cog = this.getCenterOfGravity(contained);
                            if (cog.x !== null && cog.y !== null) {
                                const label = childDomain.title || `Domain ${childDomain.id}`;
                                const halfWidth = Math.min(maxWidth, label.length * charWidth) / 2 + baseMargin;
                                const halfHeight = lineHeight / 2 + baseMargin;
                                points.push({ x: cog.x - halfWidth, y: cog.y - halfHeight });
                                points.push({ x: cog.x + halfWidth, y: cog.y - halfHeight });
                                points.push({ x: cog.x + halfWidth, y: cog.y + halfHeight });
                                points.push({ x: cog.x - halfWidth, y: cog.y + halfHeight });
                            }
                            return;
                        }

                        // First collect child points recursively
                        collectPoints(childDomain, depth + 1);

                        // Then add the child's expanded hull points so parent engulfs the child's padding too
                        // We need to compute the child's hull at this point
                        const childPoints = [];
                        // Quick collection of child nodes for hull calculation
                        if (graphState.nodes) {
                            graphState.nodes.forEach(node => {
                                if (String(node.domainId || '') === String(childDomain.id || '')) {
                                    const pos = positions[node.id] || positions[String(node.id)] || positions[parseInt(node.id)];
                                    if (pos) {
                                        pushNodeCorners(node, pos, childPoints);
                                    }
                                }
                            });
                        }
                        // Add expanded hull points of child to parent
                        if (childPoints.length > 0) {
                            const childHull = this.getConvexHull(childPoints);
                            if (childHull.length > 0) {
                                const expandedChildHull = this.expandHullPoints(childHull, 30);
                                points.push(...expandedChildHull);
                            }
                        }
                    }
                });
            }
        };

        collectPoints(domain);
        return points;
    }

    /**
     * Expand hull points outward
     * @param {Array} hullPoints - Original hull points
     * @param {number} expansionDistance - Distance to expand (default: 30)
     * @returns {Array} Expanded hull points
     */
    static expandHullPoints(hullPoints, expansionDistance = 30) {
        const centroid = {x: 0, y: 0};
        hullPoints.forEach(p => {
            centroid.x += p.x;
            centroid.y += p.y;
        });
        centroid.x /= hullPoints.length;
        centroid.y /= hullPoints.length;
        
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
     * Calculate a deterministic hue based on domain title and id
     * Uses a simple string hash algorithm for consistency
     * @param {string} title - Domain title
     * @param {number} id - Domain id
     * @returns {number} Hue value (0-360)
     */
    static getDeterministicHue(title, id) {
        // Combine title and id for the hash input
        const str = (title || '') + id;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Map hash to 0-360 range, use absolute value to handle negative hashes
        return Math.abs(hash) % 360;
    }

    /**
     * Compute the visible representation of a regular node. If any ancestor
     * of the node's domain is collapsed, the node maps to the topmost
     * collapsed ancestor's vis.js id (`domain-{id}`). Otherwise the node
     * keeps its integer id.
     * @param {Object} node
     * @param {Array} allDomains
     * @param {Array} collapsedDomains
     * @returns {string|number}
     */
    static remapNodeId(node, allDomains, collapsedDomains) {       
        if (node.domainId == null) return node.id;
        const highest = GraphUtils.getHighestCollapsedAncestor(
            node.domainId, allDomains, collapsedDomains
        );
        
        if (highest != null) {
            return GraphUtils.getCollapsedDomainNodeId(highest);
        }
        return node.id;
    }

    /**
     * Compute the signature of a pathway given the current node, pathwayIndex,
     * and graph structure (nodes, domains, collapsed domains).
     * @param {Object} nodeData - { nodeId, pathwayIndex }
     * @param {Array} graphNodes
     * @param {Array} graphDomains
     * @param {Array|Set} collapsedDomainIds
     * @returns {string} signature
     */
    static getPathwaySignature(nodeData, graphNodes, graphDomains, collapsedDomainIds) {
        const { nodeId, pathwayIndex } = nodeData;
        const node = (graphNodes || []).find(n => n.id === nodeId || String(n.id) === String(nodeId));
        if (!node || !Array.isArray(node.pathways)) return '';
        
        const pathway = node.pathways[pathwayIndex];
        if (!Array.isArray(pathway)) return '';
        
        const targetVisId = GraphUtils.remapNodeId(
            {
                id: node.id,
                domainId: node.domainId == null ? null : node.domainId
            },
            graphDomains, collapsedDomainIds
        );
        
        const remappedSources = new Set();
        pathway.forEach(prereqId => {
            if (prereqId == null) return;
            const prereqNode = (graphNodes || []).find(n => n.id === prereqId || String(n.id) === String(prereqId));
            const visFrom = GraphUtils.remapNodeId(
                {
                    id: prereqId,
                    domainId: prereqNode ? prereqNode.domainId : null
                },
                graphDomains, collapsedDomainIds
            );
            if (visFrom === targetVisId) return; // would be a self-loop
            remappedSources.add(`${visFrom}->${targetVisId}`);
        });
        
        return Array.from(remappedSources).sort().join('|');
    }

    /**
     * Parse prerequisite expression and extract node IDs
     * @param {Object} node - Node with prerequisites
     * @returns {Set} Set of prerequisite node IDs
     */
    static getPrerequisiteSet(node) {
        if (!node || !node.prerequisites) return new Set();

        // Use ExpressionUtils if available
        if (window.ExpressionUtils) {
            try {
                const ids = window.ExpressionUtils.extractNodeIds(node.prerequisites);
                return new Set(ids);
            } catch (error) {
                console.warn('Error parsing prerequisites:', error);
            }
        }

        // Fallback: simple regex extraction
        const matches = node.prerequisites.match(/\b\d+\b/g);
        return new Set(matches ? matches.map(id => parseInt(id, 10)) : []);
    }

    /**
     * Calculate hierarchical levels for nodes based on prerequisites
     * @param {Array} nodes - Array of node objects
     * @returns {Object} Map of node ID to level
     */
    static calculateLevels(nodes) {
        const levels = {};
        const visited = new Set();

        const calculateLevel = (node) => {
            if (visited.has(node.id)) return levels[node.id] || 0;
            visited.add(node.id);

            const prereqIds = this.getPrerequisiteSet(node);
            if (prereqIds.size === 0) {
                levels[node.id] = 0;
                return 0;
            }

            let maxPrereqLevel = -1;
            prereqIds.forEach(prereqId => {
                const prereqNode = nodes.find(n => n.id === prereqId);
                if (prereqNode) {
                    const prereqLevel = calculateLevel(prereqNode);
                    maxPrereqLevel = Math.max(maxPrereqLevel, prereqLevel);
                }
            });

            levels[node.id] = maxPrereqLevel + 1;
            return levels[node.id];
        };

        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                calculateLevel(node);
            }
        });

        return levels;
    }

    /**
     * Generate default positions for nodes using simple layout
     * @param {Array} nodes - Array of node objects
     * @param {Object} options - Layout options
     * @returns {Map} Map of node ID to position object
     */
    static generateDefaultPositions(nodes, options = {}) {
        const positions = new Map();
        const {
            width = 800,
            height = 600,
            margin = 80,
            minNodeSpacing = 120,
            layout = 'hierarchical'
        } = options;

        if (layout === 'hierarchical') {
            // Return early if nodes is empty to prevent Math.max from receiving no levels
            if (!nodes || nodes.length === 0) {
                return positions;
            }

            // Prerequisite-aware hierarchical layout with domain clustering
            const sortedNodes = [...nodes].sort((a, b) => a.id - b.id);
            const levels = this.calculateLevels(sortedNodes);
            const maxLevel = Math.max(...Object.values(levels));
            const nodeMap = new Map(nodes.map(n => [n.id, n]));

            // Calculate canvas size with generous spacing
            const domainCount = new Set(nodes.map(n => n.domainId || 'none')).size;
            const nodesPerLevelEstimate = Math.ceil(nodes.length / (maxLevel + 1));
            const requiredWidth = Math.max(width, nodesPerLevelEstimate * minNodeSpacing * 2 + 2 * margin);
            const requiredHeight = Math.max(height, (maxLevel + 1) * minNodeSpacing * 2 + 2 * margin);

            // Assign random X positions to domain centers
            const domainCenters = new Map();
            const uniqueDomains = [...new Set(nodes.map(n => String(n.domainId || 'none')))];

            uniqueDomains.forEach(domainId => {
                const centerX = margin + Math.random() * (requiredWidth - 2 * margin);
                domainCenters.set(domainId, centerX);
            });

            // Group nodes by level for vertical positioning
            const levelGroups = {};
            sortedNodes.forEach(node => {
                const level = levels[node.id] ?? 0; // Default to level 0 if undefined
                if (!levelGroups[level]) levelGroups[level] = [];
                levelGroups[level].push(node);
            });

            // Position level by level (prerequisites above, dependents below)
            Object.keys(levelGroups).sort((a, b) => a - b).forEach(level => {
                const levelNum = parseInt(level);
                const levelNodes = levelGroups[level];

                // Calculate Y for this level with randomization
                const baseY = margin + (levelNum + 0.5) * (requiredHeight - 2 * margin) / (maxLevel + 1);
                const levelY = baseY + (Math.random() - 0.5) * (minNodeSpacing * 0.5);

                // Group level nodes by domain
                const domainGroups = {};
                levelNodes.forEach(node => {
                    const domainId = String(node.domainId || 'none');
                    if (!domainGroups[domainId]) domainGroups[domainId] = [];
                    domainGroups[domainId].push(node);
                });

                // Position nodes within each domain cluster
                Object.keys(domainGroups).forEach(domainId => {
                    const domainNodes = domainGroups[domainId];
                    const domainCenterX = domainCenters.get(domainId);

                    // Sort domain nodes by their prerequisite connections for logical ordering
                    domainNodes.sort((a, b) => {
                        const aPrereqs = this.getPrerequisiteSet(a);
                        const bPrereqs = this.getPrerequisiteSet(b);

                        // Count how many prerequisites each has in this domain
                        const aLocalPrereqs = domainNodes.filter(n => aPrereqs.has(n.id)).length;
                        const bLocalPrereqs = domainNodes.filter(n => bPrereqs.has(n.id)).length;

                        // Nodes with more local prerequisites come first (left side)
                        return bLocalPrereqs - aLocalPrereqs || Math.random() - 0.5;
                    });

                    // Spread nodes horizontally within domain with good spacing
                    const clusterWidth = domainNodes.length * minNodeSpacing * 1.5;
                    const startX = domainCenterX - clusterWidth / 2;

                    domainNodes.forEach((node, index) => {
                        // Base position with spacing
                        const baseX = startX + (index + 0.5) * (clusterWidth / domainNodes.length);

                        // Add random offset but maintain minimum spacing from neighbors
                        const randomOffset = (Math.random() - 0.5) * (minNodeSpacing * 0.6);
                        const x = baseX + randomOffset;

                        // Vary Y slightly per node for organic feel
                        const nodeY = levelY + (Math.random() - 0.5) * (minNodeSpacing * 0.4);

                        positions.set(node.id, { x, y: nodeY });
                    });
                });
            });
        } else {
            // Grid layout with minimum spacing
            const cols = Math.ceil(Math.sqrt(nodes.length));
            const rows = Math.ceil(nodes.length / cols);

            const availableWidth = width - 2 * margin;
            const availableHeight = height - 2 * margin;
            const cellWidth = Math.max(minNodeSpacing, availableWidth / cols);
            const cellHeight = Math.max(minNodeSpacing, availableHeight / rows);

            // Recalculate canvas size if needed
            const actualWidth = Math.max(width, cols * cellWidth + 2 * margin);
            const actualHeight = Math.max(height, rows * cellHeight + 2 * margin);

            nodes.forEach((node, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);

                const x = margin + col * cellWidth + cellWidth / 2;
                const y = margin + row * cellHeight + cellHeight / 2;

                positions.set(node.id, { x, y });
            });
        }

        return positions;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphUtils;
} else {
    window.GraphUtils = GraphUtils;
}
