/**
 * Lab UI State Manager - State management for the lab/workspace page
 * Handles snapshot loading, workspace state, and UI interactions
 */
class LabStateManager {
    constructor() {
        this.state = {
            // Current workspace state
            currentSnapshot: null,
            baseSnapshot: null,
            nodes: [],
            domains: [],
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
                llm: { query: '' },
                dialog: { title: '', message: '', input: '', callback: null }
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
            snapshotList: [],
            isSnapshotListOpen: false,
            currentVersionLabel: '',
            baseGraphLabel: null,
            overwriteMode: false,
            isPublic: false
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
            const currentSnapshotLabel = localStorage.getItem('lab_currentSnapshotLabel');
            const baseGraphLabel = localStorage.getItem('lab_baseGraphLabel');
            const isPublic = localStorage.getItem('lab_isPublic');

            if (persistedNodes) {
                const nodesData = JSON.parse(persistedNodes);
                this.state.nodes = nodesData;
            }
            
            if (persistedDomains) {
                const domainsData = JSON.parse(persistedDomains);
                this.state.domains = domainsData;
            }
            
            if (currentSnapshotLabel) {
                this.state.currentVersionLabel = currentSnapshotLabel;
            }
            
            if (baseGraphLabel) {
                this.state.baseGraphLabel = baseGraphLabel;
            }
            
            if (isPublic) {
                this.state.isPublic = isPublic === 'true';
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
            localStorage.setItem('lab_currentSnapshotLabel', this.state.currentVersionLabel);
            localStorage.setItem('lab_baseGraphLabel', this.state.baseGraphLabel);
            localStorage.setItem('lab_isPublic', this.state.isPublic);
            
            // Persist graph state
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
            this.state.currentSnapshot = frontendSnapshot;
            this.state.nodes = frontendSnapshot.nodes || [];
            this.state.domains = frontendSnapshot.domains || [];
            this.state.currentVersionLabel = frontendSnapshot.versionLabel;
            this.state.baseGraphLabel = frontendSnapshot.baseGraphLabel;
            this.state.isPublic = frontendSnapshot.isPublic || false;
            
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
     * Set base snapshot
     * @param {Object} baseSnapshot - Base snapshot object from transformer
     */
    setBaseSnapshot(baseSnapshot) {
        this.state.baseSnapshot = baseSnapshot;
        this.notifyStateChange();
    }

    /**
     * Export current workspace draft for delegated persistence.
     * No API/transformer calls happen here; orchestration layer handles that.
     * @param {Object} saveOptions - Save options
     * @returns {Object} Raw draft payload for database management orchestration
     */
    exportWorkspace(saveOptions = {}) {
        const currentSnapshotUuid = this.state.currentSnapshot?.uuid || null;
        const baseUuid = this.state.baseSnapshot?.uuid || currentSnapshotUuid || null;

        const workspaceDraft = {
            versionLabel: saveOptions.versionLabel || this.state.currentVersionLabel,
            nodes: this.state.nodes,
            domains: this.state.domains,
            currentSnapshotUuid,
            baseUuid,
            overwrite: saveOptions.overwrite || false,
            isPublic: this.state.isPublic
        };
        
        return workspaceDraft;
    }

    /**
     * Add node to draft
     * @param {Object} nodeData - Node data
     */
    addNode(nodeData) {
        // Check if node ID already exists
        const existingNode = this.state.nodes.find(node => node.id === nodeData.id);
        if (existingNode) {
            this.showMessage(`Node with ID ${nodeData.id} already exists`, 'error');
            return;
        }

        // Process prerequisites if utils are available
        let processedPrerequisites = nodeData.prerequisites || '';
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
                        nodeData.id,
                        this.state.nodes
                    );
                    
                    // Validate the simplified expression again
                    const simplifiedValidation = window.ExpressionUtils.parsePrerequisites(simplified);
                    if (simplifiedValidation.isValid) {
                        console.log(`Prerequisites simplified from "${nodeData.prerequisites}" to "${simplified}"`);
                        processedPrerequisites = simplified;
                    } else {
                        console.warn(`Simplified expression is invalid, keeping original: "${nodeData.prerequisites}"`);
                        processedPrerequisites = nodeData.prerequisites;
                    }
                } else {
                    // Don't simplify if there are non-existent nodes or syntax errors
                    if (validation.hasNonExistentNodes) {
                        console.warn(`Expression references non-existent nodes [${validation.missingNodes.join(', ')}], keeping original: "${nodeData.prerequisites}"`);
                    } else {
                        console.warn(`Invalid expression syntax, keeping original: "${nodeData.prerequisites}"`);
                    }
                    processedPrerequisites = nodeData.prerequisites;
                }
            } catch (error) {
                console.error('Error processing prerequisites:', error);
                // Keep original if processing fails
                processedPrerequisites = nodeData.prerequisites;
            }
        }

