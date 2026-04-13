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
                editDomain: false,
                source: false,
                llm: false,
                dialog: false
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
                edges: [],
                pathways: [],
                defaultPositions: new Map(),
                currentPositionOverrides: new Map(),
                cycles: [],
                lastUpdated: null,
                network: null
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
            const graphEdges = localStorage.getItem('lab_graphEdges');
            const graphPathways = localStorage.getItem('lab_graphPathways');
            const graphDefaultPositions = localStorage.getItem('lab_graphDefaultPositions');
            const graphPositionOverrides = localStorage.getItem('lab_graphPositionOverrides');
            const graphLastUpdated = localStorage.getItem('lab_graphLastUpdated');
            
            if (graphNodes) {
                this.state.graphState.nodes = JSON.parse(graphNodes);
            }
            
            if (graphEdges) {
                this.state.graphState.edges = JSON.parse(graphEdges);
            }
            
            if (graphPathways) {
                this.state.graphState.pathways = JSON.parse(graphPathways);
            }
            
            if (graphDefaultPositions) {
                const positions = JSON.parse(graphDefaultPositions);
                this.state.graphState.defaultPositions = new Map(Object.entries(positions));
            }
            
            if (graphPositionOverrides) {
                const positions = JSON.parse(graphPositionOverrides);
                this.state.graphState.currentPositionOverrides = new Map(Object.entries(positions));
            }
                        
            if (graphLastUpdated) {
                this.state.graphState.lastUpdated = JSON.parse(graphLastUpdated);
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
            localStorage.setItem('lab_graphEdges', JSON.stringify(graphState.edges));
            localStorage.setItem('lab_graphPathways', JSON.stringify(graphState.pathways));
            localStorage.setItem('lab_graphDefaultPositions', JSON.stringify(Object.fromEntries(graphState.defaultPositions)));
            localStorage.setItem('lab_graphPositionOverrides', JSON.stringify(Object.fromEntries(graphState.currentPositionOverrides)));
            localStorage.setItem('lab_graphLastUpdated', JSON.stringify(graphState.lastUpdated));
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

            // Clear position overrides when loading a snapshot - use stored positions
            this.state.graphState.currentPositionOverrides = new Map();

            // Update graph visualization
            this.updateGraphVisualization();

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
     * Export current workspace to .knw file (client-side only)
     * @param {Object} exportOptions - Export options (versionLabel, overwrite)
     * @returns {void} - Triggers browser download
     */
    exportToFile(exportOptions = {}) {
        const versionLabel = exportOptions.versionLabel || this.state.currentVersionLabel || 'workspace';
        const overwrite = exportOptions.overwrite || false;

        // Get current user info from auth service
        const currentUser = window.authApiService ? window.authApiService.getCurrentUserFromToken() : null;

        // Use transformer to convert to backend format for export
        let backendNodes = [];
        let backendDomains = [];

        if (window.snapshotsTransformer) {
            // Use transformer for exact backend compatibility
            const frontendNodes = this.state.nodes.map(node => ({
                ...node,
                // Ensure position exists for transformation
                position: node.position || { x: null, y: null }
            }));
            const frontendDomains = this.state.domains;
            backendNodes = window.snapshotsTransformer.transformNodesToBackend(frontendNodes);
            backendDomains = window.snapshotsTransformer.transformDomainsToBackend(frontendDomains);
        }

        // Determine base_uuid and base_graph_label based on overwrite logic
        let exportBaseUuid = null;
        let exportBaseGraphLabel = null;
        let exportVersionLabel = versionLabel;

        if (overwrite) {
            // Overwrite: keep current base graph as base
            exportBaseUuid = this.state.baseGraphUuid || null;
            exportBaseGraphLabel = this.state.baseGraphLabel;
            exportVersionLabel = versionLabel || this.state.currentVersionLabel;
        } else {
            // New version: current graph becomes base
            exportBaseUuid = this.state.currentSnapshotUuid || null;
            exportBaseGraphLabel = this.state.currentVersionLabel;
            exportVersionLabel = versionLabel || 'Unknown Workspace Graph';
        }

        // Build export data in backend-compatible format
        const exportData = {
            public_uuid: overwrite ? this.state.currentSnapshotUuid : null,
            base_uuid: exportBaseUuid,
            version_label: exportVersionLabel,
            base_graph_label: exportBaseGraphLabel,
            created_at: this.state.createdAt?.toISOString() || new Date().toISOString(),
            last_updated: new Date().toISOString(),
            authors: currentUser ? [{
                user_uuid: currentUser.user_uuid,
                username: currentUser.username
            }] : [],
            nodes: backendNodes,
            domains: backendDomains,
            redirects: []
        };

        // Create JSON string
        const jsonString = JSON.stringify(exportData, null, 2);

        // Create blob and download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportVersionLabel}.knw`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Import workspace from .knw file (client-side only)
     * @param {Object} importData - Parsed import data
     * @returns {void} - Replaces current workspace
     */
    importFromFile(importData) {
        // Validate import data structure
        if (!importData || typeof importData !== 'object') {
            throw new Error('Invalid import data');
        }

        if (!window.snapshotsTransformer) {
            throw new Error('Snapshots transformer not available. Please ensure the transformer is loaded.');
        }

        // Clear workspace first
        this.clearWorkspace();

        // Use transformer to convert backend format to frontend format
        const backendFormat = {
            nodes: importData.nodes || [],
            domains: importData.domains || []
        };

        const frontendNodes = window.snapshotsTransformer.transformNodesFromBackend(backendFormat.nodes);
        const frontendDomains = window.snapshotsTransformer.transformDomainsFromBackend(backendFormat.domains);

        // Mark all imported items as dirty since they're new to the workspace
        frontendNodes.forEach(node => {
            node._isDirty = true;
        });
        frontendDomains.forEach(domain => {
            domain._isDirty = true;
        });

        // Update state
        this.state.nodes = frontendNodes;
        this.state.domains = frontendDomains;
        this.state.redirects = importData.redirects || [];
        this.state.currentSnapshotUuid = importData.public_uuid || null;
        this.state.currentVersionLabel = importData.version_label || 'Imported Graph';
        this.state.baseGraphUuid = importData.base_uuid || null;
        this.state.baseGraphLabel = importData.base_graph_label || null;
        this.state.createdAt = importData.created_at ? new Date(importData.created_at) : null;
        this.state.lastUpdated = importData.last_updated ? new Date(importData.last_updated) : null;
        this.state.authors = importData.authors || [];
        this.state.isPublic = false;
        this.state.isDirty = true;

        // Update graph visualization
        this.updateGraphVisualization();

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
            this.showMessage(`Node with ID ${nodeData.id} already exists`, 'error');
            return;
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

                    Object.assign(refNode, { prerequisites: updatedPrereq });
                    if (prerequisitesChanged) {
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
            
            if (prerequisitesChanged) {
                this.updateMentions(nodeId, updates.prerequisites, oldPrerequisites);
                if (shouldPrereqChange) this.propagatePrerequisiteChange(nodeId, oldPrerequisites);
            }
            
            this.updateGraphVisualization();
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
            // Mark for deletion instead of immediate removal
            this.state.nodes[nodeIndex]._isDeleted = true;
            this.state.nodes[nodeIndex]._isDirty = true;
            this.state.selectedNodes.delete(nodeId);
            this.state.isDirty = true;
            
            this.updateGraphVisualization();
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
            // Clear deletion flag
            delete this.state.nodes[nodeIndex]._isDeleted;
            this.state.nodes[nodeIndex]._isDirty = true;
            this.state.isDirty = true;
            
            this.updateGraphVisualization();
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
            // Clear deletion flag
            delete this.state.domains[domainIndex]._isDeleted;
            this.state.domains[domainIndex]._isDirty = true;
            this.state.isDirty = true;
            
            this.updateGraphVisualization();
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
            throw new Error(`Domain with ID ${domainData.id} already exists`);
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
        
        this.state.isDirty = true;
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
            Object.assign(this.state.domains[domainIndex], updates, { _isDirty: true });  // Mark as dirty
            this.state.isDirty = true;
            
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
            // Mark for deletion instead of immediate removal
            this.state.domains[domainIndex]._isDeleted = true;
            this.state.domains[domainIndex]._isDirty = true;
            this.state.selectedDomains.delete(domainId);
            
            // Mark nodes as deleted
            this.state.nodes.forEach(node => {
                if (node.domainId === domainId) {
                    node._isDirty = true;
                    node._isDeleted = true;
                }
            });
            
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
     * Check if domainId is an ancestor of targetDomainId
     * @param {number} domainId - Domain ID
     * @param {number} targetDomainId - Target domain ID
     * @returns {boolean} True if domainId is an ancestor of targetDomainId
     */
    checkMoveValidity(domainId, targetDomainId) {
        // Check if domainId is an ancestor of targetDomainId and other valdiity checks
        let currentId = targetDomainId;
        
        while (currentId) {
            const domain = this.state.domains.find(d => d.id === currentId);
            if (!domain) return false;
            
            if (domain.id === domainId) {
                return false;
            }
            
            currentId = domain.parentId;
        }
        
        return true;
    }

    /**
     * Move selected items to domain
     * @param {number} targetDomainId - Target domain ID
     */
    moveSelectedToDomain(targetDomainId) {
        const selectedItems = this.getSelectedItems();
        
        // Check validity of move
        const isValid = selectedItems.every(item => {
            return this.checkMoveValidity(item.id, targetDomainId);
        });
        
        if (!isValid) {
            throw new Error('Invalid move');
        }
        
        selectedItems.forEach(item => {
            if (item.type === 'node') {
                // Update node's domain
                const node = this.state.nodes.find(n => n.id === item.id);
                if (node) {
                    node.domainId = targetDomainId;
                    node._isDirty = true;  // Mark as dirty when moved
                }
            } else if (item.type === 'domain') {
                // Update domain's parent
                const domain = this.state.domains.find(d => d.id === item.id);
                if (domain) {
                    domain.parentId = targetDomainId;
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

        this.updateGraphVisualization();
        this.persistState();
        this.notifyStateChange();
    }

    /**
     * Update graph visualization data
     */
    updateGraphVisualization() {
        const { nodes, edges, defaultPositions } = this.buildGraphData();
        this.state.graphState.nodes = nodes;
        this.state.graphState.edges = edges;
        this.state.graphState.defaultPositions = defaultPositions;
    }

    /**
     * Build graph data from current workspace with DNF transformation
     */
    buildGraphData() {
        const nodes = [];
        const edges = [];
        const pathways = [];
        const defaultPositions = new Map();
        const cycles = [];
        const domains = []
        
        // Process each node to create graph structure (only store IDs)
        this.state.nodes.forEach(node => {
            // Create graph node with minimal data
            const graphNode = {
                id: node.id,
                title: node.title,
                domainId: node.domainId
            };
            
            nodes.push(graphNode);
            
            // Process prerequisites to create DNF pathways
            if (node.prerequisites) {
                const parsed = ExpressionUtils.parsePrerequisites(node.prerequisites);
                if (parsed.isValid) {
                    const dnfPathways = ExpressionUtils.convertToDNF(parsed.structure);
                    
                    dnfPathways.forEach(pathway => {
                        // Add pathway to list
                        pathways.push({
                            to: node.id,
                            from: pathway,
                            expression: pathway.join(' AND ')
                        });
                        
                        // Create edges for this pathway by appending dependent node ID
                        const pathwayWithDependentNode = [...pathway, node.id];
                        const pathwayEdges = ExpressionUtils.buildEdgesFromPathways([pathwayWithDependentNode]);
                        edges.push(...pathwayEdges);
                    });
                }
            }
        });

        // Create domains data
        this.state.domains.forEach(domain => {
            const graphDomain = {
                id: domain.id,
                parentId: domain.parentId
            };

            domains.push(graphDomain)
        });
        
        // Remove duplicate edges
        const uniqueEdges = this.removeDuplicateEdges(edges);
        
        // Detect cycles (using full node data from state)
        const fullNodes = this.state.nodes.map(node => ({
            id: node.id,
            label: node.title,
            assessable: node.assessable || false,
            domainId: node.domainId,
            description: node.description,
            prerequisites: node.prerequisites,
            position: node.position
        }));
        const detectedCycles = ExpressionUtils.detectCycles(fullNodes, uniqueEdges);
        cycles.push(...detectedCycles);
        
        // Perform transitive reduction
        const reducedEdges = ExpressionUtils.transitiveReduction(fullNodes, uniqueEdges);
        
        // Generate default positions
        // Priority: currentPositionOverrides > stored positions > algorithmic positions
        const algorithmicPositions = ExpressionUtils.generateDefaultPositions(fullNodes, {
            width: 800,
            height: 600,
            layout: 'hierarchical'
        });

        const currentOverrides = this.state.graphState.currentPositionOverrides;

        // Merge positions with priority order
        fullNodes.forEach(node => {
            const overridePosition = currentOverrides?.get(node.id);
            const storedPosition = node.position;
            const algoPosition = algorithmicPositions.get(node.id);

            // Use override (unsaved drag) first, then stored, then algorithmic
            if (overridePosition) {
                defaultPositions.set(node.id, { x: overridePosition.x, y: overridePosition.y });
            } else if (storedPosition && storedPosition.x !== null && storedPosition.y !== null) {
                defaultPositions.set(node.id, { x: storedPosition.x, y: storedPosition.y });
            } else if (algoPosition) {
                defaultPositions.set(node.id, algoPosition);
            }
        });
        
        // Update graph state (minimal data structure)
        this.state.graphState.nodes = nodes;
        this.state.graphState.edges = reducedEdges;
        this.state.graphState.pathways = pathways;
        this.state.graphState.defaultPositions = defaultPositions;
        this.state.graphState.cycles = cycles;
        this.state.graphState.lastUpdated = new Date();
        this.state.graphState.domains = domains;
        
        return { nodes, edges: reducedEdges, pathways, defaultPositions, cycles, domains: domains };
    }

    /**
     * Remove duplicate edges from array
     * @param {Array} edges - Array of edge objects
     * @returns {Array} Array of unique edges
     */
    removeDuplicateEdges(edges) {
        const seen = new Set();
        const uniqueEdges = [];
        
        edges.forEach(edge => {
            const key = `${edge.from}-${edge.to}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueEdges.push(edge);
            }
        });
        
        return uniqueEdges;
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
    updateTabDisplay() {
        const activeTab = this.state.activeTab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(button => {
            const tabName = button.id.replace('tab-', '');
            button.classList.toggle('active', tabName === activeTab);
        });

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

    freezePositions() {
        // Freeze graph positions - update both graphState and node states
        console.log('Freezing positions:', this.state.graphState);

        const currentOverrides = this.state.graphState.currentPositionOverrides;
        if (currentOverrides) {
            // Update graphState default positions
            this.state.graphState.defaultPositions = new Map(currentOverrides);

            // Update each node's position in the nodes array
            this.state.nodes.forEach(node => {
                const position = currentOverrides.get(node.id);
                if (position) {
                    node.position = {
                        x: position.x,
                        y: position.y
                    };
                    node._isDirty = true; // Mark node as dirty for save
                }
            });

            this.showMessage('Positions fixed and saved to nodes', 'success');
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
    customAlert(message, callback = null) {
        return this.showDialog({ type: 'alert', title: 'Alert', message, callback });
    }

    /**
     * Show custom confirm dialog
     * @param {string} message - Confirm message
     * @param {Function} callback - Optional callback
     */
    customConfirm(message, callback = null) {
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
