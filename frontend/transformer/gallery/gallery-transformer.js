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
     * Transform frontend snapshot data to graph visualization format
     * @param {Object} frontendSnapshot - Frontend snapshot object
     * @returns {Object} Graph visualization data
     */
    transformToGraphVisualization(frontendSnapshot) {
        const nodes = frontendSnapshot.nodes || [];
        const domains = frontendSnapshot.domains || [];

        // Build graph nodes for visualization
        const graphNodes = nodes.map(node => ({
            id: node.id,
            title: node.title,
            domainId: node.domainId
        }));

        // Build graph edges from prerequisites (using tree structure directly)
        const graphEdges = [];
        nodes.forEach(node => {
            if (node.prerequisites) {
                // Extract node IDs directly from tree structure using ExpressionUtils
                const nodeIds = window.ExpressionUtils ? 
                    window.ExpressionUtils.extractNodeIdsFromTree(node.prerequisites) : [];
                
                // Add edges for each prerequisite
                nodeIds.forEach(prereqId => {
                    // Only add edge if the prerequisite node exists in the graph
                    const prereqNode = nodes.find(n => n.id === prereqId);
                    if (prereqNode) {
                        graphEdges.push({
                            from: prereqId,
                            to: node.id
                        });
                    }
                });
            }
        });

        // Build default positions map
        const defaultPositions = new Map();
        nodes.forEach(node => {
            if (node.position && node.position.x !== null && node.position.y !== null) {
                defaultPositions.set(node.id, {
                    x: node.position.x,
                    y: node.position.y
                });
            }
        });

        return {
            nodes: graphNodes,
            edges: graphEdges,
            domains: domains,
            defaultPositions: defaultPositions
        };
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