        const newNode = {
            ...nodeData,
            prerequisites: processedPrerequisites,
            position: { x: null, y: null },
            isSelected: false,
            isEditing: false,
            isValid: true,
            validationErrors: []
        };
        
        // Add node to flat structure
        this.state.nodes.push(newNode);
        
        this.state.isDirty = true;
        this.notifyStateChange();
    }

    /**
     * Update node in draft
     * @param {number} nodeId - Node ID
     * @param {Object} updates - Node updates
     */
    updateNode(nodeId, updates) {
        const nodeIndex = this.state.nodes.findIndex(node => node.id === nodeId);
        if (nodeIndex !== -1) {
            Object.assign(this.state.nodes[nodeIndex], updates);
            this.state.isDirty = true;
            
            this.updateGraphVisualization();
            this.notifyStateChange();
        }
    }

    /**
     * Delete node from draft
     * @param {number} nodeId - Node ID
     */
    deleteNode(nodeId) {
        this.state.nodes = this.state.nodes.filter(node => node.id !== nodeId);
        this.state.selectedNodes.delete(nodeId);
        this.state.isDirty = true;
        
        this.updateGraphVisualization();
        this.notifyStateChange();
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
            isEditing: false
        };

        // Add domain to flat structure
        this.state.domains.push(newDomain);
        
        this.state.isDirty = true;
        this.notifyStateChange();

        // Close create domain modal
        this.modals.createDomain = false;
    }

    /**
     * Update domain in draft
     * @param {number} domainId - Domain ID
     * @param {Object} updates - Domain updates
     */
    updateDomain(domainId, updates) {
        const domainIndex = this.state.domains.findIndex(domain => domain.id === domainId);
        if (domainIndex !== -1) {
            Object.assign(this.state.domains[domainIndex], updates);
            this.state.isDirty = true;
            
            this.notifyStateChange();
        }
    }

    /**
     * Delete domain from draft
     * @param {number} domainId - Domain ID
     */
    deleteDomain(domainId) {
        this.state.domains = this.state.domains.filter(domain => domain.id !== domainId);
        this.state.selectedDomains.delete(domainId);
        
        // Remove domain reference from nodes
        this.state.nodes.forEach(node => {
            if (node.domainId === domainId) {
                node.domainId = null;
            }
        });
        
        this.state.isDirty = true;
        this.notifyStateChange();
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
        this.state.currentSnapshot = null;
        this.state.baseSnapshot = null;
        this.state.nodes = [];
        this.state.domains = [];
        this.state.selectedNodes.clear();
        this.state.selectedDomains.clear();
        this.state.currentVersionLabel = '';
        this.state.baseGraphLabel = null;
        this.state.isDirty = false;
        
        this.updateGraphVisualization();
        this.persistState();
        this.notifyStateChange();
    }

    /**
     * Update graph visualization data
     */
    updateGraphVisualization() {
        const { nodes, edges } = this.buildGraphData();
        this.state.graphState.nodes = nodes;
        this.state.graphState.edges = edges;
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
            prerequisites: node.prerequisites
        }));
        const detectedCycles = ExpressionUtils.detectCycles(fullNodes, uniqueEdges);
        cycles.push(...detectedCycles);
        
        // Perform transitive reduction
        const reducedEdges = ExpressionUtils.transitiveReduction(fullNodes, uniqueEdges);
        
        // Generate default positions
        const positions = ExpressionUtils.generateDefaultPositions(fullNodes, {
            width: 800,
            height: 600,
            layout: 'hierarchical'
        });
        
        positions.forEach((position, nodeId) => {
            defaultPositions.set(nodeId, position);
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
     * @param {boolean} open - Open state
     */
    toggleModal(modalName, open = null) {
        this.state.modals[modalName] = open !== null ? open : !this.state.modals[modalName];
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
                this.state.forms.newNode = this.createEmptyNodeForm();
                break;
            case 'editNode':
                this.state.forms.editNode = this.createEmptyNodeForm();
                break;
            case 'newDomain':
                this.state.forms.newDomain = this.createEmptyDomainForm();
                break;
            case 'editDomain':
                this.state.forms.editDomain = this.createEmptyDomainForm();
                break;
            case 'source':
                this.state.forms.source = this.createEmptySourceForm();
                break;
            case 'llm':
                this.state.forms.llm = { query: '' };
                break;
            case 'dialog':
                this.state.forms.dialog = { title: '', message: '', input: '', callback: null };
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
            type: 'PDF',
            author: '',
            year: null,
            url: '',
            fragmentStart: '',
            fragmentEnd: ''
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
        // Freeze graph positions 
        console.log(this.state.graphState);
        
        this.state.graphState.defaultPositions = this.state.graphState.currentPositionOverrides;
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

