/**
 * Graph Utilities - Domain hull calculation and geometry helpers
 * Provides static methods for working with graph visualizations
 */

class GraphUtils {
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
     * @returns {Array} Array of points
     */
    static getDomainPoints(domain, positions, graphState) {
        const points = [];
        const baseMargin = 15;  // Base margin around the node
        const maxWidth = 150;   // Same as widthConstraint.maximum
        const charWidth = 7;    // Approximate width per character
        const lineHeight = 20;  // Height per line of text

        // Add points for nodes in this domain
        if (graphState && graphState.nodes) {
            graphState.nodes.forEach(node => {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphUtils;
} else {
    window.GraphUtils = GraphUtils;
}
