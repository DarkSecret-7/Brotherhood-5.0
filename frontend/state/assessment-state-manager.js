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
 * Assessment State Manager - Pure state storage for the assessment page
 * ONLY stores and manipulates state. NEVER renders.
 */
class AssessmentStateManager {
    constructor() {
        this.state = {
            // Assessment graph state
            currentGraph: null, // Full graph data from transformer
            
            // UI state
            viewMode: 'list', // 'list' | 'assessment'
            isLoading: false,
            error: null,
            
            // Selections
            selectedNode: null,
            showNodeDetails: false,
            selectedDomain: null,
            showDomainDetails: false,
            
            // Assessment state - current session (unsaved changes)
            proofInputs: {},
            // Saved assessment from backend
            savedProofInputs: {},
            currentCapability: null,
            assessmentInProgress: false,
            hasSavedAssessment: false,
            
            // Dialog state
            dialog: {
                isOpen: false,
                title: '',
                message: '',
                type: 'confirm', // 'confirm' | 'alert'
                confirmText: 'OK',
                cancelText: 'Cancel',
                resolve: null
            }
        };

        this.subscribers = [];
        
        // Add beforeunload event handler to ensure cache is saved
        this.setupCachePersistence();
    }

    /**
     * Setup cache persistence with beforeunload event
     */
    setupCachePersistence() {
        window.addEventListener('beforeunload', () => {
            if (this.state.currentGraph && this.state.currentGraph.currentSnapshotUuid) {
                this.saveAssessmentToCache(this.state.currentGraph.currentSnapshotUuid);
            }
        });
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - Callback function
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        // Initial notification
        callback(this.state);
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    /**
     * Notify all subscribers of state change
     */
    notify() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Error in AssessmentStateManager subscriber:', error);
            }
        });
    }

    /**
     * Update state and notify subscribers
     * @param {Object} newState - Partial state update
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    /**
     * Load transformed graph data
     * @param {Object} graphData - Transformed graph from galleryTransformer
     */
    loadGraph(graphData) {
        this.setState({
            currentGraph: graphData,
            selectedNode: null,
            showNodeDetails: false,
            selectedDomain: null,
            showDomainDetails: false,
            error: null
        });
    }

    /**
     * Load saved assessment from transformed capability object
     * @param {Object} capability - Transformed capability object with assessedNodes array
     */
    loadSavedAssessment(capability) {
        if (!capability || !capability.assessedNodes || capability.assessedNodes.length === 0) {
            this.setState({
                savedProofInputs: {},
                hasSavedAssessment: false,
                currentCapability: null
            });
            return;
        }

        const savedProofInputs = {};
        capability.assessedNodes.forEach(assessment => {
            // Use nodeId from transformed format, extract value from evaluation object
            const value = assessment.evaluation?.value !== undefined 
                ? assessment.evaluation.value 
                : assessment.score;
            if (value !== undefined && value !== null) {
                savedProofInputs[assessment.nodeId] = value;
            }
        });

        console.log(`AssessmentStateManager: Loaded saved assessment with ${Object.keys(savedProofInputs).length} nodes`);

        this.setState({
            savedProofInputs,
            hasSavedAssessment: true,
            currentCapability: capability
        });

        this.saveAssessmentToCache(this.state.currentGraph.currentSnapshotUuid);
    }

    /**
     * Check if a node has unsaved changes
     * @param {number} nodeId 
     * @returns {boolean}
     */
    hasUnsavedChanges(nodeId) {
        return nodeId in this.state.proofInputs;
    }

    /**
     * Check if any node has unsaved changes
     * @returns {boolean}
     */
    hasAnyUnsavedChanges() {
        return Object.keys(this.state.proofInputs).length > 0;
    }

    /**
     * Set the view mode
     * @param {string} mode - 'list' or 'assessment'
     */
    setViewMode(mode) {
        this.setState({ viewMode: mode });
    }

    /**
     * Set loading state
     * @param {boolean} isLoading 
     */
    setLoading(isLoading) {
        this.setState({ isLoading });
    }

    /**
     * Set error state
     * @param {string|null} error 
     */
    setError(error) {
        this.setState({ error });
    }

    /**
     * Updates a node position
     * @param {number} nodeId 
     * @param {Object} position 
     */
    updateNodePosition(nodeId, position) {
        const node = this.state.currentGraph.nodes.find(n => n.id === nodeId);
        if (node) {
            node.position = { x: position.x, y: position.y };
        }
    }

    /**
     * Select a node and show details
     * @param {number} nodeId 
     */
    selectNode(nodeId) {
        if (!this.state.currentGraph || !this.state.currentGraph.nodes) return;
        
        const node = this.state.currentGraph.nodes.find(n => n.id === nodeId);
        if (node) {
            this.setState({
                selectedNode: node,
                showNodeDetails: true,
                selectedDomain: null,
                showDomainDetails: false
            });
        }
    }

    /**
     * Close node details panel
     */
    closeNodeDetails() {
        this.setState({
            selectedNode: null,
            showNodeDetails: false
        });
    }

    /**
     * Select a domain and show details
     * @param {number} domainId 
     */
    selectDomain(domainId) {
        if (!this.state.currentGraph || !this.state.currentGraph.domains) return;
        
        const domain = this.state.currentGraph.domains.find(d => d.id === domainId);
        if (domain) {
            this.setState({
                selectedDomain: domain,
                showDomainDetails: true,
                selectedNode: null,
                showNodeDetails: false
            });
        }
    }

    /**
     * Close domain details panel
     */
    closeDomainDetails() {
        this.setState({
            selectedDomain: null,
            showDomainDetails: false
        });
    }

    /**
     * Update proof input for a node
     * @param {number} nodeId - The ID of the node
     * @param {number} status - 0 (Want to learn), 1 (Learning in progress), 2 (Learnt)
     */
    updateProofInput(nodeId, status) {
        const proofInputs = { ...this.state.proofInputs };
        proofInputs[nodeId] = status;
        
        console.log(`AssessmentStateManager: Updated node ${nodeId} status to ${status}`);
        
        this.setState({ proofInputs });

        // this.saveAssessmentToCache(this.state.currentGraph.currentSnapshotUuid);
    }

    /**
     * Clear proof input for a node
     * @param {number} nodeId - The ID of the node
     */
    clearProofInput(nodeId) {
        const proofInputs = { ...this.state.proofInputs };
        delete proofInputs[nodeId];
        
        console.log(`AssessmentStateManager: Cleared status for node ${nodeId}`);
        
        this.setState({ proofInputs });
    }

    /**
     * Show custom confirm dialog
     * @param {Object} options - { title, message, confirmText, cancelText }
     * @returns {Promise<boolean>} Resolves with true if confirmed, false if cancelled
     */
    showConfirm(options) {
        return new Promise((resolve) => {
            this.setState({
                dialog: {
                    isOpen: true,
                    title: options.title || 'Confirm',
                    message: options.message || '',
                    type: 'confirm',
                    confirmText: options.confirmText || 'OK',
                    cancelText: options.cancelText || 'Cancel',
                    resolve: resolve
                }
            });
        });
    }

    /**
     * Show custom alert dialog
     * @param {Object} options - { title, message, confirmText }
     * @returns {Promise<void>} Resolves when dismissed
     */
    showAlert(options) {
        return new Promise((resolve) => {
            this.setState({
                dialog: {
                    isOpen: true,
                    title: options.title || 'Alert',
                    message: options.message || '',
                    type: 'alert',
                    confirmText: options.confirmText || 'OK',
                    cancelText: '',
                    resolve: resolve
                }
            });
        });
    }

    /**
     * Close dialog with result
     * @param {boolean} result - User response
     */
    closeDialog(result) {
        const dialog = this.state.dialog;
        
        // Close the dialog
        this.setState({
            dialog: {
                ...this.state.dialog,
                isOpen: false
            }
        });
        
        // Resolve the promise
        if (dialog && dialog.resolve) {
            dialog.resolve(result);
        }
    }

    // ============== CACHE METHODS ==============

    /**
     * Generate cache key for assessment based on snapshot UUID
     * @param {string} snapshotUuid
     * @returns {string}
     */
    getAssessmentCacheKey(snapshotUuid) {
        return `assessment_cache_${snapshotUuid}`;
    }

    /**
     * Save assessment to cache (localStorage)
     * @param {string} snapshotUuid
     * @param {Object} capabilityData
     */
    saveAssessmentToCache(snapshotUuid) {
        try {
            const cacheKey = this.getAssessmentCacheKey(snapshotUuid);
            const cacheData = {
                snapshotUuid,
                capability: this.state.currentCapability,
                // Also save current session assessment
                currentProofInputs: this.state.proofInputs,
                timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
            console.warn('AssessmentStateManager: Failed to save to cache', e);
        }
    }

    /**
     * Load assessment from cache
     * @param {string} snapshotUuid
     * @returns {Object|null} Cached capability data or null
     */
    loadAssessmentFromCache(snapshotUuid) {
        try {
            const cacheKey = this.getAssessmentCacheKey(snapshotUuid);
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;

            const cacheData = JSON.parse(cached);
            // Verify the cached data is for the same snapshot
            if (cacheData.snapshotUuid !== snapshotUuid) return null;

            // Restore current session assessment if available
            if (cacheData.currentProofInputs) {
                this.state.proofInputs = cacheData.currentProofInputs;
            }

            return cacheData.capability;
        } catch (e) {
            console.warn('AssessmentStateManager: Failed to load from cache', e);
            return null;
        }
    }

    /**
     * Clear assessment from cache
     * @param {string} snapshotUuid
     */
    clearAssessmentCache(snapshotUuid) {
        try {
            const cacheKey = this.getAssessmentCacheKey(snapshotUuid);
            localStorage.removeItem(cacheKey);
        } catch (e) {
            console.warn('AssessmentStateManager: Failed to clear cache', e);
        }
    }

    /**
     * Clear all assessment caches
     */
    clearAllAssessmentCaches() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('assessment_cache_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('AssessmentStateManager: Failed to clear all caches', e);
        }
    }

    /**
     * Clear all graph related states
     */
    clearGraph () {
        // Clear state variables
        this.state.currentGraph = null;
        this.state.viewMode = 'list';
        this.state.isLoading = false;
        this.state.error = null;
            
        // Selections
        this.state.selectedNode = null;
        this.state.showNodeDetails = false;
        this.state.selectedDomain = null;
        this.state.showDomainDetails = false;
            
        // Assessment state
        this.state.proofInputs = {};
        // Saved assessment from backend
        this.state.savedProofInputs = {};
        this.state.currentCapability = null;
        this.state.assessmentInProgress = false;
        this.state.hasSavedAssessment = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AssessmentStateManager };
} else {
    window.AssessmentStateManager = AssessmentStateManager;
}
