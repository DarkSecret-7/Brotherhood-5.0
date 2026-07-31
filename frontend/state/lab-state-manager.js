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
 * Lab UI State Manager - State management for the lab/workspace page
 * Handles snapshot loading, workspace state, and UI interactions
 */
class LabStateManager {
    constructor() {
        this.state = {
            // Current workspace state - separate fields instead of monolithic objects
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

            // Selection state
            selectedNodes: new Set(),
            selectedDomains: new Set(),

            // UI state
            activeTab: 'workspace', // workspace, graph, save
            isLoading: false,
            isDirty: false,
            error: null,

            // Modal states
            modals: {
                editNode: false,
                createDomain: false,
                createNode: false,
                editDomain: false,
                source: false,
                llm: false,
                dialog: false,
                metadata: false
            },

            // Form states
            forms: {
                newNode: this.createEmptyNodeForm(),
                editNode: this.createEmptyNodeForm(),
                newDomain: this.createEmptyDomainForm(),
                editDomain: this.createEmptyDomainForm(),
                source: this.createEmptySourceForm(),
                llm: this.createEmptyLLMForm(),
            },

            dialog: {
                title: '',
                message: '',
                type: 'alert',
                confirmText: 'OK',
                cancelText: 'Cancel',
                defaultValue: '',
                callback: null,
                resolve: null
            },

            // Graph visualization state
            graphState: {
                nodes: [],
                cycles: [],
                domains: []
            },

            // Snapshot management
            overwriteMode: false
        };

        // Initialize subscribers array
        this.subscribers = [];

        // Initialize state from localStorage
        this.loadPersistedState();
        
        // Bind event listeners
        this.bindEventListeners();
        
        // Auto-save interval
        this.autoSaveInterval = null;
        this.startAutoSave();
        
        // Initialize tab display after DOM is ready
        setTimeout(() => this.updateTabDisplay(), 0);
    }

    /**
     * Load persisted state from localStorage
     */
    loadPersistedState() {
        try {
            const persistedNodes = localStorage.getItem('lab_nodes');
            const persistedDomains = localStorage.getItem('lab_domains');
            const currentSnapshotUuid = localStorage.getItem('lab_currentSnapshotUuid');
            const currentSnapshotLabel = localStorage.getItem('lab_currentSnapshotLabel');
            const baseGraphUuid = localStorage.getItem('lab_baseGraphUuid');
            const baseGraphLabel = localStorage.getItem('lab_baseGraphLabel');
            const isPublic = localStorage.getItem('lab_isPublic');
            const createdAt = localStorage.getItem('lab_createdAt');
            const lastUpdated = localStorage.getItem('lab_lastUpdated');
            const authors = localStorage.getItem('lab_authors');

            if (persistedNodes) {
                const nodesData = JSON.parse(persistedNodes);
                this.state.nodes = nodesData;
            }
            
            if (persistedDomains) {
                const domainsData = JSON.parse(persistedDomains);
                this.state.domains = domainsData;
            }

            if (currentSnapshotUuid && currentSnapshotLabel) {
                this.state.currentSnapshotUuid = currentSnapshotUuid;
                this.state.currentVersionLabel = currentSnapshotLabel;
            }
            
            if (baseGraphUuid && baseGraphLabel) {
                this.state.baseGraphUuid = baseGraphUuid;
                this.state.baseGraphLabel = baseGraphLabel;
            }
            
            if (isPublic) {
                this.state.isPublic = isPublic === 'true';
            }

            if (createdAt && createdAt !== JSON.stringify(null)) {
                this.state.createdAt = new Date(createdAt);
            } else {
                this.state.createdAt = null;
            }

            if (lastUpdated && lastUpdated !== JSON.stringify(null)) {
                this.state.lastUpdated = new Date(lastUpdated);
            } else {
                this.state.lastUpdated = null;
            }

            if (authors) {
                this.state.authors = JSON.parse(authors);
            }

            // Load graph state
            const graphNodes = localStorage.getItem('lab_graphNodes');
            const graphCycles = localStorage.getItem('lab_graphCycles');
            const graphDomains = localStorage.getItem('lab_graphDomains');

            if (graphNodes) {
                this.state.graphState.nodes = JSON.parse(graphNodes);
            }

            if (graphCycles) {
                this.state.graphState.cycles = JSON.parse(graphCycles);
            }

            if (graphDomains) {
                this.state.graphState.domains = JSON.parse(graphDomains);
            }
            
        } catch (error) {
            console.warn('Failed to load persisted state:', error);
        }
    }

    /**
     * Persist state to localStorage
     */
    persistState() {
        try {
            localStorage.setItem('lab_nodes', JSON.stringify(this.state.nodes));
            localStorage.setItem('lab_domains', JSON.stringify(this.state.domains));
            localStorage.setItem('lab_redirects', JSON.stringify(this.state.redirects));
            localStorage.setItem('lab_currentSnapshotLabel', this.state.currentVersionLabel);
            localStorage.setItem('lab_currentSnapshotUuid', this.state.currentSnapshotUuid || '');
            localStorage.setItem('lab_baseGraphLabel', this.state.baseGraphLabel || '');
            localStorage.setItem('lab_baseGraphUuid', this.state.baseGraphUuid || '');
            localStorage.setItem('lab_isPublic', this.state.isPublic);
            localStorage.setItem('lab_createdAt', this.state.createdAt ? this.state.createdAt.toISOString() : JSON.stringify(null));
            localStorage.setItem('lab_lastUpdated', this.state.lastUpdated ? this.state.lastUpdated.toISOString() : JSON.stringify(null));
            localStorage.setItem('lab_authors', JSON.stringify(this.state.authors));

            const graphState = this.state.graphState;
            localStorage.setItem('lab_graphNodes', JSON.stringify(graphState.nodes));
            localStorage.setItem('lab_graphCycles', JSON.stringify(graphState.cycles));
            localStorage.setItem('lab_graphDomains', JSON.stringify(graphState.domains));
        } catch (error) {
            console.warn('Failed to persist state:', error);
        }
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Listen for page unload to save state
        window.addEventListener('beforeunload', () => {
            this.persistState();
        });

        // Listen for storage events (cross-tab sync)
        window.addEventListener('storage', (event) => {
            if (event.key === 'lab_nodes' || event.key === 'lab_domains') {
                this.loadPersistedState();
                this.notifyStateChange();
            }
        });
    }

