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
 * Learning Controller - Orchestrates the learning page
 * Handles page logic, rendering, and contacts other layers (API, State, Graph Controller)
 */
class LearningController {
    constructor(stateManager, transformer) {
        this.stateManager = stateManager;
        this.transformer = transformer;
        this.graphController = null;
        this.elements = {};
        this.handleStateChange = this.handleStateChange.bind(this);
    }

    async init() {
        this.initializeElements();
        this.bindEvents();
        this.stateManager.subscribe(this.handleStateChange);

        const urlParams = UrlParser.parseUrlParameters();

        const currentState = this.stateManager.state;
        if (currentState.currentGraph) {
            this.render();
            return;
        }

        if (urlParams.graph) {
            await this.loadGraphFromUrl(urlParams.graph);
        } else {
            this.showNoGraphView();
        }
    }

    async loadGraphFromUrl(graphUuid) {
        try {
            this.stateManager.setLoading(true);

            if (!UrlParser.isValidUuid(graphUuid)) {
                throw new Error('Invalid graph UUID format in URL parameter');
            }

            const backendSnapshot = await snapshotsApiService.getSnapshotForLearning(graphUuid);
            const transformedData = this.transformer.transformSnapshotFromBackend(backendSnapshot);
            console.log(backendSnapshot, transformedData);
            

            this.stateManager.loadGraph(transformedData);
            this.stateManager.setViewMode('learning');

            UrlParser.updateUrlParameters({ graph: graphUuid }, true);

            console.log('LearningController: Graph loaded from URL parameter', graphUuid);
            
        } catch (error) {
            console.error('LearningController: Failed to load graph from URL parameter', error);
            this.stateManager.setError(`Could not load the requested graph: ${error.message}. Please try again from the Library.`);
            this.showErrorView(this.stateManager.state.error);
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    async exitGraph() {
        const state = this.stateManager.state;
        const graphName = state.currentGraph
            ? (state.currentGraph.baseGraphLabel || state.currentGraph.currentVersionLabel || 'this graph')
            : 'this graph';

        const confirmed = await this.stateManager.showConfirm({
            title: 'Exit Learning View',
            message: `Are you sure you want to exit the learning view for "${graphName}"?`,
            confirmText: 'Exit',
            cancelText: 'Cancel'
        });
        
        if (confirmed) {
            this.stateManager.clearGraph();
            window.location.href = '/academia/library';
        }
    }

    showGraphMetadata() {
        const state = this.stateManager.state;
        if (!state.currentGraph) {
            return;
        }

        const graph = state.currentGraph;

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

        if (this.elements.graphMetadataOverlay) {
            this.elements.graphMetadataOverlay.style.display = 'block';
        }
    }

    closeGraphMetadata() {
        if (this.elements.graphMetadataOverlay) {
            this.elements.graphMetadataOverlay.style.display = 'none';
        }
    }

    openNodeDetailsFromSources() {
        console.log("Not implemented :)");
    }

    initializeElements() {
        this.elements = {
            noGraphMessage: document.getElementById('no-graph-message'),
            loadingMessage: document.getElementById('loading-message'),
            errorMessage: document.getElementById('error-message'),
            errorText: document.getElementById('error-text'),
            graphView: document.getElementById('learning-graph-view'),
            graphContainer: document.getElementById('graph-visualization-container'),
            graphInfoSection: document.getElementById('graph-info-section'),
            graphNameText: document.getElementById('graph-name-text'),
            btnExitGraph: document.getElementById('btn-exit-graph'),
            sourcesPanel: document.getElementById('sources-panel'),
            closeSourcesPanel: document.getElementById('close-sources-panel'),
            sourcesNodeTitle: document.getElementById('sources-node-title'),
            sourcesNodeDescPreview: document.getElementById('sources-node-desc-preview'),
            sourcesList: document.getElementById('sources-list'),
            domainDetails: document.getElementById('domain-details'),
            domainTitle: document.getElementById('domain-detail-title'),
            domainDesc: document.getElementById('domain-detail-desc'),
            domainMeta: document.getElementById('domain-detail-meta'),
            closeDomainBtn: document.getElementById('close-domain-details'),
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
            metadataDomainCount: document.getElementById('metadata-domain-count'),
        
            // Custom Dialog
            dialogOverlay: document.getElementById('custom-dialog-overlay'),
            dialogTitle: document.getElementById('dialog-title'),
            dialogMessage: document.getElementById('dialog-message'),
            dialogConfirm: document.getElementById('dialog-confirm'),
            dialogCancel: document.getElementById('dialog-cancel'),
        };
    }

    bindEvents() {
        if (this.elements.closeSourcesPanel) {
            this.elements.closeSourcesPanel.addEventListener('click', () => {
                this.graphController.handleUnfocus();
            });
        }

        if (this.elements.closeDomainBtn) {
            this.elements.closeDomainBtn.addEventListener('click', () => {
                this.stateManager.closeDomainDetails();
            });
        }

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

        window.addEventListener('resize', () => {
            if (this.graphController) {
                this.graphController.handleResize();
            }
        });
    }

    handleStateChange(state) {
        if (state.isLoading) {
            this.showLoadingView();
        } else if (state.error) {
            this.showErrorView(state.error);
        } else if (state.currentGraph) {
            this.showLearningView();
            this.render();
        } else {
            this.showNoGraphView();
        }

        this.renderDetailPanels();
        this.renderDialog(state);
    }

    render() {
        const state = this.stateManager.state;

        if (state.viewMode === 'learning' && state.currentGraph) {
            this.showLearningView();
        } else if (state.isLoading) {
            this.showLoadingView();
        } else if (state.error) {
            this.showErrorView(state.error);
        }
    }

    showNoGraphView() {
        if (this.elements.noGraphMessage) this.elements.noGraphMessage.style.display = 'block';
        if (this.elements.loadingMessage) this.elements.loadingMessage.style.display = 'none';
        if (this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';
        if (this.elements.graphView) this.elements.graphView.style.display = 'none';
        if (this.elements.graphInfoSection) this.elements.graphInfoSection.style.display = 'none';
    }

    showLoadingView() {
        if (this.elements.noGraphMessage) this.elements.noGraphMessage.style.display = 'none';
        if (this.elements.loadingMessage) this.elements.loadingMessage.style.display = 'block';
        if (this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';
        if (this.elements.graphView) this.elements.graphView.style.display = 'none';
        if (this.elements.graphInfoSection) this.elements.graphInfoSection.style.display = 'none';
    }

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

    showLearningView() {
        if (this.elements.noGraphMessage) this.elements.noGraphMessage.style.display = 'none';
        if (this.elements.loadingMessage) this.elements.loadingMessage.style.display = 'none';
        if (this.elements.errorMessage) this.elements.errorMessage.style.display = 'none';

        if (this.elements.graphView) {
            this.elements.graphView.style.display = 'flex';

            const state = this.stateManager.state;
            if (this.elements.graphInfoSection) {
                this.elements.graphInfoSection.style.display = 'flex';
            }
            if (this.elements.graphNameText && state.currentGraph) {
                const graphName = state.currentGraph.baseGraphLabel || state.currentGraph.currentVersionLabel || 'Unnamed Graph';
                this.elements.graphNameText.textContent = graphName;
            }

            if (!this.graphController && this.elements.graphContainer) {
                this.graphController = new AcademiaGraphController(this.elements.graphContainer, {
                    onNodeClick: (nodeId) => this.stateManager.selectNode(nodeId),
                    onDomainClick: (domainId) => this.stateManager.selectDomain(domainId),
                    onUnfocus: () => {
                        this.stateManager.closeAllPanels();
                    },
                    onPositionChange: (nodeId, position) => {
                    }
                });
            }

            if (this.graphController && state.currentGraph) {
                this.graphController.update(state.currentGraph.graphData);
            }

            this.renderDetailPanels();
        }
    }

    renderDetailPanels() {
        const state = this.stateManager.state;

        if (state.showSourcesPanel && state.selectedNode) {
            const node = state.selectedNode;
            const sources = state.selectedNodeSources || [];

            if (this.elements.sourcesNodeTitle) {
                this.elements.sourcesNodeTitle.textContent = `${node.id}: ${node.title}`;
            }

            if (this.elements.sourcesNodeDescPreview) {
                const desc = node.description || '';
                const truncatedDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
                this.elements.sourcesNodeDescPreview.textContent = truncatedDesc;
            }

            if (this.elements.sourcesList) {
                if (sources.length === 0) {
                    this.elements.sourcesList.innerHTML = '<p class="no-sources-message">No sources attached to this node.</p>';
                } else {
                    this.elements.sourcesList.innerHTML = sources.map(source => this.renderSourceItem(source)).join('');
                }
            }

            this.elements.sourcesPanel.style.display = 'flex';
        } else if (this.elements.sourcesPanel) {
            this.elements.sourcesPanel.style.display = 'none';
        }

        if (state.showDomainDetails && state.selectedDomain) {
            const domain = state.selectedDomain;
            this.elements.domainTitle.textContent = `${domain.id}: ${domain.title}`;
            this.elements.domainDesc.textContent = domain.description || 'No description available.';
            this.elements.domainMeta.textContent = `${domain.nodeCount || 0} nodes in this domain`;

            this.elements.domainDetails.style.display = 'flex';
        } else {
            this.elements.domainDetails.style.display = 'none';
        }
    }

    renderSourceItem(source) {
        const typeIcons = {
            'PDF': '📄',
            'Video': '🎬',
            'Other': '📚'
        };
        const icon = typeIcons[source.type] || typeIcons['Other'];

        let fragment = '';
        if (source.fragmentStart) {
            fragment = source.fragmentEnd
                ? `${source.fragmentStart} - ${source.fragmentEnd}`
                : source.fragmentStart;
            fragment = `<span class="source-fragment">${this.escapeHtml(fragment)}</span>`;
        }

        const yearStr = source.year ? ` (${source.year})` : '';

        let linkHtml = '';
        if (source.url) {
            linkHtml = `<a href="${this.escapeHtml(source.url + (source.fragmentStart ? `#page=${source.fragmentStart}` : ''))}" target="_blank" class="source-link">Open Resource</a>`;
        }

        return `
            <div class="source-item">
                <div class="source-header">
                    <span class="source-icon">${icon}</span>
                    <span class="source-type">${this.escapeHtml(source.type)}</span>
                </div>
                <div class="source-title">${this.escapeHtml(source.title)}</div>
                <div class="source-author">${this.escapeHtml(source.author || 'Unknown author')}${yearStr}</div>
                ${fragment}
                ${linkHtml}
            </div>
        `;
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LearningController };
} else {
    window.LearningController = LearningController;
}