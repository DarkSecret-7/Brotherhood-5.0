/**
 * Gallery Transformer - Convert between backend and gallery frontend data structures
 * Handles transformations specific to the public gallery view
 */
class GalleryTransformer {
    
    /**
     * Transform backend public snapshot list to gallery format
     * @param {Array} backendSnapshots - Array of backend snapshot objects
     * @returns {Array} Gallery snapshot list format
     */
    transformPublicSnapshotList(backendSnapshots) {
        if (!Array.isArray(backendSnapshots)) return [];
        
        return backendSnapshots.map(snapshot => this.transformPublicSnapshotListItem(snapshot));
    }

    /**
     * Transform single backend snapshot to gallery list item format
     * @param {Object} backendSnapshot - Backend snapshot object
     * @returns {Object} Gallery list item format
     */
    transformPublicSnapshotListItem(backendSnapshot) {
        return {
            versionLabel: backendSnapshot.version_label || `v${backendSnapshot.label}`,
            publicUuid: backendSnapshot.public_uuid,
            baseGraphLabel: backendSnapshot.base_graph_label,
            nodeCount: backendSnapshot.node_count || 0,
            assessableNodeCount: backendSnapshot.assessable_node_count || 0,
            createdAt: backendSnapshot.created_at ? new Date(backendSnapshot.created_at) : null,
            lastUpdated: backendSnapshot.last_updated ? new Date(backendSnapshot.last_updated) : null,
            createdBy: this.getCreatedByFromAuthors(backendSnapshot.authors),
            authors: backendSnapshot.authors || [],
            isPublic: backendSnapshot.is_public || false
        };
    }

    /**
     * Get created_by from authors array
     * @param {Array} authors - Array of author objects
     * @returns {string} Created by name
     */
    getCreatedByFromAuthors(authors) {
        if (!authors || !Array.isArray(authors) || authors.length === 0) {
            return 'Unknown';
        }
        
        // Return the first author's username as the creator
        const firstAuthor = authors[0];
        return firstAuthor.username || 'Unknown';
    }

    /**
     * Transform backend snapshot data to gallery display format
     * @param {Object} backendSnapshot - Backend snapshot response
     * @returns {Object} Gallery display format
     */
    transformGallerySnapshot(backendSnapshot) {
        if (!backendSnapshot) return null;

        // Transform nodes and domains using existing logic
        const galleryNodes = this.transformNodesForGallery(backendSnapshot.nodes || []);
        const galleryDomains = this.transformDomainsForGallery(backendSnapshot.domains || []);
        return {
            // Metadata

            
            versionLabel: backendSnapshot.version_label || '',
            publicUuid: backendSnapshot.public_uuid,
            baseGraphLabel: backendSnapshot.base_graph_label,
            createdAt: backendSnapshot.created_at ? new Date(backendSnapshot.created_at) : null,
            lastUpdated: backendSnapshot.last_updated ? new Date(backendSnapshot.last_updated) : null,
            createdBy: this.getCreatedByFromAuthors(backendSnapshot.authors),
            authors: backendSnapshot.authors || [],
            nodeCount: backendSnapshot.node_count || 0,
            assessableNodeCount: backendSnapshot.assessable_node_count || 0,
            
            // Graph data
            nodes: galleryNodes,
            domains: galleryDomains,
            redirects: backendSnapshot.redirects || [],
            
            // UI state
            isLoading: false,
            selectedNodes: new Set(),
            selectedDomains: new Set()
        };
    }

    /**
     * Transform backend nodes to gallery format
     * @param {Array} backendNodes - Array of backend node objects
     * @returns {Array} Gallery node format
     */
    transformNodesForGallery(backendNodes) {
        if (!Array.isArray(backendNodes)) return [];
        
        return backendNodes.map(node => ({
            local_id: node.local_id,
            title: node.title || '',
            description: node.description || '',
            prerequisite: node.prerequisite || null,
            source_items: node.source_items || [],
            domain_id: node.domain_id || null,
            x: node.x || 0,
            y: node.y || 0,
            saved_x: node.x || 0,
            saved_y: node.y || 0,
            // Gallery-specific properties
            isSelectable: true,
            isEditable: false // Read-only in gallery
        }));
    }

    /**
     * Transform backend domains to gallery format
     * @param {Array} backendDomains - Array of backend domain objects
     * @returns {Array} Gallery domain format
     */
    transformDomainsForGallery(backendDomains) {
        if (!Array.isArray(backendDomains)) return [];
        
        // Create ID mapping for parent relationships
        const domainDbToLocal = {};
        backendDomains.forEach(d => {
            domainDbToLocal[d.id] = d.local_id;
        });
        
        return backendDomains.map(domain => ({
            local_id: domain.local_id,
            title: domain.title || '',
            description: domain.description || '',
            // Gallery forces expand to show content
            collapsed: false,
            // Map parent_id to local_id format
            parent_id: domain.parent_id ? domainDbToLocal[domain.parent_id] : null,
            // Gallery-specific properties
            isSelectable: true,
            isEditable: false // Read-only in gallery
        }));
    }

    /**
     * Transform node data for details panel display
     * @param {Object} node - Node data from state
     * @returns {Object} Details panel format
     */
    transformNodeForDetails(node) {
        return {
            id: node.local_id,
            title: node.title || '',
            description: node.description || '',
            meta: `ID: ${node.local_id}`,
            sources: node.source_items || [],
            isEditable: false
        };
    }

    /**
     * Transform domain data for details panel display
     * @param {Object} domain - Domain data from state
     * @returns {Object} Details panel format
     */
    transformDomainForDetails(domain) {
        return {
            id: domain.local_id,
            title: domain.title || 'Untitled Domain',
            description: domain.description || '',
            meta: `Domain • Level ${domain.level || '?'}`,
            isCollapsed: domain.collapsed || false,
            isEditable: false
        };
    }

    /**
     * Transform gallery snapshot to visualization format
     * @param {Object} gallerySnapshot - Gallery snapshot data
     * @returns {Object} Visualization format compatible with existing renderer
     */
    transformForVisualization(gallerySnapshot) {
        if (!gallerySnapshot) return null;

        // Map to the format expected by the existing visualization.js
        return {
            nodes: gallerySnapshot.nodes,
            domains: gallerySnapshot.domains
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
