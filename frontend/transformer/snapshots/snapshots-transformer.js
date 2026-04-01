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

        // Transform nodes and domains separately
        const frontendNodes = this.transformNodesFromBackend(backendSnapshot.nodes || []);
        const frontendDomains = this.transformDomainsFromBackend(backendSnapshot.domains || []);

        const frontendSnapshot = {
            uuid: backendSnapshot.public_uuid,
            baseUuid: backendSnapshot.base_uuid || null,
            baseGraphLabel: backendSnapshot.base_graph_label || null,
            versionLabel: backendSnapshot.version_label || '',
            description: backendSnapshot.description || '',
            createdAt: backendSnapshot.created_at ? new Date(backendSnapshot.created_at) : null,
            lastUpdated: backendSnapshot.last_updated ? new Date(backendSnapshot.last_updated) : null,
            isPublic: backendSnapshot.is_public || false,
            authors: this.transformAuthorsFromBackend(backendSnapshot.authors || []),
            nodes: frontendNodes,
            domains: frontendDomains,
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

        // Only include nodes/domains for full updates
        if (!metadataOnly) {
            backendSnapshot.nodes = this.transformNodesToBackend(frontendSnapshot.nodes || []);
            backendSnapshot.domains = this.transformDomainsToBackend(frontendSnapshot.domains || []);
        }

        // Optional fields
        if (frontendSnapshot.redirects && frontendSnapshot.redirects.length > 0) {
            backendSnapshot.redirects = this.transformRedirectsToBackend(frontendSnapshot.redirects);
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
            mentions: node.mentions || {},
            sources: this.transformSourcesFromBackend(node.source_items || []),
            domainId: node.domain_id || null,
            position: {
                x: node.x || null,
                y: node.y || null
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
                mentions: node.mentions || {},
                source_items: this.transformSourcesToBackend(node.sources || []),
                domain_id: node.domainId,
                x: node.position?.x || null,
                y: node.position?.y || null,
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

        console.log('backendPayload', backendPayload);

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
            title: source.title,
            bib_type: source.type,
            author: source.author,
            year: source.year,
            url: source.url,
            fragment_start: source.fragmentStart,
            fragment_end: source.fragmentEnd,
            public_hash: source.hash || null,
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
            // Convert complex prerequisite object to string expression
            return this.prerequisiteObjectToString(backendPrereq);
        }
        return '';
    }

    /**
     * Transform prerequisite expression to backend format
     * @param {String} frontendPrereq - Frontend prerequisite expression
     * @returns {Object|String} Backend prerequisite data
     */
    transformPrerequisitesToBackend(frontendPrereq) {
        if (!frontendPrereq || frontendPrereq.trim() === '') return null;
        
        // Try to parse as expression, keep as string if simple
        try {
            // For now, return as string - backend can handle parsing
            return frontendPrereq.trim();
        } catch (error) {
            return frontendPrereq.trim();
        }
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
            username: author.username,
            displayName: author.username
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
     * Convert prerequisite object to string expression
     * @param {Object} prereqObj - Prerequisite object
     * @returns {String} String expression
     */
    prerequisiteObjectToString(prereqObj) {
        // Simple implementation - can be enhanced based on actual backend format
        if (prereqObj.expression) return prereqObj.expression;
        if (prereqObj.and && Array.isArray(prereqObj.and)) {
            return `(${prereqObj.and.join(' AND ')})`;
        }
        if (prereqObj.or && Array.isArray(prereqObj.or)) {
            return `(${prereqObj.or.join(' OR ')})`;
        }
        return JSON.stringify(prereqObj);
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


