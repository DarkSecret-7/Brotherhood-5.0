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
 * Gallery State Manager - State management for the public gallery page
 * Handles snapshot loading, graph visualization state, and UI interactions (read-only)
 */
class GalleryStateManager {
    constructor() {
        this.state = {
            // Gallery list state
            snapshotList: [],
            currentSnapshot: null,
            
            // Current snapshot data
            nodes: [],
            domains: [],
            redirects: [],
            
            // Snapshot metadata
            currentSnapshotUuid: null,
            currentVersionLabel: '',
            baseGraphUuid: null,
            baseGraphLabel: null,
            createdAt: null,
            lastUpdated: null,
            isPublic: false,
            authors: [],
            
            // UI state
            isLoading: false,
            isLoadingList: false,
            error: null,
            
            // Node details panel state
            selectedNode: null,
            showNodeDetails: false,

            // Domain details panel state
            selectedDomain: null,
            showDomainDetails: false,

            // Graph visualization state (minimal structure)
            graphState: {
                nodes: [],  // {id, title, domainId, defaultPosition, position, pathways}
                edges: [],  // {id, from, to}
                cycles: [], // ["1-2", "2-3", "3-1"]
                domains: [] // {id, title, parentId}
            }
        };

        // Initialize subscribers array
        this.subscribers = [];
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - Callback function
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    /**
     * Notify all subscribers of state change
     */
    notifyStateChange() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Error in state change callback:', error);
            }
        });
    }

    /**
     * Set loading state
     * @param {boolean} isLoading - Loading state
     */
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.notifyStateChange();
    }

    /**
     * Set loading list state
     * @param {boolean} isLoadingList - Loading list state
     */
    setLoadingList(isLoadingList) {
        this.state.isLoadingList = isLoadingList;
        this.notifyStateChange();
    }

    /**
     * Set error state
     * @param {string|null} error - Error message
     */
    setError(error) {
        this.state.error = error;
        this.notifyStateChange();
    }

    /**
     * Load snapshot list from backend
     * @param {Array} frontendList - Frontend snapshot list from transformer
     */
    loadSnapshotList(frontendList) {
        this.state.snapshotList = frontendList || [];
        this.state.isLoadingList = false;
        this.notifyStateChange();
    }

    /**
     * Load snapshot by UUID - receives already transformed data from transformer
     * @param {Object} frontendSnapshot - Frontend snapshot object from transformer
     */
    loadSnapshot(frontendSnapshot) {
        this.setLoading(true);
        this.setError(null);

        // Clear UI
        this.state.selectedNode = null;
        this.state.selectedDomain = null;

        this.state.showNodeDetails = false;
        this.state.showDomainDetails = false;

        try {
            console.log('Loading gallery snapshot:', frontendSnapshot);

            // Update state with transformed data
            this.state.nodes = frontendSnapshot.nodes || [];
            this.state.domains = frontendSnapshot.domains || [];
            this.state.redirects = frontendSnapshot.redirects || [];
            this.state.currentSnapshotUuid = frontendSnapshot.currentSnapshotUuid || null;
            this.state.currentVersionLabel = frontendSnapshot.currentVersionLabel || '';
            this.state.baseGraphUuid = frontendSnapshot.baseGraphUuid || null;
            this.state.baseGraphLabel = frontendSnapshot.baseGraphLabel || null;
            this.state.createdAt = frontendSnapshot.createdAt || null;
            this.state.lastUpdated = frontendSnapshot.lastUpdated || null;
            this.state.isPublic = frontendSnapshot.isPublic || false;
            this.state.authors = frontendSnapshot.authors || [];

            // Use graph data from transformer (already built with nodes, edges, cycles, domains)
            if (frontendSnapshot.graphData) {
                this.state.graphState.nodes = frontendSnapshot.graphData.nodes || [];
                this.state.graphState.edges = frontendSnapshot.graphData.edges || [];
                this.state.graphState.cycles = frontendSnapshot.graphData.cycles || [];
                this.state.graphState.domains = frontendSnapshot.graphData.domains || [];
            }

            // Mark as clean
            this.state.isDirty = false;

            // Notify listeners
            this.notifyStateChange();

            return frontendSnapshot;

        } catch (error) {
            this.setError(error);
            this.setLoading(false);
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Select node and show details
     * @param {number} nodeId - Node ID
     */
    selectNode(nodeId) {
        const node = this.state.nodes.find(n => n.id === nodeId);
        if (node) {
            // Reset animation by briefly hiding then showing [NOT A VERY GOOD SOLUTION, TEMPORARY]
            const wasShowing = this.state.showNodeDetails;
            if (wasShowing && this.state.selectedNode?.id !== nodeId) {
                this.state.showNodeDetails = false;
                this.notifyStateChange();
                // Small delay to allow CSS transition to reset
                setTimeout(() => {
                    this.state.selectedNode = node;
                    this.state.showNodeDetails = true;
                    this.notifyStateChange();
                }, 2);
            } else {
                this.state.selectedNode = node;
                this.state.showNodeDetails = true;
                this.notifyStateChange();
            }
        }
    }

    /**
     * Close node details panel
     */
    closeNodeDetails() {
        this.state.selectedNode = null;
        this.state.showNodeDetails = false;
        this.notifyStateChange();
    }

    /**
     * Select domain and show details
     * @param {number} domainId - Domain ID
     */
    selectDomain(domainId) {
        console.log(domainId, typeof domainId);
        
        const domain = this.state.domains.find(d => d.id === domainId);
        
        if (domain) {
            console.log("Domain exists", domain);
            
            // Reset animation by briefly hiding then showing [NOT A VERY GOOD SOLUTION, TEMPORARY]
            const wasShowing = this.state.showDomainDetails;
            if (wasShowing && this.state.selectedDomain?.id !== domainId) {
                this.state.showDomainDetails = false;
                this.notifyStateChange();
                // Small delay to allow CSS transition to reset
                setTimeout(() => {
                    this.state.selectedDomain = domain;
                    this.state.showDomainDetails = true;
                    this.notifyStateChange();
                }, 2);
            } else {
                this.state.selectedDomain = domain;
                this.state.showDomainDetails = true;
                this.notifyStateChange();
            }
        }
    }

    /**
     * Close domain details panel
     */
    closeDomainDetails() {
        this.state.selectedDomain = null;
        this.state.showDomainDetails = false;
        this.notifyStateChange();
    }

    /**
     * Get nodes in domain
     * @param {number} domainId - Domain ID
     * @returns {Array} Nodes in domain
     */
    getNodesInDomain(domainId) {
        return this.state.nodes.filter(n => n.domainId === domainId);
    }

    /**
     * Get child domains (nested domains) of a domain
     * @param {number} domainId - Domain ID
     * @returns {Array} Child domains
     */
    getChildDomains(domainId) {
        return this.state.domains.filter(d => d.parentId === domainId);
    }

    /**
     * Get current graph state for visualization
     * @returns {Object} Graph state
     */
    getGraphState() {
        return this.state.graphState;
    }

    /**
     * Update graph position (for drag operations)
     * @param {number} nodeId - Node ID
     * @param {Object} position - Position {x, y}
     */
    updateGraphPosition(nodeId, position) {
        const node = this.state.graphState.nodes.find(n => n.id === nodeId);
        if (node) {
            node.position = { x: position.x, y: position.y };
        }
    }

    /**
     * Clear current snapshot
     */
    clearSnapshot() {
        this.state.currentSnapshot = null;
        this.state.nodes = [];
        this.state.domains = [];
        this.state.redirects = [];
        this.state.currentSnapshotUuid = null;
        this.state.currentVersionLabel = '';
        this.state.baseGraphUuid = null;
        this.state.baseGraphLabel = null;
        this.state.createdAt = null;
        this.state.lastUpdated = null;
        this.state.isPublic = false;
        this.state.authors = [];
        this.state.selectedNode = null;
        this.state.showNodeDetails = false;
        
        // Clear domain selection
        this.state.selectedDomain = null;
        this.state.showDomainDetails = false;

        // Clear graph state (minimal structure)
        this.state.graphState = {
            nodes: [],
            edges: [],
            cycles: [],
            domains: []
        };
        
        this.notifyStateChange();
    }

    /**
     * Show message (for user feedback)
     * @param {string} message - Message to show
     * @param {string} type - Message type (success, error, info)
     */
    showMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Could be extended to show toast notifications
    }
}

// Export singleton instance
const galleryStateManager = new GalleryStateManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GalleryStateManager, galleryStateManager };
} else {
    window.GalleryStateManager = GalleryStateManager;
    window.galleryStateManager = galleryStateManager;
}
