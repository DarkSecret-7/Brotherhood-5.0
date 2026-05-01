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
 * Snapshots Transformer - Convert between backend and frontend snapshot data structures
 * Handles graph snapshots, nodes, domains, and related transformations
 */
class SnapshotsTransformer {
    
    /**
     * Transform backend snapshot data to frontend format
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
            domainCount: (backendSnapshot.domains || []).length,
            // UI state properties
            isLoading: false,
            isDirty: false,
            selectedNodes: new Set(),
            selectedDomains: new Set()
        };

        // Build graph data for visualization immediately
        frontendSnapshot.graphData = this.buildGraphData(
            backendSnapshot.nodes || [],
            backendSnapshot.domains || []
        );

        return frontendSnapshot;
    }

    /**
     * Transform frontend snapshot data to backend format for metadata-only updates
     * @param {Object} frontendSnapshot - Frontend snapshot object
     * @param {boolean} metadataOnly - Whether this is a metadata-only update
     * @returns {Object} Backend snapshot request data
     */
    transformSnapshotToBackend(frontendSnapshot, metadataOnly = false) {
        const backendSnapshot = {
            version_label: frontendSnapshot.versionLabel,
            is_public: frontendSnapshot.isPublic,
            metadata_only: metadataOnly
        };

        // Preserve original dates for imported graphs
        if (frontendSnapshot.createdAt) {
            backendSnapshot.created_at = frontendSnapshot.createdAt.toISOString();
        }
        if (frontendSnapshot.lastUpdated) {
            backendSnapshot.last_updated = frontendSnapshot.lastUpdated.toISOString();
        }

        // Only include nodes/domains for full updates
        if (!metadataOnly) {
            backendSnapshot.nodes = this.transformNodesToBackend(frontendSnapshot.nodes || []);
            backendSnapshot.domains = this.transformDomainsToBackend(frontendSnapshot.domains || []);

            // Optional fields
            if (frontendSnapshot.redirects && frontendSnapshot.redirects.length > 0) {
                backendSnapshot.redirects = this.transformRedirectsToBackend(frontendSnapshot.redirects);
            }
        }

        return backendSnapshot;
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
            prerequisites: this.transformPrerequisitesFromBackend(node.prerequisite),
            mentions: this.transformMentionsFromBackend(node.mentions) || [],
            sources: this.transformSourcesFromBackend(node.source_items || []),
            domainId: node.domain_id || null,
            position: {
                x: node.x ?? null,
                y: node.y ?? null
            },
            assessable: node.assessable || false,
            // UI state
            isSelected: false,
            isEditing: false,
            isValid: true,
            validationErrors: []
        }));
    }

    /**
     * Build graph data from backend nodes for visualization
     * Creates nodes with defaultPosition, position, and pathway attributes
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

    /**
     * Transform frontend nodes to backend format
     * @param {Array} frontendNodes - Frontend nodes array
     * @returns {Array} Backend nodes array
     */
    transformNodesToBackend(frontendNodes) {
        if (!Array.isArray(frontendNodes)) return [];

        return frontendNodes.map((node, index) => {
            const backendNode = {
                local_id: node.id,
                title: node.title,
                description: node.description,
                prerequisite: this.transformPrerequisitesToBackend(node.prerequisites),
                mentions: this.transformMentionsToBackend(node.mentions),
                source_items: this.transformSourcesToBackend(node.sources || []),
                domain_id: node.domainId,
                x: node.position?.x ?? null,
                y: node.position?.y ?? null,
                assessable: node.assessable,
                updated: node._isDirty || false,
                deleted: node._isDeleted || false
            };
            
            return backendNode;
        });
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
            assessableNodeCount: domain.assessable_node_count || 0,
            // UI state
            isSelected: false,
            isCollapsed: true,
            isEditing: false
        }));
    }

    /**
     * Save snapshot to backend - creates new or updates existing
     * This method orchestrates the full save operation: transformation + API call + response transformation
     * @param {Object} workspaceDraft - Raw workspace draft from state manager
     * @param {Object} options - Save options { currentSnapshotUuid, overwrite }
     * @returns {Object} Saved snapshot in frontend format
     */
    async saveSnapshot(workspaceDraft, options = {}) {
        // Get current user for author data
        const currentUserUuid = window.authApiService?.getCurrentUserUuid();
        if (!currentUserUuid) {
            throw new Error('User not authenticated');
        }

        // Build backend payload
        const metadataOnly = options.metadataOnly || false;
        const backendPayload = this.transformSnapshotToBackend(workspaceDraft, metadataOnly);
        backendPayload.version_label = workspaceDraft.versionLabel?.trim() || '';
        backendPayload.is_public = workspaceDraft.isPublic || false;
        
        // Add base_uuid if present
        if (workspaceDraft.baseUuid) {
            backendPayload.base_uuid = workspaceDraft.baseUuid;
        }
        
        // Add author data matching UserRead structure
        backendPayload.created_by = {
            user_uuid: currentUserUuid
        };

        // Determine create vs update
        const overwriteTargetUuid = options.currentSnapshotUuid || null;
        const shouldOverwrite = Boolean(options.overwrite && overwriteTargetUuid);

        let savedBackendSnapshot;
        if (shouldOverwrite) {
            // For updates, we need to include snapshot_uuid in domains
            if (backendPayload.domains) {
                backendPayload.domains = backendPayload.domains.map(domain => ({
                    ...domain,
                    snapshot_uuid: overwriteTargetUuid
                }));
            }
            savedBackendSnapshot = await window.snapshotsApiService.updateSnapshot(overwriteTargetUuid, backendPayload);
        } else {
            // For new snapshots, domains don't have snapshot_uuid yet (assigned by backend)
            backendPayload.is_public = false;
            savedBackendSnapshot = await window.snapshotsApiService.createSnapshot(backendPayload);
        }

        // Transform response back to frontend format
        return this.transformSnapshotFromBackend(savedBackendSnapshot);
    }

    /**
     * Import snapshot from file and transform response
     * @param {File} file - The .knw file to import
     * @param {boolean} overwrite - Whether to overwrite if exists
     * @returns {Object} Transformed snapshot in frontend format
     */
    async importSnapshot(file, overwrite = false) {
        const backendSnapshot = await window.snapshotsApiService.importSnapshot(file, overwrite);
        // Transform backend response to frontend format
        return this.transformSnapshotFromBackend(backendSnapshot);
    }

    /**
     * Transform frontend domains to backend format
     * @param {Array} frontendDomains - Frontend domains array
     * @param {string} snapshotUuid - Optional snapshot UUID to include in domains
     * @returns {Array} Backend domains array
     */
    transformDomainsToBackend(frontendDomains, snapshotUuid = null) {
        if (!Array.isArray(frontendDomains)) return [];

        return frontendDomains.map(domain => {
            const backendDomain = {
                local_id: domain.id,
                title: domain.title,
                description: domain.description,
                parent_id: domain.parentId,
                updated: domain._isDirty || false,
                deleted: domain._isDeleted || false
            };
            
            // Include snapshot_uuid if provided (required for updates)
            if (snapshotUuid) {
                backendDomain.snapshot_uuid = snapshotUuid;
            }
            
            return backendDomain;
        });
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
     * Transform frontend sources to backend format
     * @param {Array} frontendSources - Frontend sources array
     * @returns {Array} Backend sources array
     */
    transformSourcesToBackend(frontendSources) {
        if (!Array.isArray(frontendSources)) return [];

        return frontendSources.map(source => ({
            title: source.title || 'Untitled',
            bib_type: source.type || 'Other',
            author: source.author || null,
            year: source.year ? parseInt(source.year) : null,
            url: source.url || null,
            fragment_start: source.fragmentStart || null,
            fragment_end: source.fragmentEnd || null,
            bib_hash: source.hash || null,
            source_uuid: source.sourceUuid || null,
            updated: source._isDirty || false,
            deleted: source._isDeleted || false
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
     * Transform prerequisite expression to backend format
     * @param {String} frontendPrereq - Frontend prerequisite expression
     * @returns {Object|null} Backend prerequisite data as dict
     */
    transformPrerequisitesToBackend(frontendPrereq) {
        if (!frontendPrereq || frontendPrereq.trim() === '') return null;
        
        // Parse expression into tree structure using ExpressionUtils
        if (window.ExpressionUtils) {
            return window.ExpressionUtils.parsePrerequisiteToTree(frontendPrereq);
        }
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
     * Transform mentions from frontend array to backend JSONB format
     * @param {Array} frontendMentions - Frontend mentions array of node IDs
     * @returns {Object} Backend mentions dict (JSONB)
     */
    transformMentionsToBackend(frontendMentions) {
        if (!frontendMentions || !Array.isArray(frontendMentions) || frontendMentions.length === 0) {
            return {};
        }

        // Convert frontend array [3, 5] to backend dict {"3": true, "5": true}
        const backendMentions = {};
        frontendMentions.forEach(nodeId => {
            backendMentions[String(nodeId)] = true;
        });
        return backendMentions;
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
     * Transform redirects to backend format
     * @param {Array} frontendRedirects - Frontend redirects array
     * @returns {Array} Backend redirects array
     */
    transformRedirectsToBackend(frontendRedirects) {
        if (!Array.isArray(frontendRedirects)) return [];

        return frontendRedirects.map(redirect => ({
            snapshot_uuid: redirect.snapshotUuid,
            old_local_id: redirect.oldNodeId,
            new_local_id: redirect.newNodeId
        }));
    }

    /**
     * Transform snapshot list from backend to frontend format
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
     * Validate snapshot data
     * @param {Object} snapshotData - Snapshot data to validate
     * @returns {Object} Validation result
     */
    validateSnapshotData(snapshotData) {
        const errors = [];

        if (!snapshotData.versionLabel || snapshotData.versionLabel.trim().length === 0) {
            errors.push('Version label is required');
        }

        if (!snapshotData.nodes || snapshotData.nodes.length === 0) {
            errors.push('At least one node is required');
        } else {
            // Validate nodes
            snapshotData.nodes.forEach((node, index) => {
                if (!node.id || node.id <= 0) {
                    errors.push(`Node ${index + 1}: Valid ID is required`);
                }
                if (!node.title || node.title.trim().length === 0) {
                    errors.push(`Node ${index + 1}: Title is required`);
                }
            });
        }

        // Validate domains if present
        if (snapshotData.domains) {
            snapshotData.domains.forEach((domain, index) => {
                if (!domain.id || domain.id <= 0) {
                    errors.push(`Domain ${index + 1}: Valid ID is required`);
                }
                if (!domain.title || domain.title.trim().length === 0) {
                    errors.push(`Domain ${index + 1}: Title is required`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Export singleton instance
const snapshotsTransformer = new SnapshotsTransformer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SnapshotsTransformer, snapshotsTransformer };
} else {
    window.SnapshotsTransformer = SnapshotsTransformer;
    window.snapshotsTransformer = snapshotsTransformer;
}


