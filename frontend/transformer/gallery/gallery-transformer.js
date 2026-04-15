/**
 * Gallery Transformer - Convert between backend and frontend gallery data structures
 * Handles public gallery snapshots and graph visualization data transformations
 */
class GalleryTransformer {
    
    /**
     * Transform backend public snapshot list to frontend format
     * @param {Array} backendList - Backend snapshot list
     * @returns {Array} Frontend snapshot list
     */
    transformSnapshotListFromBackend(backendList) {
        if (!Array.isArray(backendList)) return [];

        return backendList.map(snapshot => ({
            uuid: snapshot.public_uuid,
            versionLabel: snapshot.version_label || '',
            baseUuid: snapshot.base_uuid || null,
            baseGraphLabel: snapshot.base_graph_label || null,
            createdAt: snapshot.created_at ? new Date(snapshot.created_at) : null,
            lastUpdated: snapshot.last_updated ? new Date(snapshot.last_updated) : null,
            isPublic: snapshot.is_public || false,
            nodeCount: snapshot.node_count || 0,
            assessableNodeCount: snapshot.assessable_node_count || 0,
            authors: this.transformAuthorsFromBackend(snapshot.authors || [])
        }));
    }

    /**
     * Transform backend public snapshot to frontend format
     * @param {Object} backendSnapshot - Backend snapshot response
     * @returns {Object} Frontend snapshot object
     */
    transformSnapshotFromBackend(backendSnapshot) {
        if (!backendSnapshot) return null;

        const frontendSnapshot = {
            currentSnapshotUuid: backendSnapshot.public_uuid,
            currentVersionLabel: backendSnapshot.version_label || '',
            baseGraphUuid: backendSnapshot.base_uuid || null,
            baseGraphLabel: backendSnapshot.base_graph_label || null,
            createdAt: backendSnapshot.created_at ? new Date(backendSnapshot.created_at) : null,
            lastUpdated: backendSnapshot.last_updated ? new Date(backendSnapshot.last_updated) : null,
            isPublic: backendSnapshot.is_public || false,
            authors: this.transformAuthorsFromBackend(backendSnapshot.authors || []),
            nodes: this.transformNodesFromBackend(backendSnapshot.nodes || []),
            domains: this.transformDomainsFromBackend(backendSnapshot.domains || []),
            redirects: this.transformRedirectsFromBackend(backendSnapshot.redirects || []),
            // Computed properties
            nodeCount: backendSnapshot.node_count || 0,
            assessableNodeCount: backendSnapshot.assessable_node_count || 0,
            domainCount: (backendSnapshot.domains || []).length
        };

        // Build graph data for visualization immediately
        frontendSnapshot.graphData = this.buildGraphData(
            backendSnapshot.nodes || [],
            backendSnapshot.domains || []
        );

        return frontendSnapshot;
    }

    /**
     * Transform backend nodes to frontend format
     * @param {Array} backendNodes - Backend nodes array
     * @returns {Array} Frontend nodes array
     */
    transformNodesFromBackend(backendNodes) {
        if (!Array.isArray(backendNodes)) return [];

        return backendNodes.map(node => ({
            id: node.local_id,
            title: node.title,
            description: node.description || '',
            prerequisites: node.prerequisite, // Keep as tree structure for direct edge extraction
            prerequisitesString: this.transformPrerequisitesFromBackend(node.prerequisite), // Also keep string for display
            mentions: this.transformMentionsFromBackend(node.mentions) || [],
            sources: this.transformSourcesFromBackend(node.source_items || []),
            domainId: node.domain_id || null,
            position: {
                x: node.x ?? null,
                y: node.y ?? null
            },
            assessable: node.assessable || false
        }));
    }

    /**
     * Transform backend domains to frontend format
     * @param {Array} backendDomains - Backend domains array
     * @returns {Array} Frontend domains array
     */
    transformDomainsFromBackend(backendDomains) {
        if (!Array.isArray(backendDomains)) return [];

        return backendDomains.map(domain => ({
            id: domain.local_id,
            title: domain.title,
            description: domain.description || '',
            parentId: domain.parent_id || null,
            nodeCount: domain.node_count || 0,
            assessableNodeCount: domain.assessable_node_count || 0
        }));
    }

