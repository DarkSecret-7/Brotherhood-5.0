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
 * Assessment Controller - Orchestrates the assessment page remake
 * Handles page logic, rendering, and contacts other layers (API, State, Graph Controller)
 * Purely responsible for the UI logic of the assessment page.
 */
class AssessmentController {
    /**
     * @param {AssessmentStateManager} stateManager - Assessment state manager
     * @param {GalleryTransformer} transformer - For data transformation
     */
    constructor(stateManager, transformer) {
        this.stateManager = stateManager;
        // Use global API services from scope
        this.transformer = transformer;

        this.graphController = null;
        this.elements = {};

        // Bind for subscriptions
        this.handleStateChange = this.handleStateChange.bind(this);
        this.deleteSavedAssessment = this.deleteSavedAssessment.bind(this);
        this.clearCurrentProgress = this.clearCurrentProgress.bind(this);
        this.saveAssessment = this.saveAssessment.bind(this);
        this.refreshSavedAssessment = this.refreshSavedAssessment.bind(this);
    }

    /**
     * Initialize the controller
     */
    async init() {
        this.initializeElements();
        this.bindEvents();

        // Subscribe to state changes
        this.stateManager.subscribe(this.handleStateChange);
        
        // Parse URL parameters for direct graph loading
        const urlParams = UrlParser.parseUrlParameters();
        
        // Check if we already have a graph loaded (e.g., from state persistence)
        const currentState = this.stateManager.state;
        if (currentState.currentGraph) {
            // Assessment already in progress, just render it
            this.render();
            return;
        }
        
        // Use only URL parameters for graph loading
        if (urlParams.graph) {
            // Load assessment graph from URL parameter
            await this.loadGraphForAssessmentFromUrl(urlParams.graph);
        } else {
            // No graph selected - show default view (static in HTML)
            // HTML already shows the no-graph message by default
            this.showNoGraphView();
        }
    }

