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
            prerequisiteString: this.transformPrerequisitesFromBackend(node.prerequisite), // Also keep string for display
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
            // Validate object shape before converting
            const isValidAst = (obj) => {
                if (!obj || typeof obj !== 'object') return false;
                // Check for valid AST shapes: {node}, {and}, or {or}
                const hasNode = 'node' in obj && typeof obj.node === 'number';
                const hasAnd = 'and' in obj && Array.isArray(obj.and);
                const hasOr = 'or' in obj && Array.isArray(obj.or);
                // Reject malformed shapes like {op, args}
                return (hasNode || hasAnd || hasOr) && !('op' in obj) && !('args' in obj);
            };

            if (!isValidAst(backendPrereq)) {
                console.warn('Invalid AST structure in prerequisite:', backendPrereq);
                return '';
            }

            // Convert tree structure to string using ASTUtils
            if (window.ASTUtils) {
                try {
                    return window.ASTUtils.astToExpr(backendPrereq);
                } catch (error) {
                    console.error('Error converting AST to expression:', error);
                    return '';
                }
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
     * Build graph data from backend nodes for visualization.
     *
     * IMPORTANT: this method does NOT build an `edges` array.
     * @param {Array} backendNodes - Backend nodes array
     * @param {Array} backendDomains - Backend domains array (for hull rendering)
     * @returns {Object} Graph data {nodes, cycles, domains}
     */
    buildGraphData(backendNodes, backendDomains) {
        if (!Array.isArray(backendNodes)) {
            return { nodes: [], cycles: [], domains: [] };
        }

        const nodes = [];
        const cycles = [];
        // nodeId -> array of prereq-id arrays (one inner array per pathway)
        const nodePathways = new Map();

        // First pass: create graph nodes with empty pathways. Pathways
        // are populated in the next pass once every node exists.
        backendNodes.forEach(node => {
            const graphNode = {
                id: node.local_id,
                title: node.title,
                domainId: node.domain_id || null,
                defaultPosition: { x: node.x ?? null, y: node.y ?? null },
                position: { x: node.x ?? null, y: node.y ?? null },
                pathways: []   // Array of prereq-id arrays (DNF)
            };
            nodes.push(graphNode);
            nodePathways.set(node.local_id, []);
        });

        // Second pass: extract DNF pathways from the backend tree and
        // store them as arrays of prereq node ids.
        backendNodes.forEach(node => {
            if (node.prerequisite && window.PrerequisiteUtils) {
                // Extract DNF pathways directly from tree structure
                const dnfPathways = window.PrerequisiteUtils.extractPathwaysFromAst(node.prerequisite);
                nodePathways.set(
                    node.local_id,
                    dnfPathways.map(p => Array.isArray(p) ? p.slice() : [])
                );
            }
        });

        // TODO: enable cycle detection if needed
        // Cycle detection. We hand the cycle detector a temporary edge
        // list built from the pathways; we DO NOT keep this list around
        // as `graphState.edges`. Cycles themselves are stored as node-id
        // sequences.
        /*if (window.ExpressionUtils) {
            const tempEdges = [];
            nodePathways.forEach((pathways, targetId) => {
                pathways.forEach(pathway => {
                    pathway.forEach(prereqId => {
                        tempEdges.push({ from: prereqId, to: targetId });
                    });
                });
            });
            const nodeCycles = window.ExpressionUtils.detectCycles(nodes, tempEdges);
            nodeCycles.forEach(nodeCycle => {
                cycles.push(nodeCycle.slice());
            });
        }*/

        // Generate default positions for nodes without stored positions
        if (window.GraphUtils) {
            // moved to GraphUtils
            const algorithmicPositions = window.GraphUtils.generateDefaultPositions(backendNodes, {
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
                // Assign pathways (array of prereq-id arrays)
                node.pathways = nodePathways.get(node.id) || [];
            });
        }

        // Create minimal domain data for hull rendering
        const domains = (backendDomains || []).map(domain => ({
            id: domain.local_id,
            title: domain.title,
            parentId: domain.parent_id || null
        }));

        return { nodes, cycles, domains };
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