    /**
     * Transform backend sources to frontend format
     * @param {Array} backendSources - Backend sources array
     * @returns {Array} Frontend sources array
     */
    transformSourcesFromBackend(backendSources) {
        if (!Array.isArray(backendSources)) return [];

        return backendSources.map(source => ({
            title: source.title,
            type: source.bib_type || 'Other',
            author: source.author || '',
            year: source.year || null,
            url: source.url || '',
            fragmentStart: source.fragment_start || '',
            fragmentEnd: source.fragment_end || '',
            hash: source.bib_hash || null,
            sourceUuid: source.source_uuid || null
        }));
    }

    /**
     * Transform prerequisite expression from backend format
     * @param {Object|String} backendPrereq - Backend prerequisite data
     * @returns {String} Frontend prerequisite expression
     */
    transformPrerequisitesFromBackend(backendPrereq) {
        if (!backendPrereq) return '';
        if (typeof backendPrereq === 'string') return backendPrereq;
        if (typeof backendPrereq === 'object') {
            // Convert tree structure to string using ExpressionUtils
            if (window.ExpressionUtils) {
                return window.ExpressionUtils.treeToPrerequisiteString(backendPrereq);
            }
        }
        return '';
    }

    /**
     * Transform mentions from backend JSONB format to frontend array
     * @param {Object} backendMentions - Backend mentions dict (JSONB)
     * @returns {Array} Frontend mentions array of node IDs
     */
    transformMentionsFromBackend(backendMentions) {
        if (!backendMentions || typeof backendMentions !== 'object') return [];
        
        // Convert backend dict {"3": true, "5": true} to frontend array [3, 5]
        return Object.keys(backendMentions)
            .map(id => parseInt(id))
            .filter(id => !isNaN(id));
    }

    /**
     * Transform authors from backend format
     * @param {Array} backendAuthors - Backend authors array
     * @returns {Array} Frontend authors array
     */
    transformAuthorsFromBackend(backendAuthors) {
        if (!Array.isArray(backendAuthors)) return [];

        return backendAuthors.map(author => ({
            uuid: author.user_uuid,
            username: author.username
        }));
    }

    /**
     * Transform redirects from backend format
     * @param {Array} backendRedirects - Backend redirects array
     * @returns {Array} Frontend redirects array
     */
    transformRedirectsFromBackend(backendRedirects) {
        if (!Array.isArray(backendRedirects)) return [];

        return backendRedirects.map(redirect => ({
            snapshotUuid: redirect.snapshot_uuid,
            oldNodeId: redirect.old_local_id,
            newNodeId: redirect.new_local_id,
            oldNodeLabel: redirect.old_local_id_label,
            newNodeLabel: redirect.new_local_id_label,
            createdAt: redirect.created_at ? new Date(redirect.created_at) : null
        }));
    }