    /**
     * Load graph for assessment from URL parameter with dashboard-specific error handling
     * @param {string} graphUuid
     */
    async loadGraphForAssessmentFromUrl(graphUuid) {
        try {
            this.stateManager.setLoading(true);
            
            // Validate UUID format
            if (!UrlParser.isValidUuid(graphUuid)) {
                throw new Error('Invalid graph UUID format in URL parameter');
            }
            
            // Fetch and transform graph data with bookmark validation
            const backendSnapshot = await snapshotsApiService.getSnapshotForAssessment(graphUuid);
            const transformedData = this.transformer.transformSnapshotFromBackend(backendSnapshot);
            
            // Update state
            this.stateManager.loadGraph(transformedData);
            this.stateManager.setViewMode('assessment');
            
            // Fetch latest saved self-assessment for this graph
            await this.fetchSavedAssessment(graphUuid);
            
            // Update URL to reflect loaded graph (without page refresh)
            UrlParser.updateUrlParameters({ graph: graphUuid }, true);
            
            console.log('AssessmentController: Graph loaded from URL parameter', graphUuid);
        } catch (error) {
            console.error('AssessmentController: Failed to load graph from URL parameter', error);
            
            // Use dashboard-specific error handling with custom dialog
            await this.stateManager.showAlert({
                title: 'Failed to Load Graph',
                message: `Could not load the requested graph for assessment: ${error.message}. Please try again from the Library.`
            });
            
            this.showNoGraphView();
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    /**
     * Load graph for assessment
     * @param {string} graphUuid
     */
    async loadGraphForAssessment(graphUuid) {
        try {
            this.stateManager.setLoading(true);
            
            // Fetch and transform graph data with bookmark validation
            const backendSnapshot = await snapshotsApiService.getSnapshotForAssessment(graphUuid);
            const transformedData = this.transformer.transformSnapshotFromBackend(backendSnapshot);
            
            // Update state
            this.stateManager.loadGraph(transformedData);
            this.stateManager.setViewMode('assessment');
            
            // Fetch latest saved self-assessment for this graph
            await this.fetchSavedAssessment(graphUuid);
            
            console.log('AssessmentController: Graph loaded successfully', graphUuid);
        } catch (error) {
            console.error('AssessmentController: Failed to load graph for assessment', error);
            this.stateManager.setError('Failed to load graph data. Please try again from Library.');
            this.showErrorView('Failed to load graph data. Please try again from Library.');
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    /**
     * Fetch latest saved self-assessment - checks cache first, then backend
     * @param {string} graphUuid
     * @param {boolean} forceRefresh - If true, skip cache and fetch from backend
     */
    async fetchSavedAssessment(graphUuid, forceRefresh = false) {
        if (!forceRefresh) {
            // Check cache first
            const cachedCapability = this.stateManager.loadAssessmentFromCache(graphUuid);
            if (cachedCapability) {
                this.stateManager.loadSavedAssessment(cachedCapability);
                console.log('AssessmentController: Loaded saved assessment from cache', cachedCapability);
                return;
            }
        }

        try {
            const backendCapability = await assessmentsApiService.getLatestSelfAssessment(graphUuid);
            if (backendCapability) {
                // Transform backend capability to frontend format using transformer
                const capability = assessmentsTransformer.transformCapabilityFromBackend(backendCapability);
                this.stateManager.loadSavedAssessment(capability);
                console.log('AssessmentController: Loaded saved assessment from backend', capability);
            } else {
                console.log('AssessmentController: No saved assessment found');
            }
        } catch (error) {
            console.error('AssessmentController: Failed to fetch saved assessment', error);
            // Don't show error - assessment can still work without saved data
        }
    }

    /**
     * Hard refresh - force fetch from backend, bypassing cache
     */
    async refreshSavedAssessment() {
        const state = this.stateManager.state;
        if (!state.currentGraph || !state.currentGraph.currentSnapshotUuid) {
            await this.stateManager.showAlert({
                title: 'No Graph Loaded',
                message: 'Please load a graph first to refresh its assessment.'
            });
            return;
        }

        const graphUuid = state.currentGraph.currentSnapshotUuid;
        
        try {           
            // Force refresh from backend
            await this.fetchSavedAssessment(graphUuid, true);
            
            await this.stateManager.showAlert({
                title: 'Refreshed',
                message: 'Assessment data has been updated from the server.'
            });
        } catch (error) {
            console.error('AssessmentController: Failed to refresh assessment', error);
            await this.stateManager.showAlert({
                title: 'Refresh Failed',
                message: 'Could not refresh assessment data from server.'
            });
        }
    }

    /**
     * Delete saved self-assessment from backend
     */
    async deleteSavedAssessment() {
        const state = this.stateManager.state;
        console.log(state);
        
        if (!state.currentGraph || !state.currentGraph.currentSnapshotUuid) {
            this.stateManager.showAlert({
                title: 'No Graph Loaded',
                message: 'Please load a graph first to delete its assessment.'
            });
            return;
        }
        if (!state.currentCapability) {
            this.stateManager.showAlert({
                title: 'No Saved Assessment',
                message: 'No saved assessment found to delete.'
            });
            return;
        }

        const confirmed = await this.stateManager.showConfirm({
            title: 'Delete Saved Assessment',
            message: 'Are you sure you want to delete your saved assessment? This cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel'
        });

        if (!confirmed) {
            return;
        }

        try {
            await assessmentsApiService.deleteSelfAssessment(state.currentGraph.currentSnapshotUuid);
            
            // Clear saved data from state and cache
            this.stateManager.setState({
                savedProofInputs: {},
                hasSavedAssessment: false,
                currentCapability: null
            });
            this.stateManager.clearAssessmentCache(state.currentGraph.currentSnapshotUuid);
            
            console.log('AssessmentController: Deleted saved assessment');
        } catch (error) {
            console.error('AssessmentController: Failed to delete saved assessment', error);
            await this.stateManager.showAlert({
                title: 'Error',
                message: 'Failed to delete saved assessment. Please try again.'
            });
        }
    }

    /**
     * Clear all current progress (proof inputs)
     */
    async clearCurrentProgress() {
        const state = this.stateManager.state;
        if (Object.keys(state.proofInputs).length === 0) {
            this.stateManager.showAlert({
                title: 'No Progress to Clear',
                message: 'There is no current progress to clear.'
            });
            return;
        }

        const confirmed = await this.stateManager.showConfirm({
            title: 'Clear Current Progress',
            message: 'Are you sure you want to clear all your current progress?',
            confirmText: 'Clear',
            cancelText: 'Cancel'
        });

        if (!confirmed) {
            return;
        }

        // Clear all proof inputs but keep saved data intact
        this.stateManager.setState({
            proofInputs: {}
        });
        
        console.log('AssessmentController: Cleared current progress');
    }

    /**
     * Save current assessment to backend
     * 1. Delete previous self-assessment
     * 2. Create new capability with current proof inputs
     */
    async saveAssessment() {
        const state = this.stateManager.state;
        if (!state.currentGraph || !state.currentGraph.currentSnapshotUuid) {
            console.warn('No graph loaded to save assessment for');
            return;
        }

        const currentTotal = Object.keys(state.proofInputs).length;
        if (currentTotal === 0) {
            await this.stateManager.showAlert({
                title: 'Nothing to Save',
                message: 'You have not assessed any nodes yet.'
            });
            return;
        }

        const confirmed = await this.stateManager.showConfirm({
            title: 'Save Assessment',
            message: state.hasSavedAssessment 
                ? 'This will expand your previously saved assessment with your new progress. Continue?'
                : 'Save your current progress?',
            confirmText: 'Save',
            cancelText: 'Cancel'
        });

        if (!confirmed) {
            return;
        }

        try {
            // 1. Delete previous self-assessment if exists
            if (state.hasSavedAssessment) {
                try {
                    await assessmentsApiService.deleteSelfAssessment(state.currentGraph.currentSnapshotUuid);
                    console.log('AssessmentController: Deleted previous self-assessment');
                } catch (deleteError) {
                    console.warn('AssessmentController: Failed to delete previous assessment, continuing anyway', deleteError);
                }
            }

            // 2. Transform to backend format using transformer
            const requestData = assessmentsTransformer.transformSelfAssessmentToBackend({
                graphUuid: state.currentGraph.currentSnapshotUuid,
                proofInputs: state.proofInputs
            });

            console.log('Request Data sending to the backend', requestData);
            

            const result = await assessmentsApiService.performSelfAssessment(requestData);
            
            // 4. Update state with saved data, save to cache, and clear current session
            const transformedCapability = assessmentsTransformer.transformCapabilityFromBackend(result);
            this.stateManager.loadSavedAssessment(transformedCapability);
            
            await this.stateManager.showAlert({
                title: 'Success',
                message: 'Your assessment has been saved successfully.'
            });
            
            console.log('AssessmentController: Saved assessment', result);
        } catch (error) {
            console.error('AssessmentController: Failed to save assessment', error);
            await this.stateManager.showAlert({
                title: 'Error',
                message: 'Failed to save assessment. Please try again.'
            });
        }
    }

    /**
     * Assessment cache is preserved for future use
     */
    exitGraph() {
        const state = this.stateManager.state;
        const graphName = state.currentGraph 
            ? (state.currentGraph.baseGraphLabel || state.currentGraph.currentVersionLabel || 'this graph')
            : 'this graph';

        this.stateManager.showConfirm({
            title: 'Exit Assessment?',
            message: `Are you sure you want to exit the assessment for "${graphName}"? Your assessment cache will be preserved.`,
            confirmText: 'Exit',
            cancelText: 'Cancel'
        }).then(confirmed => {
            if (confirmed) {               
                // Clear the current graph from state
                this.stateManager.clearGraph();
                
                // Redirect to library
                window.location.href = '/academia/library';
            }
        });
    }

    /**
     * Show the graph metadata modal with read-only graph information
     */
    showGraphMetadata() {
        const state = this.stateManager.state;
        if (!state.currentGraph) {
            return;
        }

        const graph = state.currentGraph;
        
        // Populate metadata fields using correct property names from GalleryTransformer
        if (this.elements.metadataGraphName) {
            this.elements.metadataGraphName.textContent = graph.currentVersionLabel || 'N/A';
        }
        if (this.elements.metadataGraphUuid) {
            this.elements.metadataGraphUuid.textContent = graph.currentSnapshotUuid || 'N/A';
        }
        if (this.elements.metadataBaseGraph) {
            this.elements.metadataBaseGraph.textContent = graph.baseGraphLabel || 'None';
        }
        if (this.elements.metadataBaseGraphUuid) {
            this.elements.metadataBaseGraphUuid.textContent = graph.baseGraphUuid || '-';
        }
        if (this.elements.metadataGraphAuthor) {
            const authorName = graph.authors && graph.authors.length > 0 
                ? graph.authors.map(a => a.username).join(', ')
                : 'Unknown';
            this.elements.metadataGraphAuthor.textContent = authorName;
        }
        if (this.elements.metadataGraphCreated) {
            const createdDate = graph.createdAt ? new Date(graph.createdAt).toLocaleString() : 'N/A';
            this.elements.metadataGraphCreated.textContent = createdDate;
        }
        if (this.elements.metadataNodeCount) {
            const nodeCount = graph.nodeCount || 0;
            this.elements.metadataNodeCount.textContent = `${nodeCount} node${nodeCount !== 1 ? 's' : ''}`;
        }
        if (this.elements.metadataAssessableNodeCount) {
            const assessableNodeCount = graph.assessableNodeCount || 0;
            this.elements.metadataAssessableNodeCount.textContent = `${assessableNodeCount} assessable node${assessableNodeCount !== 1 ? 's' : ''}`;
        }
        if (this.elements.metadataDomainCount) {
            const domainCount = graph.domainCount || 0;
            this.elements.metadataDomainCount.textContent = `${domainCount} domain${domainCount !== 1 ? 's' : ''}`;
        }

        // Show the modal
        if (this.elements.graphMetadataOverlay) {
            this.elements.graphMetadataOverlay.style.display = 'block';
        }
    }

    /**
     * Close the graph metadata modal
     */
    closeGraphMetadata() {
        if (this.elements.graphMetadataOverlay) {
            this.elements.graphMetadataOverlay.style.display = 'none';
        }
    }

    /**
     * Cache DOM element references
     */
    initializeElements() {
        this.elements = {
            // Main page elements
            noGraphMessage: document.getElementById('no-graph-message'),
            loadingMessage: document.getElementById('loading-message'),
            errorMessage: document.getElementById('error-message'),
            errorText: document.getElementById('error-text'),
            
            // Full-screen graph view
            graphView: document.getElementById('assessment-graph-view'),
            graphContainer: document.getElementById('graph-visualization-container'),
            
            // Summary tab - dual panel layout
            summaryTab: document.getElementById('assessment-summary-tab'),
            // Saved panel
            summarySavedWant: document.getElementById('summary-saved-want'),
            summarySavedLearning: document.getElementById('summary-saved-learning'),
            summarySavedLearnt: document.getElementById('summary-saved-learnt'),
            summarySavedTotal: document.getElementById('summary-saved-total'),
            btnDeleteSaved: document.getElementById('btn-delete-saved'),
            // Current panel
            btnSaveAssessment: document.getElementById('btn-save-assessment'),
            summaryCurrentWant: document.getElementById('summary-current-want'),
            summaryCurrentLearning: document.getElementById('summary-current-learning'),
            summaryCurrentLearnt: document.getElementById('summary-current-learnt'),
            summaryCurrentTotal: document.getElementById('summary-current-total'),
            unsavedIndicator: document.getElementById('unsaved-indicator'),
            btnClearCurrent: document.getElementById('btn-clear-current'),
            
            // Node Details
            nodeDetails: document.getElementById('node-details'),
            nodeTitle: document.getElementById('node-detail-title'),
            nodeDesc: document.getElementById('node-detail-desc'),
            nodeAssessable: document.getElementById('node-detail-assessable'),
            nodeSavedIndicator: document.getElementById('node-detail-saved-indicator'),
            nodeUnsavedIndicator: document.getElementById('node-detail-unsaved-indicator'),
            closeNodeBtn: document.getElementById('close-node-details'),
            nodeAssessmentControls: document.getElementById('node-assessment-controls'),
            statusButtons: document.querySelectorAll('.status-btn'),
            clearStatusBtn: document.querySelector('.clear-status-btn'),
            
            // Domain Details
            domainDetails: document.getElementById('domain-details'),
            domainTitle: document.getElementById('domain-detail-title'),
            domainDesc: document.getElementById('domain-detail-desc'),
            domainMeta: document.getElementById('domain-detail-meta'),
            closeDomainBtn: document.getElementById('close-domain-details'),
            // Domain Stats (read-only)
            domainSavedWant: document.getElementById('domain-saved-want'),
            domainSavedLearning: document.getElementById('domain-saved-learning'),
            domainSavedLearnt: document.getElementById('domain-saved-learnt'),
            domainSavedTotal: document.getElementById('domain-saved-total'),
            domainCurrentWant: document.getElementById('domain-current-want'),
            domainCurrentLearning: document.getElementById('domain-current-learning'),
            domainCurrentLearnt: document.getElementById('domain-current-learnt'),
            domainCurrentTotal: document.getElementById('domain-current-total'),
            
            // Custom Dialog
            dialogOverlay: document.getElementById('custom-dialog-overlay'),
            dialogTitle: document.getElementById('dialog-title'),
            dialogMessage: document.getElementById('dialog-message'),
            dialogConfirm: document.getElementById('dialog-confirm'),
            dialogCancel: document.getElementById('dialog-cancel'),

            // Graph Info Section
            graphInfoSection: document.getElementById('graph-info-section'),
            graphNameText: document.getElementById('graph-name-text'),
            btnExitGraph: document.getElementById('btn-exit-graph'),

            // Graph Metadata Modal
            graphMetadataOverlay: document.getElementById('graph-metadata-overlay'),
            graphMetadataModal: document.getElementById('graph-metadata-modal'),
            closeGraphMetadata: document.getElementById('close-graph-metadata'),
            metadataGraphName: document.getElementById('metadata-graph-name'),
            metadataGraphUuid: document.getElementById('metadata-graph-uuid'),
            metadataBaseGraph: document.getElementById('metadata-base-graph'),
            metadataBaseGraphUuid: document.getElementById('metadata-base-graph-uuid'),
            metadataGraphAuthor: document.getElementById('metadata-graph-author'),
            metadataGraphCreated: document.getElementById('metadata-graph-created'),
            metadataNodeCount: document.getElementById('metadata-node-count'),
            metadataAssessableNodeCount: document.getElementById('metadata-assessable-node-count'),
            metadataDomainCount: document.getElementById('metadata-domain-count')
        };
    }

    /**
     * Bind UI event listeners
     */
    bindEvents() {
        if (this.elements.closeNodeBtn) {
            this.elements.closeNodeBtn.addEventListener('click', () => {
                this.stateManager.closeNodeDetails();
            });
        }
        if (this.elements.closeDomainBtn) {
            this.elements.closeDomainBtn.addEventListener('click', () => {
                this.stateManager.closeDomainDetails();
            });
        }
        
        // Dialog button events
        if (this.elements.dialogConfirm) {
            this.elements.dialogConfirm.addEventListener('click', () => {
                this.stateManager.closeDialog(true);
            });
        }
        if (this.elements.dialogCancel) {
            this.elements.dialogCancel.addEventListener('click', () => {
                this.stateManager.closeDialog(false);
            });
        }
        if (this.elements.dialogOverlay) {
            this.elements.dialogOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.dialogOverlay) {
                    this.stateManager.closeDialog(false);
                }
            });
        }

        // Graph metadata modal events
        if (this.elements.closeGraphMetadata) {
            this.elements.closeGraphMetadata.addEventListener('click', () => {
                this.closeGraphMetadata();
            });
        }
        if (this.elements.graphMetadataOverlay) {
            this.elements.graphMetadataOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.graphMetadataOverlay) {
                    this.closeGraphMetadata();
                }
            });
        }

        // Status button clicks
        if (this.elements.statusButtons) {
            this.elements.statusButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const status = parseInt(e.target.getAttribute('data-status'));
                    const state = this.stateManager.state;
                    if (state.selectedNode) {
                        this.stateManager.updateProofInput(state.selectedNode.id, status);
                    }
                });
            });
        }

        // Clear status button click
        if (this.elements.clearStatusBtn) {
            this.elements.clearStatusBtn.addEventListener('click', () => {
                const state = this.stateManager.state;
                if (state.selectedNode) {
                    this.stateManager.clearProofInput(state.selectedNode.id);
                }
            });
        }

        // Global resize listener for the graph
        window.addEventListener('resize', () => {
            if (this.graphController) {
                this.graphController.handleResize();
            }
        });
    }

    /**
     * Handle state changes from AssessmentStateManager
     * @param {Object} state - Current state
     */
    handleStateChange(state) {
        if (state.isLoading) {
            this.showLoadingView();
        } else if (state.error) {
            this.showErrorView(state.error);
        } else if (state.currentGraph) {
            this.showAssessmentView();
            this.render(state.currentGraph);
            this.updateSummaryTab(state);
            this.applyNodeHighlights(state);
        } else {
            this.showNoGraphView();
        }

        this.renderDetailPanels();
        this.renderDialog(state);
    }

    /**
     * Render custom dialog based on state
     * @param {Object} state - Current state
     */
    renderDialog(state) {
        const dialog = state.dialog;
        if (!dialog || !this.elements.dialogOverlay) return;

        if (dialog.isOpen) {
            // Show dialog
            this.elements.dialogOverlay.style.display = 'block';
            this.elements.dialogTitle.textContent = dialog.title || '';
            this.elements.dialogMessage.textContent = dialog.message || '';
            this.elements.dialogConfirm.textContent = dialog.confirmText || 'OK';
            
            // Handle alert type (no cancel button)
            if (dialog.type === 'alert' || !dialog.cancelText) {
                this.elements.dialogCancel.style.display = 'none';
            } else {
                this.elements.dialogCancel.style.display = 'inline-block';
                this.elements.dialogCancel.textContent = dialog.cancelText || 'Cancel';
            }
        } else {
            // Hide dialog
            this.elements.dialogOverlay.style.display = 'none';
        }
    }

    /**
     * Update summary tab counts - both Saved and Current panels
     */
    updateSummaryTab(state) {
        // Update Saved Assessment panel
        const savedInputs = state.savedProofInputs || {};
        let savedWant = 0, savedLearning = 0, savedLearnt = 0;
        Object.values(savedInputs).forEach(status => {
            if (status === 0) savedWant++;
            else if (status === 1) savedLearning++;
            else if (status === 2) savedLearnt++;
        });
        
        if (this.elements.summarySavedWant) {
            this.elements.summarySavedWant.textContent = savedWant;
            this.elements.summarySavedLearning.textContent = savedLearning;
            this.elements.summarySavedLearnt.textContent = savedLearnt;
            this.elements.summarySavedTotal.textContent = Object.keys(savedInputs).length;
        }
        
        // Update Current Session panel
        const currentInputs = state.proofInputs || {};
        let currentWant = 0, currentLearning = 0, currentLearnt = 0;
        Object.values(currentInputs).forEach(status => {
            if (status === 0) currentWant++;
            else if (status === 1) currentLearning++;
            else if (status === 2) currentLearnt++;
        });
        
        if (this.elements.summaryCurrentWant) {
            this.elements.summaryCurrentWant.textContent = currentWant;
            this.elements.summaryCurrentLearning.textContent = currentLearning;
            this.elements.summaryCurrentLearnt.textContent = currentLearnt;
            this.elements.summaryCurrentTotal.textContent = Object.keys(currentInputs).length;
        }
        
        // Show/hide unsaved indicator on current panel
        if (this.elements.unsavedIndicator) {
            const hasUnsaved = this.stateManager.hasAnyUnsavedChanges();
            this.elements.unsavedIndicator.style.display = hasUnsaved ? 'inline-block' : 'none';
        }
    }

    /**
     * Convert proofInputs to assignables and pass to graphController
     * Status 0 -> Group 1 (Unknown/Grey)
     * Status 1 -> Group 2 (Familiar/Orange)  
     * Status 2 -> Group 3 (Mastered/Green)
     */
    applyNodeHighlights(state) {
        if (!this.graphController) return;

        // current session (proofInputs) override saved assessments (savedProofInputs) in highlighting
        const proofInputs = state.proofInputs || {};
        const savedProofInputs = state.savedProofInputs || {};
        const highlightedNodes = new Set();

        Object.entries(proofInputs).forEach(([nodeId, status]) => {
            // Convert string key back to number if needed
            const id = parseInt(nodeId) || nodeId;
            // Map status to highlight group (status 0->1, 1->2, 2->3)
            const group = status + 1;
            highlightedNodes.add({ id, group });
        });

        for (let proof of Object.entries(savedProofInputs)){
            const nodeId = proof[0];
            const status = proof[1];

            if (nodeId in proofInputs) continue;       // skip if overriden by current session

            // Convert string key back to number if needed
            const id = parseInt(nodeId) || nodeId;
            // Map status to highlight group (status 0->1, 1->2, 2->3)
            const group = status + 1;
            highlightedNodes.add({ id, group });
        };

        this.graphController.setAssignables({
            highlightedNodes
        });
    }

    /**
     * Main render function that decides what view to show
     */
    render() {
        const state = this.stateManager.state;
        
        if (state.viewMode === 'assessment' && state.currentGraph) {
            this.showAssessmentView();
        } else if (state.isLoading) {
            this.showLoadingView();
        } else if (state.error) {
            this.showErrorView(state.error);
        }
        // Otherwise no-graph view is already shown by default in HTML
    }

    /**
     * Show the default "no graph selected" view (static in HTML)
     */
    showNoGraphView() {
        if (this.elements.noGraphMessage) this.elements.noGraphMessage.style.display = 'block';
        if (this.elements.loadingMessage) this.elements.loadingMessage.style.display = 'none';
        if (this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';
        if (this.elements.graphView) this.elements.graphView.style.display = 'none';
        if (this.elements.graphInfoSection) this.elements.graphInfoSection.style.display = 'none';
    }

    /**
     * Show loading view
     */
    showLoadingView() {
        if (this.elements.noGraphMessage) this.elements.noGraphMessage.style.display = 'none';
        if (this.elements.loadingMessage) this.elements.loadingMessage.style.display = 'block';
        if (this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';
        if (this.elements.graphView) this.elements.graphView.style.display = 'none';
        if (this.elements.graphInfoSection) this.elements.graphInfoSection.style.display = 'none';
    }

    /**
     * Show error view
     */
    showErrorView(error) {
        if (this.elements.noGraphMessage) this.elements.noGraphMessage.style.display = 'none';
        if (this.elements.loadingMessage) this.elements.loadingMessage.style.display = 'none';
        if (this.elements.errorMessage) {
            if (this.elements.errorText) this.elements.errorText.textContent = error || 'An error occurred.';
            this.elements.errorMessage.style.display = 'block';
        }
        if (this.elements.graphView) this.elements.graphView.style.display = 'none';
        if (this.elements.graphInfoSection) this.elements.graphInfoSection.style.display = 'none';
    }

    /**
     * Show the full-screen graph assessment view
     */
    showAssessmentView() {
        // Hide main page content
        if (this.elements.noGraphMessage) this.elements.noGraphMessage.style.display = 'none';
        if (this.elements.loadingMessage) this.elements.loadingMessage.style.display = 'none';
        if (this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';
        
        // Show graph view
        if (this.elements.graphView) {
            this.elements.graphView.style.display = 'block';
            
            // Show graph info section and update graph name
            const state = this.stateManager.state;
            if (this.elements.graphInfoSection) {
                this.elements.graphInfoSection.style.display = 'flex';
            }
            if (this.elements.graphNameText && state.currentGraph) {
                const graphName = state.currentGraph.baseGraphLabel || state.currentGraph.currentVersionLabel || 'Unnamed Graph';
                this.elements.graphNameText.textContent = graphName;
            }
            
            // Initialize graph controller if not already done
            if (!this.graphController && this.elements.graphContainer) {
                this.graphController = new AcademiaGraphController(this.elements.graphContainer, {
                    onNodeClick: (nodeId) => this.stateManager.selectNode(nodeId),
                    onDomainClick: (domainId) => this.stateManager.selectDomain(domainId),
                    onUnfocus: () => {
                        this.stateManager.closeNodeDetails();
                        this.stateManager.closeDomainDetails();
                    },
                    onPositionChange: (nodeId, position) => {
                        this.stateManager.updateNodePosition(nodeId, position);
                    }
                });
            }

            // Update graph data in visualizer
            if (this.graphController && state.currentGraph) {
                this.graphController.update(state.currentGraph.graphData);
            }

            // Render detail panels
            this.renderDetailPanels();
        }
    }

    /**
     * Render node and domain detail panels based on state
     */
    renderDetailPanels() {
        const state = this.stateManager.state;

        // Node Details
        if (state.showNodeDetails && state.selectedNode) {
            const node = state.selectedNode;
            this.elements.nodeTitle.textContent = `${node.id}: ${node.title}`;
            this.elements.nodeDesc.textContent = node.description || 'No description available.';
            this.elements.nodeAssessable.textContent = node.assessable ? 'Assessable' : 'Not Assessable';
            this.elements.nodeAssessable.className = node.assessable ? 'assessable-badge' : 'not-assessable-badge';
            
            // Show/hide saved/unsaved indicators
            if (state.hasSavedAssessment) {
                const hasUnsaved = this.stateManager.hasUnsavedChanges(node.id);
                const isSaved = state.savedProofInputs[node.id] !== undefined;
                
                if (this.elements.nodeSavedIndicator) {
                    this.elements.nodeSavedIndicator.style.display = (isSaved && !hasUnsaved) ? 'inline-block' : 'none';
                }
                if (this.elements.nodeUnsavedIndicator) {
                    this.elements.nodeUnsavedIndicator.style.display = hasUnsaved ? 'inline-block' : 'none';
                }
            } else {
                // No saved assessment yet
                if (this.elements.nodeSavedIndicator) {
                    this.elements.nodeSavedIndicator.style.display = 'none';
                }
                if (this.elements.nodeUnsavedIndicator) {
                    this.elements.nodeUnsavedIndicator.style.display = 'none';
                }
            }
            
            // Always show assessment controls for Self Assessments
            // Regardless of assessable status
            if (this.elements.nodeAssessmentControls) {
                this.elements.nodeAssessmentControls.style.display = 'flex';
                
                // Highlight current status if any
                const currentStatus = state.proofInputs[node.id] ?? state.savedProofInputs[node.id] ?? null;        // Javascript shenanigans with int 0
                
                this.elements.statusButtons.forEach(btn => {
                    const btnStatus = parseInt(btn.getAttribute('data-status'));

                    if (currentStatus !== null && currentStatus !== undefined && btnStatus === currentStatus) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }

            this.elements.nodeDetails.style.display = 'block';
            this.elements.domainDetails.style.display = 'none';
        } else {
            this.elements.nodeDetails.style.display = 'none';
        }

        // Domain Details
        if (state.showDomainDetails && state.selectedDomain) {
            const domain = state.selectedDomain;
            this.elements.domainTitle.textContent = `${domain.id}: ${domain.title}`;
            this.elements.domainDesc.textContent = domain.description || 'No description available.';
            this.elements.domainMeta.textContent = `${domain.nodeCount || 0} nodes in this domain`;
            
            // Calculate domain stats for saved and current sessions
            this.renderDomainStats(state, domain);
            
            this.elements.domainDetails.style.display = 'block';
            this.elements.nodeDetails.style.display = 'none';
        } else {
            this.elements.domainDetails.style.display = 'none';
        }
    }

    /**
     * Calculate and render domain statistics for saved and current sessions
     * @param {Object} state - Current state
     * @param {Object} domain - Selected domain
     */
    renderDomainStats(state, domain) {
        // Get node IDs in this domain
        const domainNodeIds = new Set();
        if (state.currentGraph && state.currentGraph.nodes) {
            state.currentGraph.nodes.forEach(node => {
                if (node.domainId === domain.id) {
                    domainNodeIds.add(node.id);
                }
            });
        }

        // Calculate current stats
        let currentWant = 0, currentLearning = 0, currentLearnt = 0, currentTotal = 0;
        Object.entries(state.proofInputs).forEach(([nodeId, status]) => {
            if (domainNodeIds.has(parseInt(nodeId))) {
                currentTotal++;
                if (status === 0) currentWant++;
                else if (status === 1) currentLearning++;
                else if (status === 2) currentLearnt++;
            }
        });

        // Calculate saved stats
        let savedWant = 0, savedLearning = 0, savedLearnt = 0, savedTotal = 0;
        for (let proof of Object.entries(state.savedProofInputs)) {
            const nodeId = proof[0]
            const status = proof[1]

            if (domainNodeIds.has(parseInt(nodeId))) {
                // If current session is overriding this node's saved assessment, then skip
                if (parseInt(nodeId) in state.proofInputs) continue;

                savedTotal++;
                if (status === 0) savedWant++;
                else if (status === 1) savedLearning++;
                else if (status === 2) savedLearnt++;
            }
        };

        // Update DOM
        if (this.elements.domainSavedWant) {
            this.elements.domainSavedWant.textContent = savedWant;
            this.elements.domainSavedLearning.textContent = savedLearning;
            this.elements.domainSavedLearnt.textContent = savedLearnt;
            this.elements.domainSavedTotal.textContent = savedTotal;
            
            this.elements.domainCurrentWant.textContent = currentWant;
            this.elements.domainCurrentLearning.textContent = currentLearning;
            this.elements.domainCurrentLearnt.textContent = currentLearnt;
            this.elements.domainCurrentTotal.textContent = currentTotal;
        }
    }

    /**
     * Helper to escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export singleton pattern or class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AssessmentController };
} else {
    window.AssessmentController = AssessmentController;
}