    /**
     * Start auto-save interval
     */
    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            if (this.state.isDirty) {
                this.persistState();
                this.state.isDirty = false;
            }
        }, 60000); // Auto-save every 60 seconds
    }

    /**
     * Stop auto-save interval
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
       
    // Load initial data first
    async loadInitialData() {
        try {
            const pendingSnapshot = window.databaseStateManager
                ? window.databaseStateManager.consumePendingWorkspaceSnapshot()
                : null;

            console.log('Pending snapshot:', pendingSnapshot);
            
            if (pendingSnapshot && pendingSnapshot.currentSnapshotUuid) {
                this.loadSnapshot(pendingSnapshot);
            } else {
                // Keep persisted local draft if no staged backend snapshot is present
            }
            
        } catch (error) {
            console.error('Failed to initialize workspace:', error);
        }
    }

    /**
     * Load snapshot by UUID - receives already transformed data from transformer
     * @param {Object} frontendSnapshot - Frontend snapshot object from transformer
     */
    loadSnapshot(frontendSnapshot) {
        this.setLoading(true);
        this.setError(null);

        try {
            console.log('Loading snapshot:', frontendSnapshot);

            // Update state with transformed data (transformer already called this)
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

            // Use graph data from transformer (already built with nodes, cycles, domains)
            if (frontendSnapshot.graphData) {
                this.state.graphState.nodes = frontendSnapshot.graphData.nodes || [];
                this.state.graphState.cycles = frontendSnapshot.graphData.cycles || [];
                this.state.graphState.domains = frontendSnapshot.graphData.domains || [];
            }

            // Mark as clean
            this.state.isDirty = false;

            // Persist state
            this.persistState();

            // Notify listeners
            this.notifyStateChange();

            return frontendSnapshot;

        } catch (error) {
            this.setError(error);
            this.setLoading(false);
            throw error;
        } finally {
            this.setLoading(false);     
            console.log(this.state);   
        }
    }

    /**
     * Export current workspace draft for delegated persistence.
     * No API/transformer calls happen here; orchestration layer handles that.
     * @param {Object} saveOptions - Save options
     * @returns {Object} Raw draft payload for database management orchestration
     */
    exportWorkspace(saveOptions = {}) {
        const overwrite = saveOptions.overwrite || false;

        // Determine base_uuid and version_label based on overwrite logic (same as exportToFile)
        let currentSnapshotUuid = null;
        let exportBaseUuid = null;
        let exportVersionLabel = null;

        if (overwrite) {
            // Overwrite: keep current base graph as base
            currentSnapshotUuid = this.state.currentSnapshotUuid || null;
            exportBaseUuid = this.state.baseGraphUuid || null;
            exportVersionLabel = this.state.currentVersionLabel || 'Unnamed Workspace Graph';
        } else {
            // New version: current graph becomes base, no UUID
            exportBaseUuid = this.state.currentSnapshotUuid || null;
            exportVersionLabel = saveOptions.versionLabel || 'Unnamed Workspace Graph';
        }

        const workspaceDraft = {
            currentSnapshotUuid: currentSnapshotUuid,
            versionLabel: exportVersionLabel,
            nodes: this.state.nodes,
            domains: this.state.domains,
            baseUuid: exportBaseUuid,
            overwrite: overwrite,
            isPublic: this.state.isPublic,
            lastUpdated: new Date()
        };

        return workspaceDraft;
    }

    /**
     * Export current workspace to a v1.0 .knw file (binary, zstd-compressed).
     * @param {Object} exportOptions - Export options (versionLabel, overwrite)
     * @returns {Promise<void>} - Triggers browser download once encoding completes
     */
    async exportToFile(exportOptions = {}) {
        const versionLabel = exportOptions.versionLabel || this.state.currentVersionLabel || 'workspace';
        const overwrite = exportOptions.overwrite || false;

        // Get current user info from auth service
        const currentUser = window.authApiService ? window.authApiService.getCurrentUserFromToken() : null;

        // Use transformer to convert to backend format for export
        let backendNodes = [];
        let backendDomains = [];

        if (window.snapshotsTransformer) {
            const frontendNodes = this.state.nodes.map(node => ({
                ...node,
                position: node.position || { x: null, y: null }
            }));
            const frontendDomains = this.state.domains;
            backendNodes = window.snapshotsTransformer.transformNodesToBackend(frontendNodes);
            backendDomains = window.snapshotsTransformer.transformDomainsToBackend(frontendDomains);
        }

        // Determine version label based on overwrite logic. Base graph
        // identity is taken directly from state below.
        let exportVersionLabel;
        if (overwrite) {
            // Overwrite: keep current base graph as base
            exportVersionLabel = versionLabel || this.state.currentVersionLabel;
        } else {
            // New version: fall back to a placeholder if nothing was provided
            exportVersionLabel = versionLabel || 'Unknown Workspace Graph';
        }

        const authors = currentUser ? [{
            user_uuid: currentUser.user_uuid,
            username: currentUser.username
        }] : [];

        // The graph block carries only the actual graph contents.
        const graphBlock = {
            nodes: backendNodes,
            domains: backendDomains,
            redirects: []
        };

        // The metadata block carries every snapshot-identifying field,
        // including authors (preserved for re-import).
        const metadata = {
            uuid: overwrite ? this.state.currentSnapshotUuid : null,
            version_label: this.state.currentVersionLabel || exportVersionLabel,
            base_uuid: this.state.baseGraphUuid || null,
            base_version_label: this.state.baseGraphLabel || null,
            author: currentUser?.username || 'unknown',
            authors: authors,
            license: { ...(window.KNWFormat?.DEFAULT_LICENSE || { name: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }) },
            created: this.state.createdAt?.toISOString() || new Date().toISOString(),
            last_updated: new Date().toISOString(),
        };

        if (!window.KNWFormat) {
            throw new Error('KNW format module not loaded (frontend/utils/knw-format.js)');
        }

        const blob = await window.KNWFormat.encodeKNW(metadata, graphBlock);

        const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportVersionLabel}.knw`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Import workspace from a v1.0 .knw file (binary, zstd-compressed).
     * Accepts either a File object or an ArrayBuffer/Uint8Array.
     * @param {File|Uint8Array|ArrayBuffer} source - File input or raw bytes
     * @returns {Promise<void>} - Replaces current workspace once decoded
     */
    async importFromFile(source) {
        if (!window.KNWFormat) {
            throw new Error('KNW format module not loaded (frontend/utils/knw-format.js)');
        }
        if (!window.snapshotsTransformer) {
            throw new Error('Snapshots transformer not available. Please ensure the transformer is loaded.');
        }

        let bytes;
        if (source instanceof Uint8Array) {
            bytes = source;
        } else if (source instanceof ArrayBuffer) {
            bytes = new Uint8Array(source);
        } else if (source && typeof source.arrayBuffer === 'function') {
            // File or Blob-like
            bytes = new Uint8Array(await source.arrayBuffer());
        } else {
            throw new Error('Unsupported import source: expected File, Blob, ArrayBuffer, or Uint8Array');
        }

        if (!window.KNWFormat.isKNWV10(bytes)) {
            throw new Error('Unsupported .knw file: only protocol v1.0 (binary) is accepted');
        }

        const payload = await window.KNWFormat.decodeKNW(bytes);
        const metadata = payload.metadata || {};
        const importData = payload.graph || {};
        importData._knw_metadata = metadata;

        // Clear workspace first
        this.clearWorkspace();

        // Use transformer to convert backend format to frontend format
        const backendFormat = {
            nodes: importData.nodes || [],
            domains: importData.domains || []
        };

        const frontendNodes = window.snapshotsTransformer.transformNodesFromBackend(backendFormat.nodes);
        const frontendDomains = window.snapshotsTransformer.transformDomainsFromBackend(backendFormat.domains);

        frontendNodes.forEach(node => { node._isDirty = true; });
        frontendDomains.forEach(domain => { domain._isDirty = true; });

        // Update state
        this.state.nodes = frontendNodes;
        this.state.domains = frontendDomains;
        this.state.redirects = importData.redirects || [];
        // All snapshot identity fields come strictly from the v1.0
        // metadata envelope (single source of truth).
        this.state.currentSnapshotUuid = metadata.uuid || null;
        this.state.currentVersionLabel = metadata.version_label || 'Imported Graph';
        this.state.baseGraphUuid = metadata.base_uuid || null;
        this.state.baseGraphLabel = metadata.base_version_label || null;
        this.state.createdAt = metadata.created ? new Date(metadata.created) : null;
        this.state.lastUpdated = metadata.last_updated ? new Date(metadata.last_updated) : null;
        this.state.authors = metadata.authors || [];
        this.state.isPublic = false;
        this.state.isDirty = true;

        // Build graph data using transformer
        const graphData = window.snapshotsTransformer.buildGraphData(
            backendFormat.nodes,
            backendFormat.domains
        );
        this.state.graphState.nodes = graphData.nodes || [];
        this.state.graphState.cycles = graphData.cycles || [];
        this.state.graphState.domains = graphData.domains || [];

        // Persist and notify
        this.persistState();
        this.notifyStateChange();
    }

    /**
     * Process and simplify prerequisite expressions
     * @param {string} prerequisites - Prerequisite expression
     * @param {number} nodeId - Current node ID for simplification context
     * @returns {string} Processed prerequisite expression
     */
    processPrerequisites(prerequisites, nodeId = null) {
        let processedPrerequisites = prerequisites || '';
        if (window.ExpressionUtils && processedPrerequisites.trim()) {
            try {
                // Validate with node existence check first
                const validation = window.ExpressionUtils.validatePrerequisitesWithNodeCheck(
                    processedPrerequisites, 
                    this.state.nodes
                );
                
                if (validation.isValid && !validation.hasNonExistentNodes) {
                    // Only simplify if expression is valid and all referenced nodes exist
                    const simplified = window.ExpressionUtils.simplifyPrerequisitesInBrowser(
                        processedPrerequisites,
                        nodeId,
                        this.state.nodes
                    );
                    
                    // Validate the simplified expression again
                    const simplifiedValidation = window.ExpressionUtils.parsePrerequisites(simplified);
                    if (simplifiedValidation.isValid) {
                        if (simplified !== processedPrerequisites) {
                            console.log(`Prerequisites simplified for node ${nodeId || 'new'}: "${processedPrerequisites}" -> "${simplified}"`);
                        }
                        processedPrerequisites = simplified;
                    } else {
                        console.warn(`Simplified expression is invalid, keeping original: "${processedPrerequisites}"`);
                    }
                } else {
                    // Don't simplify if there are non-existent nodes or syntax errors
                    if (validation.hasNonExistentNodes) {
                        console.warn(`Expression references non-existent nodes [${validation.missingNodes.join(', ')}], keeping original: "${processedPrerequisites}"`);
                    } else {
                        console.warn(`Invalid expression syntax, keeping original: "${processedPrerequisites}"`);
                    }
                }
            } catch (error) {
                console.error('Error processing prerequisites:', error);
            }
        }
        return processedPrerequisites;
    }

    /**
     * Add node to draft
     * @param {Object} nodeData - Node data
     */
    addNode(nodeData) {
        console.log('node: ', nodeData);
        
        // Check if node ID already exists
        const existingNode = this.state.nodes.find(node => node.id === nodeData.id);
        if (existingNode) {
            this.showAlert(`Node with ID ${nodeData.id} already exists`);
            throw new Error(`Node with ID ${nodeData.id} already exists`);
        }

        // Check if domain ID exists
        if (nodeData.domainId) {
            const domain = this.state.domains.find(d => d.id === nodeData.domainId);
            if (!domain) {
                this.showAlert(`Domain with ID ${nodeData.domainId} does not exist`);
                throw new Error(`Domain with ID ${nodeData.domainId} does not exist`);
            }
        }

        // Process prerequisites if utils are available
        let processedPrerequisites = this.processPrerequisites(nodeData.prerequisites, nodeData.id);
        this.updateMentions(nodeData.id, processedPrerequisites, null);
        nodeData.prerequisites = processedPrerequisites;

        const newNode = {
            ...nodeData,
            position: { x: null, y: null },
            isSelected: false,
            isEditing: false,
            isValid: true,
            validationErrors: [],
            _isDirty: true  // Mark as dirty for delta updates
        };
        
        // Mark all sources as dirty since this is a new node
        if (newNode.sources && newNode.sources.length > 0) {
            newNode.sources = newNode.sources.map(source => ({
                ...source,
                _isDirty: true
            }));
        }
        
        // Add node to flat structure
        this.state.nodes.push(newNode);

        // Recalculate graph state for node creation (null, newNode)
        this.recalculateNodeUpdate(null, newNode);

        this.state.isDirty = true;
        this.notifyStateChange();
    }

    /**
     * Update mentions on referenced nodes when a node's prerequisites change
     * @param {number} nodeId - The node whose prerequisites changed
     * @param {string} newPrereqs - New prerequisite expression
     * @param {string} oldPrereqs - Old prerequisite expression (to remove old mentions)
     */
    updateMentions(nodeId, newPrereqs, oldPrereqs=null) {
        if (oldPrereqs && oldPrereqs.trim() && oldPrereqs.trim() !== '') {
            // Remove this node from old referenced nodes' mentions
            const oldIds = window.ExpressionUtils.extractNodeIdsFromPrerequisites(oldPrereqs);
            oldIds.forEach(refId => {
                const refNode = this.state.nodes.find(n => n.id === refId);
                if (refNode && refNode.mentions) {
                    refNode.mentions.pop(nodeId);
                }
            });
        }
        
        // Add this node to new referenced nodes' mentions
        const newIds = window.ExpressionUtils.extractNodeIdsFromPrerequisites(newPrereqs);
        newIds.forEach(refId => {
            const refNode = this.state.nodes.find(n => n.id === refId);            
            if (refNode) {
                if (!refNode.mentions) {
                    refNode.mentions = [];
                }
                refNode.mentions.push(nodeId);
            }
        });
    }

    propagatePrerequisiteChange(nodeId, oldPrereq=null) {
        // Reprocess prerequisites for all nodes that reference this node
        const currentNode = this.state.nodes.find(node => node.id === nodeId);
   
        if (currentNode && currentNode.mentions && currentNode.mentions.length > 0) {
            console.log('Working on:', currentNode);
            console.log('Prerequsities given: ', oldPrereq);
            currentNode.mentions.forEach(refId => {
                const refNode = this.state.nodes.find(node => node.id === refId);
                if (refNode) {
                    let prereq = refNode.prerequisites || '';
                    if (oldPrereq) prereq = prereq + ' AND (' + oldPrereq + ')';
                    console.log('Prerequisite: ', prereq)
                    const updatedPrereq = this.processPrerequisites(prereq, refId);
                    
                    // Check if prerequisites actually changed, and then enable recursion
                    const prerequisitesChanged = updatedPrereq !== refNode.prerequisites;

                    if (prerequisitesChanged) {
                        // Capture old state before updating
                        const oldNode = { ...refNode };

                        // Update prerequisites and mark as dirty
                        Object.assign(refNode, { prerequisites: updatedPrereq, _isDirty: true });

                        // Recalculate graph state for this node's prerequisite change
                        this.recalculateNodeUpdate(oldNode, refNode);

                        // Continue propagation
                        this.propagatePrerequisiteChange(refId);
                    }
                }
            });
        }
    }

    /**
     * Update node in draft
     * @param {number} nodeId - Node ID
     * @param {Object} updates - Node updates
     */
    updateNode(nodeId, updates, shouldPrereqChange=false) {
        const nodeIndex = this.state.nodes.findIndex(node => node.id === nodeId);
        if (nodeIndex !== -1) {
            const existingNode = this.state.nodes[nodeIndex];
            const oldPrerequisites = existingNode.prerequisites;
            
            // Process prerequisites if they are being updated
            if (updates.prerequisites !== undefined) {
                updates.prerequisites = this.processPrerequisites(updates.prerequisites, nodeId);
            }
            
            Object.assign(existingNode, updates, { _isDirty: true });  // Mark as dirty
            this.state.isDirty = true;
            
            // If prerequisites changed, update mentions on referenced nodes
            const prerequisitesChanged = updates.prerequisites !== undefined && 
                                       updates.prerequisites !== oldPrerequisites;
            
            // Recalculate graph state for this node update
            const oldNode = { ...existingNode };
            const newNode = { ...existingNode, ...updates };
            this.recalculateNodeUpdate(oldNode, newNode);

            if (prerequisitesChanged) {
                this.updateMentions(nodeId, updates.prerequisites, oldPrerequisites);
                if (shouldPrereqChange) this.propagatePrerequisiteChange(nodeId, oldPrerequisites);
            }

            this.notifyStateChange();
        }
    }

    /**
     * Delete node from draft (mark for deletion)
     * @param {number} nodeId - Node ID
     */
    deleteNode(nodeId) {
        const nodeIndex = this.state.nodes.findIndex(node => node.id === nodeId);
        if (nodeIndex !== -1) {
            const oldNode = { ...this.state.nodes[nodeIndex] };

            // Mark for deletion instead of immediate removal
            this.state.nodes[nodeIndex]._isDeleted = true;
            this.state.nodes[nodeIndex]._isDirty = true;
            this.state.selectedNodes.delete(nodeId);
            this.state.isDirty = true;

            // Recalculate graph state (deletion: oldNode, null)
            this.recalculateNodeUpdate(oldNode, null);

            this.notifyStateChange();
        }
    }

    /**
     * Restore node from deletion
     * @param {number} nodeId - Node ID
     */
    restoreNode(nodeId) {
        const nodeIndex = this.state.nodes.findIndex(node => node.id === nodeId);
        if (nodeIndex !== -1) {
            const node = this.state.nodes[nodeIndex];

            // Clear deletion flag
            delete node._isDeleted;
            node._isDirty = true;
            this.state.isDirty = true;

            // Recalculate graph state (creation: null, newNode)
            this.recalculateNodeUpdate(null, node);

            this.notifyStateChange();
        }
    }

    /**
     * Restore domain from deletion
     * @param {number} domainId - Domain ID
     */
    restoreDomain(domainId) {
        const domainIndex = this.state.domains.findIndex(domain => domain.id === domainId);
        if (domainIndex !== -1) {
            const domain = this.state.domains[domainIndex];

            // Clear deletion flag
            delete domain._isDeleted;
            domain._isDirty = true;
            this.state.isDirty = true;

            // Recalculate domain in graphState (creation: null, newDomain)
            this.recalculateDomainUpdate(null, domain);

            // Also restore nodes that were in this domain
            this.state.nodes.forEach(node => {
                if (node.domainId === domainId && node._isDeleted) {
                    delete node._isDeleted;
                    node._isDirty = true;
                    // Recalculate node in graphState (creation: null, newNode)
                    this.recalculateNodeUpdate(null, node);
                }
            });

            this.notifyStateChange();
        }
    }

    /**
     * Add domain to draft
     * @param {Object} domainData - Domain data
     */
    addDomain(domainData) {
        // Check if domain ID already exists
        const existingDomain = this.state.domains.find(domain => domain.id === domainData.id);
        if (existingDomain) {
            this.showAlert(`Domain with ID ${domainData.id} already exists`);
            throw new Error(`Domain with ID ${domainData.id} already exists`);
        }

        // Check if parent domain exists
        if (domainData.parentId) {
            const parentDomain = this.state.domains.find(d => d.id === domainData.parentId);
            if (!parentDomain) {
                this.showAlert(`Parent domain with ID ${domainData.parentId} does not exist`);
                throw new Error(`Parent domain with ID ${domainData.parentId} does not exist`);
            }
        }
        
        // Create domain object
        const newDomain = {
            ...domainData,
            nodeCount: 0,
            assessableNodeCount: 0,
            isSelected: false,
            isCollapsed: true, // Start collapsed by default
            isEditing: false,
            _isDirty: true  // Mark as dirty for delta updates
        };

        // Add domain to flat structure
        this.state.domains.push(newDomain);

        // Recalculate graph state for domain creation (null, newDomain)
        this.recalculateDomainUpdate(null, newDomain);

        this.state.isDirty = true;
        this.notifyStateChange();
    }

    /**
     * Toggle domain collapse
     * @param {number} domainId - Domain ID
     */
    toggleDomainCollapse(domainId) {
        const domain = this.state.domains.find(d => d.id === domainId);
        const graphDomain = this.state.graphState.domains.find(d => d.id === domainId);
        if (!domain || !graphDomain) return;
        const next = !domain.isCollapsed;
        domain.isCollapsed = next;
        graphDomain.isCollapsed = next;
        this.notifyStateChange();
    }

    /**
     * Update domain in draft
     * @param {number} domainId - Domain ID
     * @param {Object} updates - Domain updates
     */
    updateDomain(domainId, updates) {
        const domainIndex = this.state.domains.findIndex(domain => domain.id === domainId);
        if (domainIndex !== -1) {
            const oldDomain = { ...this.state.domains[domainIndex] };
            Object.assign(this.state.domains[domainIndex], updates, { _isDirty: true });  // Mark as dirty
            this.state.isDirty = true;

            // Recalculate graph state for domain update
            const newDomain = { ...this.state.domains[domainIndex] };
            this.recalculateDomainUpdate(oldDomain, newDomain);

            this.notifyStateChange();
        }
    }

    /**
     * Delete domain from draft (mark for deletion)
     * @param {number} domainId - Domain ID
     */
    deleteDomain(domainId) {
        const domainIndex = this.state.domains.findIndex(domain => domain.id === domainId);
        if (domainIndex !== -1) {
            const oldDomain = { ...this.state.domains[domainIndex] };

            // Mark for deletion instead of immediate removal
            this.state.domains[domainIndex]._isDeleted = true;
            this.state.domains[domainIndex]._isDirty = true;
            this.state.selectedDomains.delete(domainId);

            // Mark nodes as deleted and recalculate their deletion
            this.state.nodes.forEach(node => {
                if (node.domainId === domainId) {
                    const oldNode = { ...node };
                    node._isDirty = true;
                    node._isDeleted = true;
                    // Recalculate node deletion
                    this.recalculateNodeUpdate(oldNode, null);
                }
            });

            // Recalculate domain deletion in graphState
            this.recalculateDomainUpdate(oldDomain, null);

            this.state.isDirty = true;
            this.notifyStateChange();
        }
    }

    /**
     * Toggle node selection
     * @param {number} nodeId - Node ID
     */
    toggleNodeSelection(nodeId) {
        if (this.state.selectedNodes.has(nodeId)) {
            this.state.selectedNodes.delete(nodeId);
        } else {
            this.state.selectedNodes.add(nodeId);
        }
        this.notifyStateChange();
    }

    /**
     * Toggle domain selection
     * @param {number} domainId - Domain ID
     */
    toggleDomainSelection(domainId) {
        if (this.state.selectedDomains.has(domainId)) {
            this.state.selectedDomains.delete(domainId);
        } else {
            this.state.selectedDomains.add(domainId);
        }
        this.notifyStateChange();
    }

    /**
     * Add source to a node
     * @param {number} nodeId - Node ID
     * @param {Object} sourceData - Source data
     */
    addSourceToNode(nodeId, sourceData) {
        const nodeIndex = this.state.nodes.findIndex(node => node.id === nodeId);
        if (nodeIndex !== -1) {
            const newSource = {
                ...sourceData,
                _isDirty: true  // Mark as dirty since it's new
            };
            
            if (!this.state.nodes[nodeIndex].sources) {
                this.state.nodes[nodeIndex].sources = [];
            }
            this.state.nodes[nodeIndex].sources.push(newSource);
            this.state.nodes[nodeIndex]._isDirty = true;  // Mark node as dirty too
            this.state.isDirty = true;
            this.notifyStateChange();
        }
    }

    /**
     * Update source in a node
     * @param {number} nodeId - Node ID
     * @param {number} sourceIndex - Source index in array
     * @param {Object} updates - Source updates
     */
    updateSourceInNode(nodeId, sourceIndex, updates) {
        const nodeIndex = this.state.nodes.findIndex(node => node.id === nodeId);
        if (nodeIndex !== -1 && this.state.nodes[nodeIndex].sources) {
            const source = this.state.nodes[nodeIndex].sources[sourceIndex];
            if (source) {
                Object.assign(source, updates, { _isDirty: true });  // Mark as dirty
                this.state.nodes[nodeIndex]._isDirty = true;  // Mark node as dirty too
                this.state.isDirty = true;
                this.notifyStateChange();
            }
        }
    }

    /**
     * Delete source from a node
     * @param {number} nodeId - Node ID
     * @param {number} sourceIndex - Source index in array
     */
    deleteSourceFromNode(nodeId, sourceIndex) {
        const nodeIndex = this.state.nodes.findIndex(node => node.id === nodeId);
        if (nodeIndex !== -1 && this.state.nodes[nodeIndex].sources) {
            // Mark source as deleted instead of immediate removal
            this.state.nodes[nodeIndex].sources[sourceIndex]._isDeleted = true;
            this.state.nodes[nodeIndex].sources[sourceIndex]._isDirty = true;
            this.state.nodes[nodeIndex]._isDirty = true;  // Mark node as dirty too
            this.state.isDirty = true;
            this.notifyStateChange();
        }
    }

    /**
     * Clear all dirty and deleted flags after successful save
     */
    clearDirtyFlags() {
        // Clear flags from nodes and their sources
        this.state.nodes.forEach(node => {
            delete node._isDirty;
            delete node._isDeleted;
            // Clear source-level flags
            if (node.sources) {
                node.sources.forEach(source => {
                    delete source._isDirty;
                    delete source._isDeleted;
                });
            }
        });
        
        // Clear flags from domains
        this.state.domains.forEach(domain => {
            delete domain._isDirty;
            delete domain._isDeleted;
        });
    }

    /**
     * Purge deleted items from arrays after successful save
     */
    purgeDeletedItems() {
        // Remove nodes marked for deletion
        this.state.nodes = this.state.nodes.filter(node => !node._isDeleted);
        
        // Remove domains marked for deletion
        this.state.domains = this.state.domains.filter(domain => !domain._isDeleted);
        
        // Remove sources marked for deletion from nodes
        this.state.nodes.forEach(node => {
            if (node.sources) {
                node.sources = node.sources.filter(source => !source._isDeleted);
            }
        });
    }

    /**
     * Clear all selections
     */
    clearSelections() {
        this.state.selectedNodes.clear();
        this.state.selectedDomains.clear();
        this.notifyStateChange();
    }

    /**
     * Get selected items (both nodes and domains)
     * @returns {Array} Array of selected items
     */
    getSelectedItems() {
        const selectedItems = [];
        
        // Add selected domains
        this.state.selectedDomains.forEach(domainId => {
            const domain = this.state.domains.find(d => d.id === domainId);
            if (domain) {
                selectedItems.push({ ...domain, type: 'domain' });
            }
        });
        
        // Add selected nodes
        this.state.selectedNodes.forEach(nodeId => {
            const node = this.state.nodes.find(n => n.id === nodeId);
            if (node) {
                selectedItems.push({ ...node, type: 'node' });
            }
        });
        
        return selectedItems;
    }

    /**
     * Check if domain is an ancestor of targetDomainId
     * @param {number} domainId - Domain ID
     * @param {number} targetDomainId - Target domain ID
     * @returns {boolean} True if domain is an ancestor of targetDomainId, False if not an ancestor, null if ancestry is broken or domainId is not found
     */
    checkAncestry(domainId, targetDomainId) {
        // Check if domainId is an ancestor of targetDomainId , move is invalid if it is
        let currentId = targetDomainId;
        while (currentId) {
            const domain = this.state.domains.find(d => d.id === currentId);
            if (!domain) throw new Error("Ancestry of target domain is broken");       // ancestry of targetDomainId is broken, block move
            
            if (domain.id === domainId) {
                return true;
            }
            
            currentId = domain.parentId;
        }
        
        return false;
    }

    /**
     * Check if move is valid
     * @param {Array} items - Array of items to move
     * @param {number} targetDomainId - Target domain ID
     * @returns {boolean} True if move is valid, False if invalid
     */
    checkMoveValidity(items, targetDomainId) {
        if (items.length === 0) return false;       // Do not allow moving no items

        if (!this.state.domains.find(d => d.id === targetDomainId)) return false;    // targetDomainId is not found, block move

        // ancestry check for all domains
        return !items.some(item => item.type === 'domain' ? this.checkAncestry(item.id, targetDomainId) : false);
    }

    /**
     * Move selected items to domain
     * @param {number} targetDomainId - Target domain ID
     */
    moveSelectedToDomain(targetDomainId) {
        const selectedItems = this.getSelectedItems();

        // Check validity of move
        if (!this.checkMoveValidity(selectedItems, targetDomainId)) {
            this.showAlert("Move is invalid");
            throw new Error("Move is invalid");
        }

        selectedItems.forEach(item => {
            if (item.type === 'node') {
                // Update node's domain
                const node = this.state.nodes.find(n => n.id === item.id);
                // Check if update is necessary
                if (node && node.domainId !== targetDomainId) {
                    const oldNode = { ...node };
                    node.domainId = targetDomainId;
                    node._isDirty = true;
                    // Recalculate node update with new domainId
                    this.recalculateNodeUpdate(oldNode, node);
                }
            } else if (item.type === 'domain') {
                // Update domain's parent
                const domain = this.state.domains.find(d => d.id === item.id);
                // Check if update is necessary
                if (domain && domain.parentId !== targetDomainId) {
                    const oldDomain = { ...domain };
                    domain.parentId = targetDomainId;
                    // Recalculate domain update with new parentId
                    this.recalculateDomainUpdate(oldDomain, domain);
                }
            }
        });

        // Clear selections after moving
        this.state.selectedNodes.clear();
        this.state.selectedDomains.clear();

        this.state.isDirty = true;
        this.notifyStateChange();
    }

    clearWorkspace() {
        console.log(this.state);
        
        this.state.nodes = [];
        this.state.domains = [];
        this.state.redirects = [];
        this.state.currentSnapshotUuid = null;
        this.state.currentVersionLabel = '';
        this.state.baseGraphUuid = null;
        this.state.baseGraphLabel = null;
        this.state.createdAt = null;
        this.state.lastUpdated = null;
        this.state.authors = [];
        this.state.isPublic = false;
        this.state.selectedNodes.clear();
        this.state.selectedDomains.clear();
        this.state.isDirty = false;

        // Clear graph state directly
        this.state.graphState.nodes = [];
        this.state.graphState.cycles = [];
        this.state.graphState.domains = [];

        this.persistState();
        this.notifyStateChange();
    }

    /**
     * Recalculate graph state for a node update (creation, edit, or
     * deletion). Pathways are stored as `[[prereqId, ...], ...]`
     * @param {Object|null} oldNode - Previous node state (null for creation)
     * @param {Object|null} newNode - New node state (null for deletion)
     */
    recalculateNodeUpdate(oldNode, newNode) {
        const nodeId = oldNode?.id || newNode?.id;
        if (!nodeId) return;

        // === 1. HANDLE NODE IN graphState.nodes ===
        if (oldNode && !newNode) {
            // DELETION: remove the node from graphState and scrub its
            // id out of every other node's pathway arrays.
            this.state.graphState.nodes = this.state.graphState.nodes.filter(n => n.id !== nodeId);
            this.state.graphState.nodes.forEach(node => {
                if (!node.pathways) return;
                node.pathways = node.pathways
                    .map(pathway => pathway.filter(prereqId => prereqId !== nodeId))
                    .filter(pathway => pathway.length > 0);
            });
        } else if (!oldNode && newNode) {
            // CREATION: add a new graph node. Pathways will be set
            // below if the new node carries prerequisites.
            this.state.graphState.nodes.push({
                id: newNode.id,
                title: newNode.title,
                domainId: newNode.domainId,
                defaultPosition: newNode.position ? { ...newNode.position } : { x: null, y: null },
                position: newNode.position ? { ...newNode.position } : { x: null, y: null },
                pathways: []
            });
        } else if (oldNode && newNode) {
            // UPDATE: modify existing node properties.
            const graphNode = this.state.graphState.nodes.find(n => n.id === nodeId);
            if (graphNode) {
                if (newNode.title !== undefined) graphNode.title = newNode.title;
                if (newNode.domainId !== undefined) graphNode.domainId = newNode.domainId;
                if (newNode.position) {
                    graphNode.position = { ...newNode.position };
                    graphNode.defaultPosition = { ...newNode.position };
                }
            }
        }

        // Build the new pathway list from the new node's prerequisites
        // (if any) and write it to both the workspace node and the
        // graphState node.
        if (newNode?.prerequisites && window.ExpressionUtils) {
            // `convertToDNF` accepts the raw prerequisite string; it
            // re-parses and returns [[prereqId, ...], ...] (DNF).
            const dnfPathways = window.ExpressionUtils.convertToDNF(newNode.prerequisites);
            // Each pathway is an array of prereq node ids. Drop
            // empty pathways and dedupe.
            const newPathways = [];
            const seen = new Set();
            dnfPathways.forEach(pathway => {
                if (!Array.isArray(pathway) || pathway.length === 0) return;
                const sig = pathway.slice().sort((a, b) => a - b).join(',');
                if (seen.has(sig)) return;
                seen.add(sig);
                newPathways.push(pathway.slice());
            });

            const graphNode = this.state.graphState.nodes.find(n => n.id === nodeId);
            if (graphNode) graphNode.pathways = newPathways;
            if (newNode) newNode.pathways = newPathways;
        } else if (newNode && !newNode.prerequisites) {
            // No prerequisites -> empty pathway list.
            const graphNode = this.state.graphState.nodes.find(n => n.id === nodeId);
            if (graphNode) graphNode.pathways = [];
        }

        // === 3. RECALCULATE CYCLES (minimally) ===
        // We hand the cycle detector a temporary edge list built from
        // the current pathways. We DO NOT keep this list around as
        // `graphState.edges`. Cycles are stored as node-id sequences.
        if (window.ExpressionUtils) {
            const minimalNodes = this.state.graphState.nodes.map(n => ({ id: n.id }));
            const tempEdges = [];
            this.state.graphState.nodes.forEach(node => {
                if (!node.pathways) return;
                node.pathways.forEach(pathway => {
                    pathway.forEach(prereqId => {
                        tempEdges.push({ from: prereqId, to: node.id });
                    });
                });
            });
            const nodeCycles = window.ExpressionUtils.detectCycles(minimalNodes, tempEdges);
            this.state.graphState.cycles = nodeCycles.map(nodeCycle => nodeCycle.slice());
        }
    }

    /**
     * Recalculate graph state for a domain update (creation, edit, or deletion)
     * @param {Object|null} oldDomain - Previous domain state (null for creation)
     * @param {Object|null} newDomain - New domain state (null for deletion)
     */
    recalculateDomainUpdate(oldDomain, newDomain) {
        const domainId = oldDomain?.id || newDomain?.id;
        if (!domainId) return;

        // === 1. HANDLE DOMAIN IN graphState.domains ===
        if (oldDomain && !newDomain) {
            // DELETION: Remove domain from graphState
            this.state.graphState.domains = this.state.graphState.domains.filter(d => d.id !== domainId);
        } else if (!oldDomain && newDomain) {
            // CREATION: add new domain. The visualizer reads
            // `isCollapsed` straight from this object, so we copy it
            // through (defaults to true on creation).
            this.state.graphState.domains.push({
                id: newDomain.id,
                title: newDomain.title,
                parentId: newDomain.parentId,
                isCollapsed: newDomain.isCollapsed
            });
        } else if (oldDomain && newDomain) {
            // UPDATE: Modify domain properties
            const graphDomain = this.state.graphState.domains.find(d => d.id === domainId);
            if (graphDomain) {
                if (newDomain.parentId !== undefined) graphDomain.parentId = newDomain.parentId;
                if (newDomain.title !== undefined) graphDomain.title = newDomain.title;
                if (newDomain.isCollapsed !== undefined) graphDomain.isCollapsed = newDomain.isCollapsed;
            }
        }

        // === 2. UPDATE NODE DOMAIN IDs (if domainId changed or nodes moved) ===
        if (newDomain) {
            // Find all nodes that should be in this domain
            // This handles both domain changes and node moves into this domain
            this.state.nodes.forEach(node => {
                if (node.domainId === domainId && !node._isDeleted) {
                    const graphNode = this.state.graphState.nodes.find(n => n.id === node.id);
                    if (graphNode && graphNode.domainId !== domainId) {
                        graphNode.domainId = domainId;
                    }
                }
            });
        }

        // === 3. HANDLE DOMAIN DELETION EFFECTS ON NODES ===
        if (oldDomain && !newDomain) {
            // Domain deleted - update nodes that were in this domain
            // Their domainId in workspace nodes is already marked for deletion
            // Just update graphState to reflect removal
            this.state.graphState.nodes.forEach(node => {
                if (node.domainId === domainId) {
                    node.domainId = null;
                }
            });
        }
    }

    /**
     * Set loading state
     * @param {boolean} loading - Loading state
     */
    setLoading(loading) {
        this.state.isLoading = loading;
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
     * Set active tab
     * @param {string} tab - Tab name
     */
    setActiveTab(tab) {
        this.state.activeTab = tab;
        this.updateTabDisplay();
        this.notifyStateChange();
    }

    /**
     * Update tab display using CSS classes
     */
    async updateTabDisplay() {
        const activeTab = this.state.activeTab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(button => {
            const tabName = button.id.replace('tab-', '');
            button.classList.toggle('active', tabName === activeTab);
        });

        // Update select element for mobile
        const tabSelect = document.getElementById('lab-tab-select');
        if (tabSelect) {
            tabSelect.value = activeTab;
        }

        // Update view sections using CSS
        document.querySelectorAll('.view-section').forEach(view => {
            const viewName = view.id.replace('view-', '');
            view.classList.toggle('active', viewName === activeTab);
        });
    }

    /**
     * Toggle modal state
     * @param {string} modalName - Modal name
     * @param {boolean} open - Open state (if null, toggles current state)
     */
    toggleModal(modalName, open = null) {
        if (open !== null) {
            this.state.modals[modalName] = open;
        } else {
            this.state.modals[modalName] = !this.state.modals[modalName];
        }
        this.notifyStateChange();
    }

    /**
     * Update form state
     * @param {string} formName - Form name
     * @param {Object} updates - Form updates
     */
    updateForm(formName, updates) {
        Object.assign(this.state.forms[formName], updates);
        this.notifyStateChange();
    }

    /**
     * Reset form to default
     * @param {string} formName - Form name
     */
    resetForm(formName) {
        switch (formName) {
            case 'newNode':
                const domainId = this.state.forms.newNode.domainId;
                this.state.forms.newNode = this.createEmptyNodeForm();
                this.state.forms.newNode.domainId = domainId;
                break;
            case 'editNode':
                this.state.forms.editNode = this.createEmptyNodeForm();
                break;
            case 'newDomain':
                const parentId = this.state.forms.newDomain.parentId;
                this.state.forms.newDomain = this.createEmptyDomainForm();
                this.state.forms.newDomain.parentId = parentId;
                break;
            case 'editDomain':
                this.state.forms.editDomain = this.createEmptyDomainForm();
                break;
            case 'source':
                this.state.forms.source = this.createEmptySourceForm();
                break;
            case 'llm':
                this.state.forms.llm = this.createEmptyLLMForm();
                break;
            case 'dialog':
                this.state.forms.dialog = this.createEmptyDialogForm();
                break;
        }
        this.notifyStateChange();
    }

    /**
     * Get common parent ID from selected items
     * @returns {number|boolean} Common parent ID or false if no common parent exists
     */
    getCommonParentFromSelection() {      
        // Get first selected item's parent
        let commonParent;
        if (this.state.selectedNodes.size > 0) {
            const node = this.state.nodes.find(n => n.id === this.state.selectedNodes.values().next().value);
            if (node) {
                commonParent = node.domainId;
            } else {
                this.showMessage('Node not found', 'error');
                return false;
            }
        } else if (this.state.selectedDomains.size > 0) {
            const domain = this.state.domains.find(d => d.id === this.state.selectedDomains.values().next().value);
            if (domain) {
                commonParent = domain.parentId;
            } else {
                this.showMessage('Domain not found', 'error');
                return false;
            }
        } else {
            return false;       // No items selected
        }
        
        // Check if all selected items have the same parent
        const nodesHaveSameParent = [...this.state.selectedNodes].every(nodeId => {
            const node = this.state.nodes.find(n => n.id === nodeId);
            return node ? node.domainId === commonParent : false;
        });
        
        const domainsHaveSameParent = [...this.state.selectedDomains].every(domainId => {
            const domain = this.state.domains.find(d => d.id === domainId);
            return domain ? domain.parentId === commonParent : false;
        });
        
        return nodesHaveSameParent && domainsHaveSameParent ? commonParent : false;
    }

    /**
     * Create empty node form
     */
    createEmptyNodeForm() {
        return {
            id: null,
            title: '',
            description: '',
            prerequisites: '',
            domainId: null,
            assessable: false,
            sources: []
        };
    }

    /**
     * Create empty domain form
     */
    createEmptyDomainForm() {
        return {
            id: null,
            title: '',
            description: '',
            parentId: null
        };
    }

    /**
     * Create empty source form
     */
    createEmptySourceForm() {
        return {
            title: '',
            type: 'Other',
            author: '',
            year: null,
            url: '',
            fragmentStart: '',
            fragmentEnd: ''
        };
    }

    createEmptyLLMForm() {
        return {
            query: ''
        };
    }

    createEmptyDialogForm() {
        return {
            title: '',
            message: '',
            type: 'alert',
            confirmText: 'OK',
            cancelText: 'Cancel',
            defaultValue: '',
            callback: null,
            resolve: null
        };
    }

    /**
     * Notify state change listeners
     */
    notifyStateChange() {
        // Use only the subscribers array pattern       
        if (this.subscribers && this.subscribers.length > 0) {
            this.subscribers.forEach(callback => {
                if (typeof callback === 'function') {
                    callback(this.state);
                }
            });
        }
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - State change callback
     */
    subscribe(callback) {
        if (!this.subscribers) {
            this.subscribers = [];
        }
        
        if (callback && typeof callback === 'function') {
            this.subscribers.push(callback);
        }
    }

    /**
     * Unsubscribe from state changes
     */
    unsubscribe() {
        this.subscribers = [];
    }

    /**
     * Show message
     */
    showMessage(message, type) {
        // This would be implemented based on the UI controller
        console.log(`[${type.toUpperCase()}]: ${message}`);
    }

    /**
     * Show custom dialog modal
     * @param {Object} options - Dialog options (title, message, type, confirmText, cancelText, defaultValue)
     * @returns {Promise} Resolves with user response
     */
    showDialog(options) {
        this.state.dialog = {
            title: options.title || 'Notification',
            message: options.message || '',
            type: options.type || 'alert',
            confirmText: options.confirmText || 'OK',
            cancelText: options.cancelText || 'Cancel',
            defaultValue: options.defaultValue || '',
            callback: options.callback || null,
            resolve: null
        };
        this.state.modals.dialog = true;
        this.notifyStateChange();
        
        return new Promise((resolve) => {
            this.state.dialog.resolve = resolve;
        });
    }

    /**
     * Close dialog and resolve promise
     * @param {boolean} result - User response
     */
    closeDialog(result) {
        const dialog = this.state.dialog;
        const type = dialog.type;
        
        this.state.modals.dialog = false;
        
        // Call callback if provided
        if (dialog.callback) {
            dialog.callback(result);
        }
        
        // Resolve promise if exists
        if (dialog.resolve) {
            if (type === 'prompt') {
                const inputValue = document.getElementById('dialog-input')?.value || '';
                dialog.resolve(result ? inputValue : null);
            } else {
                dialog.resolve(result);
            }
            dialog.resolve = null;
        }
        
        this.notifyStateChange();
    }

    /**
     * Show custom alert
     * @param {string} message - Alert message
     * @param {Function} callback - Optional callback
     */
    showAlert(message, callback = null) {
        return this.showDialog({ type: 'alert', title: 'Alert', message, callback });
    }

    /**
     * Show custom confirm dialog
     * @param {string} message - Confirm message
     * @param {Function} callback - Optional callback
     */
    showConfirm(message, callback = null) {
        return this.showDialog({ type: 'confirm', title: 'Confirm', message, callback });
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopAutoSave();
        this.persistState();
        this.unsubscribe();
    }
}

// Export singleton instance
const labStateManager = new LabStateManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LabStateManager, labStateManager };
} else {
    window.LabStateManager = LabStateManager;
    window.labStateManager = labStateManager;
}