    /**
     * Build graph data from backend nodes for visualization
     * Creates nodes with defaultPosition, position, and pathways attributes
     * @param {Array} backendNodes - Backend nodes array
     * @param {Array} backendDomains - Backend domains array (for hull rendering)
     * @returns {Object} Graph data {nodes, edges, cycles, domains}
     */
    buildGraphData(backendNodes, backendDomains) {
        if (!Array.isArray(backendNodes)) {
            return { nodes: [], edges: [], cycles: [], domains: [] };
        }

        const nodes = [];
        const edges = [];
        const cycles = [];
        const nodePathways = new Map(); // nodeId -> array of edge IDs for each pathway

        // First pass: create graph nodes and collect prerequisite data
        backendNodes.forEach(node => {
            const graphNode = {
                id: node.local_id,
                title: node.title,
                domainId: node.domain_id || null,
                defaultPosition: { x: node.x ?? null, y: node.y ?? null },
                position: { x: node.x ?? null, y: node.y ?? null },
                pathways: [] // Will be populated with arrays of edge IDs (one array per pathway)
            };
            nodes.push(graphNode);
            nodePathways.set(node.local_id, []);
        });

        // Second pass: process prerequisites to create pathways and edges
        // Use tree structure directly from backend - no string conversion needed
        const allEdges = [];
        backendNodes.forEach(node => {
            if (node.prerequisite && window.ExpressionUtils) {
                // Extract DNF pathways directly from tree structure
                const dnfPathways = window.ExpressionUtils.extractPathwaysFromTree(node.prerequisite);
                const pathways = []; // Array of pathways, each containing edge IDs

                dnfPathways.forEach(pathway => {
                    const pathwayEdgeIds = [];
                    // Create edges for this pathway: each prereq -> dependent node
                    pathway.forEach(prereqId => {
                        const edgeId = `${prereqId}-${node.local_id}`;
                        allEdges.push({
                            id: edgeId,
                            from: prereqId,
                            to: node.local_id
                        });
                        pathwayEdgeIds.push(edgeId);
                    });
                    pathways.push(pathwayEdgeIds);
                });

                nodePathways.set(node.local_id, pathways);
            }
        });

        // Remove duplicate edges
        const edgeMap = new Map();
        allEdges.forEach(edge => {
            if (!edgeMap.has(edge.id)) {
                edgeMap.set(edge.id, edge);
            }
        });
        const uniqueEdges = Array.from(edgeMap.values());

        if (window.ExpressionUtils) {
            // Use nodes array (with .id) not backendNodes (with .local_id)
            const nodeCycles = window.ExpressionUtils.detectCycles(nodes, uniqueEdges);
            // Convert node cycles to edge references
            nodeCycles.forEach(nodeCycle => {
                const edgeCycle = [];
                for (let i = 0; i < nodeCycle.length - 1; i++) {
                    const edgeId = `${nodeCycle[i]}-${nodeCycle[i + 1]}`;
                    edgeCycle.push(edgeId);
                }
                // Close the cycle
                const lastEdgeId = `${nodeCycle[nodeCycle.length - 1]}-${nodeCycle[0]}`;
                edgeCycle.push(lastEdgeId);
                cycles.push(edgeCycle);
            });

            // Perform transitive reduction - use nodes array (with .id) not backendNodes (with .local_id)
            const reducedEdges = window.ExpressionUtils.transitiveReduction(nodes, uniqueEdges);
            edges.push(...reducedEdges);
        } else {
            edges.push(...uniqueEdges);
        }

        // Generate default positions for nodes without stored positions
        if (window.ExpressionUtils) {
            const algorithmicPositions = window.ExpressionUtils.generateDefaultPositions(backendNodes, {
                width: 800,
                height: 600,
                layout: 'hierarchical'
            });

            // Merge positions: stored positions take priority, then algorithmic
            nodes.forEach(node => {
                const hasStoredPosition = node.defaultPosition.x !== null && node.defaultPosition.y !== null;
                if (!hasStoredPosition) {
                    const algoPos = algorithmicPositions.get(node.id);
                    if (algoPos) {
                        node.defaultPosition = { x: algoPos.x, y: algoPos.y };
                        node.position = { x: algoPos.x, y: algoPos.y };
                    }
                }
                // Assign pathways (array of edge ID arrays)
                node.pathways = nodePathways.get(node.id) || [];
            });
        }

        // Create minimal domain data for hull rendering
        const domains = (backendDomains || []).map(domain => ({
            id: domain.local_id,
            title: domain.title,
            parentId: domain.parent_id || null
        }));

        return { nodes, edges, cycles, domains };
    }
}

// Export singleton instance
const galleryTransformer = new GalleryTransformer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GalleryTransformer, galleryTransformer };
} else {
    window.GalleryTransformer = GalleryTransformer;
    window.galleryTransformer = galleryTransformer;
}
