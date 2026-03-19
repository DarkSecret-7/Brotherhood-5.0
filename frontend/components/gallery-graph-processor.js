/**
 * Gallery Graph Processor - Convert gallery data to visualization format
 * Processes nodes and domains from gallery format for GraphVisualizer
 */
class GalleryGraphProcessor {
    
    /**
     * Process gallery snapshot data for visualization
     * @param {Object} gallerySnapshot - Gallery snapshot data
     * @returns {Object} Processed graph state for visualization
     */
    processGallerySnapshot(gallerySnapshot) {
        if (!gallerySnapshot) {
            return {
                nodes: [],
                edges: [],
                pathways: [],
                domains: [],
                defaultPositions: new Map()
            };
        }

        const nodes = this.processNodes(gallerySnapshot.nodes);
        const edges = this.processEdges(gallerySnapshot.nodes);
        const domains = this.processDomains(gallerySnapshot.domains);
        const defaultPositions = this.createDefaultPositions(gallerySnapshot.nodes);

        return {
            nodes,
            edges,
            pathways: [], // Gallery doesn't have pathways
            domains,
            defaultPositions
        };
    }

    /**
     * Process nodes for visualization
     * @param {Array} galleryNodes - Gallery nodes
     * @returns {Array} Processed nodes
     */
    processNodes(galleryNodes) {
        if (!Array.isArray(galleryNodes)) return [];

        return galleryNodes.map(node => ({
            id: node.local_id,
            local_id: node.local_id,
            title: node.title || '',
            description: node.description || '',
            domain_id: node.domain_id,
            x: node.x || 0,
            y: node.y || 0,
            source_items: node.source_items || []
        }));
    }

    /**
     * Process edges from node prerequisites
     * @param {Array} galleryNodes - Gallery nodes
     * @returns {Array} Processed edges
     */
    processEdges(galleryNodes) {
        if (!Array.isArray(galleryNodes)) return [];

        const edges = [];
        
        galleryNodes.forEach(node => {
            if (node.prerequisite) {
                try {
                    // Parse prerequisite expression
                    const prerequisites = this.parsePrerequisiteExpression(node.prerequisite);
                    
                    prerequisites.forEach(prereqId => {
                        edges.push({
                            from: prereqId,
                            to: node.local_id,
                            arrows: 'to'
                        });
                    });
                } catch (error) {
                    console.warn(`Failed to parse prerequisite for node ${node.local_id}:`, error);
                }
            }
        });

        return edges;
    }

    /**
     * Parse prerequisite expression (simple version for gallery)
     * @param {string|Object} prerequisite - Prerequisite expression
     * @returns {Array} Array of prerequisite node IDs
     */
    parsePrerequisiteExpression(prerequisite) {
        if (typeof prerequisite === 'string') {
            // Simple comma-separated list
            return prerequisite.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else if (typeof prerequisite === 'object' && prerequisite !== null) {
            // Handle JSON expression (simplified)
            if (prerequisite.type === 'AND' && Array.isArray(prerequisite.children)) {
                return prerequisite.children
                    .map(child => this.parsePrerequisiteExpression(child))
                    .flat();
            } else if (prerequisite.type === 'OR' && Array.isArray(prerequisite.children)) {
                // For OR, just take the first option for visualization
                return this.parsePrerequisiteExpression(prerequisite.children[0]);
            } else if (prerequisite.type === 'LEAF') {
                return [parseInt(prerequisite.value)];
            }
        }
        
        return [];
    }

    /**
     * Process domains for visualization
     * @param {Array} galleryDomains - Gallery domains
     * @returns {Array} Processed domains
     */
    processDomains(galleryDomains) {
        if (!Array.isArray(galleryDomains)) return [];

        return galleryDomains.map(domain => ({
            id: domain.local_id,
            local_id: domain.local_id,
            title: domain.title || '',
            description: domain.description || '',
            parent_id: domain.parent_id,
            collapsed: domain.collapsed || false
        }));
    }

    /**
     * Create default positions map
     * @param {Array} galleryNodes - Gallery nodes
     * @returns {Map} Default positions map
     */
    createDefaultPositions(galleryNodes) {
        const positions = new Map();
        
        if (!Array.isArray(galleryNodes)) return positions;

        galleryNodes.forEach(node => {
            if (node.x !== undefined && node.y !== undefined) {
                positions.set(node.local_id, { x: node.x, y: node.y });
            } else {
                // Generate default position if not provided
                const angle = (node.local_id * 137.5) * Math.PI / 180; // Golden angle
                const radius = 100 + (node.local_id * 10);
                positions.set(node.local_id, {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius
                });
            }
        });

        return positions;
    }

    /**
     * Validate processed graph data
     * @param {Object} graphState - Processed graph state
     * @returns {boolean} Whether the data is valid
     */
    validateGraphState(graphState) {
        if (!graphState) return false;
        
        const hasNodes = Array.isArray(graphState.nodes) && graphState.nodes.length > 0;
        const hasEdges = Array.isArray(graphState.edges);
        const hasDomains = Array.isArray(graphState.domains);
        const hasPositions = graphState.defaultPositions instanceof Map;

        return hasNodes && hasEdges && hasDomains && hasPositions;
    }

    /**
     * Get graph statistics
     * @param {Object} graphState - Processed graph state
     * @returns {Object} Graph statistics
     */
    getGraphStatistics(graphState) {
        if (!this.validateGraphState(graphState)) {
            return {
                nodeCount: 0,
                edgeCount: 0,
                domainCount: 0,
                maxDepth: 0
            };
        }

        return {
            nodeCount: graphState.nodes.length,
            edgeCount: graphState.edges.length,
            domainCount: graphState.domains.length,
            maxDepth: this.calculateMaxDepth(graphState.domains)
        };
    }

    /**
     * Calculate maximum domain depth
     * @param {Array} domains - Domain array
     * @returns {number} Maximum depth
     */
    calculateMaxDepth(domains) {
        if (!Array.isArray(domains) || domains.length === 0) return 0;

        const domainMap = new Map();
        domains.forEach(domain => {
            domainMap.set(domain.local_id, domain);
        });

        let maxDepth = 0;

        const calculateDepth = (domainId, visited = new Set()) => {
            if (visited.has(domainId)) return 0; // Circular reference protection
            
            const domain = domainMap.get(domainId);
            if (!domain || !domain.parent_id) return 1;

            visited.add(domainId);
            const parentDepth = calculateDepth(domain.parent_id, visited);
            visited.delete(domainId);
            
            return parentDepth + 1;
        };

        domains.forEach(domain => {
            const depth = calculateDepth(domain.local_id);
            maxDepth = Math.max(maxDepth, depth);
        });

        return maxDepth;
    }
}

// Export singleton instance
const galleryGraphProcessor = new GalleryGraphProcessor();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GalleryGraphProcessor, galleryGraphProcessor };
} else {
    window.GalleryGraphProcessor = GalleryGraphProcessor;
    window.galleryGraphProcessor = galleryGraphProcessor;
}
