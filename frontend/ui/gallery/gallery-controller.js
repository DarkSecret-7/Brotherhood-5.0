/**
 * Gallery Controller - Manages UI interactions and operations for the public gallery
 * Combines UI controller and operations controller for read-only gallery
 */
class GalleryController {
    constructor(stateManager, apiService, transformer) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        this.transformer = transformer;
        
        this.visualizer = null;
        this.initializeElements();
        this.bindEventListeners();
        
        // Subscribe to state changes
        this.stateManager.subscribe(this.handleStateChange.bind(this));
        
        // Initialize
        this.initializeGallery();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            sidebar: {
                graphList: document.getElementById('graph-list'),
                refreshBtn: document.getElementById('refresh-graphs'),
                toggleBtn: document.querySelector('.toggle-sidebar-btn')
            },
            main: {
                graphContainer: document.getElementById('graph-container'),
                nodeDetails: document.getElementById('node-details'),
                closeDetails: document.querySelector('.close-details'),
                detailTitle: document.getElementById('detail-title'),
                detailMeta: document.getElementById('detail-meta'),
                detailDesc: document.getElementById('detail-desc'),
                detailSources: document.getElementById('detail-sources')
            }
        };
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Refresh button
        if (this.elements.sidebar.refreshBtn) {
            this.elements.sidebar.refreshBtn.addEventListener('click', () => {
                this.loadSnapshotList();
            });
        }

        // Toggle sidebar button
        if (this.elements.sidebar.toggleBtn) {
            this.elements.sidebar.toggleBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Close node details panel
        if (this.elements.main.closeDetails) {
            this.elements.main.closeDetails.addEventListener('click', () => {
                this.stateManager.closeNodeDetails();
            });
        }

        // Window resize
        window.addEventListener('resize', () => {
            if (this.visualizer) {
                this.visualizer.handleResize();
            }
        });
    }

    /**
     * Initialize gallery
     */
    async initializeGallery() {
        // Load snapshot list
        await this.loadSnapshotList();
        
        // Initialize graph visualizer
        this.initializeVisualizer();
    }

    /**
     * Initialize graph visualizer
     */
    initializeVisualizer() {
        if (!this.elements.main.graphContainer) {
            console.error('Graph container not found');
            return;
        }

        this.visualizer = new GraphVisualizer(this.elements.main.graphContainer, {
            onNodeClick: (nodeId) => this.handleNodeClick(nodeId),
            onEdgeClick: (edgeId) => this.handleEdgeClick(edgeId),
            onPositionChange: (nodeId, position) => this.handlePositionChange(nodeId, position),
            onDomainClick: (domainId) => this.handleDomainClick(domainId)
        });

        console.log('Graph visualizer initialized');
    }

    /**
     * Load snapshot list from API
     */
    async loadSnapshotList() {
        try {
            this.stateManager.setLoadingList(true);
            
            const backendList = await this.apiService.getPublicGallerySnapshots();
            const frontendList = this.transformer.transformSnapshotListFromBackend(backendList);
            
            this.stateManager.loadSnapshotList(frontendList);
            this.renderSnapshotList();
            
        } catch (error) {
            console.error('Failed to load snapshot list:', error);
            this.stateManager.setError(error.message);
            this.renderSnapshotListError(error.message);
        } finally {
            this.stateManager.setLoadingList(false);
        }
    }

    /**
     * Load specific snapshot for viewing
     * @param {string} publicUuid - Public UUID of the snapshot
     */
    async loadSnapshot(publicUuid) {
        try {
            this.stateManager.setLoading(true);
            
            const backendSnapshot = await this.apiService.getPublicGallerySnapshot(publicUuid);
            const frontendSnapshot = this.transformer.transformSnapshotFromBackend(backendSnapshot);
            
            this.stateManager.loadSnapshot(frontendSnapshot);
            
            // Update visualization
            this.updateVisualization();
            
            // Update UI to show selected snapshot
            this.highlightSelectedSnapshot(publicUuid);
            
        } catch (error) {
            console.error('Failed to load snapshot:', error);
            this.stateManager.setError(error.message);
            this.stateManager.showMessage(`Failed to load snapshot: ${error.message}`, 'error');
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    /**
     * Update graph visualization
     */
    updateVisualization() {
        if (!this.visualizer) {
            console.warn('Visualizer not initialized');
            return;
        }

        const graphState = this.stateManager.getGraphState();
        
        this.visualizer.updateVisualization({
            nodes: graphState.nodes,
            edges: graphState.edges,
            domains: graphState.domains,
            defaultPositions: graphState.defaultPositions
        });
    }

    /**
     * Render snapshot list in sidebar
     */
    renderSnapshotList() {
        const listContainer = this.elements.sidebar.graphList;
        if (!listContainer) return;

        const snapshotList = this.stateManager.state.snapshotList;
        
        if (snapshotList.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #5f6368; margin-top: 20px;">No public graphs available</p>';
            return;
        }

        const html = snapshotList.map(snapshot => {
            const isSelected = snapshot.uuid === this.stateManager.state.currentSnapshotUuid;
            const authors = snapshot.authors.map(a => a.username).join(', ') || 'Unknown';
            const dateStr = snapshot.lastUpdated ? snapshot.lastUpdated.toLocaleDateString() : 'Unknown';
            
            return `
                <div class="graph-item ${isSelected ? 'active' : ''}" data-uuid="${snapshot.uuid}">
                    <div class="graph-title">${this.escapeHtml(snapshot.versionLabel || 'Untitled')}</div>
                    <div class="graph-meta">
                        <span>${snapshot.nodeCount} nodes</span><br>
                        <span>${dateStr}</span><br>
                        <span>By: ${this.escapeHtml(authors)}</span>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = html;

        // Add click handlers
        listContainer.querySelectorAll('.graph-item').forEach(item => {
            item.addEventListener('click', () => {
                const uuid = item.dataset.uuid;
                this.loadSnapshot(uuid);
            });
        });
    }

    /**
     * Render snapshot list error
     * @param {string} errorMessage - Error message
     */
    renderSnapshotListError(errorMessage) {
        const listContainer = this.elements.sidebar.graphList;
        if (!listContainer) return;

        listContainer.innerHTML = `
            <p style="text-align: center; color: #d93025; margin-top: 20px;">
                Failed to load graphs<br>
                <small>${this.escapeHtml(errorMessage)}</small>
            </p>
        `;
    }

    /**
     * Highlight selected snapshot in list
     * @param {string} publicUuid - Public UUID of selected snapshot
     */
    highlightSelectedSnapshot(publicUuid) {
        const items = this.elements.sidebar.graphList.querySelectorAll('.graph-item');
        items.forEach(item => {
            if (item.dataset.uuid === publicUuid) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Handle state changes
     * @param {Object} state - Current state
     */
    handleStateChange(state) {
        // Update node details panel
        this.updateNodeDetailsPanel(state.selectedNode, state.showNodeDetails);
        
        // Update loading state
        this.updateLoadingState(state.isLoading);
    }

    /**
     * Update node details panel
     * @param {Object} node - Selected node
     * @param {boolean} show - Whether to show panel
     */
    updateNodeDetailsPanel(node, show) {
        const panel = this.elements.main.nodeDetails;
        if (!panel) return;

        if (!show || !node) {
            panel.style.display = 'none';
            return;
        }

        // Populate panel
        if (this.elements.main.detailTitle) {
            this.elements.main.detailTitle.textContent = `${node.id}: ${node.title}`;
        }
        
        if (this.elements.main.detailMeta) {
            const assessableText = node.assessable ? 'Assessable' : 'Not Assessable';
            const domainText = node.domainId ? `Domain #${node.domainId}` : 'No Domain';
            this.elements.main.detailMeta.textContent = `${assessableText} | ${domainText}`;
        }
        
        if (this.elements.main.detailDesc) {
            this.elements.main.detailDesc.textContent = node.description || 'No description';
        }
        
        if (this.elements.main.detailSources) {
            if (node.sources && node.sources.length > 0) {
                const sourcesHtml = node.sources.map(source => {
                    const title = source.title || 'Untitled';
                    const author = source.author || 'Unknown';
                    const year = source.year || 'n.d.';
                    const url = source.url ? `<a href="${source.url}" target="_blank" rel="noopener noreferrer">Link</a>` : '';
                    
                    return `
                        <div class="source-item">
                            <strong>${this.escapeHtml(title)}</strong><br>
                            <small>${this.escapeHtml(author)} (${year})</small>
                            ${url ? `<br>${url}` : ''}
                        </div>
                    `;
                }).join('');
                this.elements.main.detailSources.innerHTML = sourcesHtml;
            } else {
                this.elements.main.detailSources.innerHTML = '<p style="color: #5f6368; font-style: italic;">No sources</p>';
            }
        }

        panel.style.display = 'block';
    }

    /**
     * Update loading state
     * @param {boolean} isLoading - Loading state
     */
    updateLoadingState(isLoading) {
        const listContainer = this.elements.sidebar.graphList;
        if (!listContainer) return;

        // Only update list UI if the list itself is being loaded, not when loading a snapshot
        if (this.stateManager.state.isLoadingList) {
            if (isLoading) {
                listContainer.innerHTML = '<p style="text-align: center; color: #5f6368; margin-top: 20px;">Loading...</p>';
            }
        }
        // When loading a snapshot, don't touch the list UI at all
    }

    /**
     * Handle node click from visualizer
     * @param {number} nodeId - Node ID
     */
    handleNodeClick(nodeId) {
        this.stateManager.selectNode(nodeId);
    }

    /**
     * Handle edge click from visualizer
     * @param {number} edgeId - Edge ID
     */
    handleEdgeClick(edgeId) {
        console.log('Edge clicked:', edgeId);
        // Could show edge details in the future
    }

    /**
     * Handle position change from visualizer
     * @param {number} nodeId - Node ID
     * @param {Object} position - New position {x, y}
     */
    handlePositionChange(nodeId, position) {
        this.stateManager.updateGraphPosition(nodeId, position);
    }

    /**
     * Handle domain click from visualizer
     * @param {number} domainId - Domain ID
     */
    handleDomainClick(domainId) {
        console.log('Domain clicked:', domainId);
        const domain = this.stateManager.getDomainById(domainId);
        if (domain) {
            this.stateManager.showMessage(`Domain: ${domain.title} (${domain.nodeCount} nodes)`, 'info');
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Destroy the controller and clean up resources
     */
    destroy() {
        if (this.visualizer) {
            this.visualizer.destroy();
            this.visualizer = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GalleryController;
} else {
    window.GalleryController = GalleryController;
}
