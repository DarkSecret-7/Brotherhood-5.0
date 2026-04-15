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

        // Graph state (local copy for visualization)
        this.graphState = {
            nodes: [],
            edges: [],
            cycles: [],
            domains: []
        };

        // Track active pathway index for each node
        this.nodePathwayIndex = new Map();

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
                // Node details panel
                nodeDetails: document.getElementById('node-details'),
                closeDetails: document.querySelector('.close-details'),
                detailTitle: document.getElementById('detail-title'),
                detailMeta: document.getElementById('detail-meta'),
                detailDesc: document.getElementById('detail-desc'),
                detailSources: document.getElementById('detail-sources'),
                // Domain details panel
                domainDetails: document.getElementById('domain-details'),
                closeDomainDetails: document.getElementById('close-domain-details'),
                domainDetailTitle: document.getElementById('domain-detail-title'),
                domainDetailMeta: document.getElementById('domain-detail-meta'),
                domainDetailDesc: document.getElementById('domain-detail-desc'),
                domainDetailNodes: document.getElementById('domain-detail-nodes')
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

        // Close domain details panel
        if (this.elements.main.closeDomainDetails) {
            this.elements.main.closeDomainDetails.addEventListener('click', () => {
                this.stateManager.closeDomainDetails();
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
     * Update graph data from state manager
     */
    updateGraphData() {
        const graphState = this.stateManager.getGraphState();
        this.graphState.nodes = graphState.nodes || [];
        this.graphState.edges = graphState.edges || [];
        this.graphState.cycles = graphState.cycles || [];
        this.graphState.domains = graphState.domains || [];

        // Initialize pathway indices for all nodes with pathways to 0
        this.graphState.nodes.forEach(node => {
            if (node.pathways && node.pathways.length > 0 && !this.nodePathwayIndex.has(node.id)) {
                this.nodePathwayIndex.set(node.id, 0);
            }
        });
    }

    /**
     * Update graph visualization
     */
    updateVisualization() {
        if (!this.visualizer) {
            console.warn('Visualizer not initialized');
            return;
        }

        // Update local graph data from state manager
        this.updateGraphData();

        // Apply pathway highlights (controller assigns, visualizer renders)
        this.applyPathwayHighlights();

        // Update visualizer with current graph state
        this.visualizer.updateVisualization(this.graphState);
    }

    /**
     * Apply pathway edge highlights based on nodePathwayIndex
     * Called by updateVisualization to set highlighted edges
     */
    applyPathwayHighlights() {
        this.visualizer.assignable.highlightedEdges.clear();

        // For each node with an active pathway, highlight ALL edges in that pathway
        this.nodePathwayIndex.forEach((pathwayIndex, nodeId) => {
            const node = this.graphState.nodes.find(n => n.id === nodeId);
            if (node && node.pathways && node.pathways.length > pathwayIndex) {
                const activePathway = node.pathways[pathwayIndex]; // Array of edge IDs
                // Highlight all edges in this pathway
                activePathway.forEach(edgeId => {
                    const edgeIndex = this.getEdgeIndex(edgeId);
                    if (edgeIndex !== -1) {
                        this.visualizer.assignable.highlightedEdges.add(edgeIndex);
                    }
                });
            }
        });
    }

    /**
     * Get the edge index from an edge ID
     * @param {string} edgeId - Edge ID (e.g., "1-5")
     * @returns {number} Edge index or -1 if not found
     */
    getEdgeIndex(edgeId) {
        return this.graphState.edges.findIndex(e => e.id === edgeId);
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

        // Update domain details panel
        this.updateDomainDetailsPanel(state.selectedDomain, state.showDomainDetails);

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
                    const url = source.url ? `<a href="${source.url}" target="_blank" rel="noopener noreferrer" class="source-link-btn">🔗</a>` : '';

                    return `
                        <div class="source-item-row">
                            <div class="source-main-info">
                                <div class="source-title">${this.escapeHtml(title)}</div>
                                <div class="source-meta-info">
                                    ${author ? `<span>${this.escapeHtml(author)}</span>` : ''}
                                    ${year ? `<span>(${year})</span>` : ''}
                                </div>
                                ${url ? `<div class="source-link-wrap">${url}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
                this.elements.main.detailSources.innerHTML = sourcesHtml;
            } else {
                this.elements.main.detailSources.innerHTML = '<span class="no-sources-text">No sources linked.</span>';
            }
        }

        panel.style.display = 'block';
    }

    /**
     * Update domain details panel
     * @param {Object} domain - Selected domain
     * @param {boolean} show - Whether to show panel
     */
    updateDomainDetailsPanel(domain, show) {
        const panel = this.elements.main.domainDetails;
        if (!panel) return;

        if (!show || !domain) {
            panel.style.display = 'none';
            return;
        }

        // Populate panel
        if (this.elements.main.domainDetailTitle) {
            this.elements.main.domainDetailTitle.textContent = `${domain.id}: ${domain.title}`;
        }

        if (this.elements.main.domainDetailMeta) {
            const nodeCount = domain.nodeCount || 0;
            const assessableCount = domain.assessableNodeCount || 0;
            const parentText = domain.parentId ? `Child of Domain #${domain.parentId}` : 'Top-level Domain';
            this.elements.main.domainDetailMeta.textContent = `${nodeCount} nodes (${assessableCount} assessable) | ${parentText}`;
        }

        if (this.elements.main.domainDetailDesc) {
            this.elements.main.domainDetailDesc.textContent = domain.description || 'No description';
        }

        if (this.elements.main.domainDetailNodes) {
            // Get all nodes in this domain from the full state (not graphState)
            const domainNodes = this.stateManager.getNodesInDomain(domain.id);
            if (domainNodes && domainNodes.length > 0) {
                const nodesHtml = domainNodes.map(node => {
                    const assessableBadge = node.assessable ? '<span class="assessable-badge">(assessable)</span>' : '';
                    return `
                        <div class="domain-node-item" data-node-id="${node.id}">
                            <strong>${node.id}: ${this.escapeHtml(node.title)}</strong> ${assessableBadge}
                        </div>
                    `;
                }).join('');
                this.elements.main.domainDetailNodes.innerHTML = nodesHtml;

                // Add click handlers for domain node items
                panel.querySelectorAll('.domain-node-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const nodeId = parseInt(item.dataset.nodeId);
                        this.handleDomainNodeClick(nodeId);
                    });
                });
            } else {
                this.elements.main.domainDetailNodes.innerHTML = '<p style="color: #5f6368; font-style: italic;">No nodes in this domain</p>';
            }
        }

        panel.style.display = 'block';
    }

    /**
     * Handle node click from domain details panel
     * @param {number} nodeId - Node ID
     */
    handleDomainNodeClick(nodeId) {
        // Close domain details and show node details
        this.stateManager.closeDomainDetails();
        this.handleNodeClick(nodeId);
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
        console.log(nodeId, typeof nodeId);
        
        // Clear only node and domain highlights (edge highlights are independent)
        this.visualizer.assignable.highlightedNodes.clear();
        this.visualizer.assignable.highlightedDomains.clear();

        // Highlight clicked node
        this.visualizer.assignable.highlightedNodes.add(nodeId);

        // Re-render to apply highlight
        this.updateVisualization();

        // Show node details
        this.stateManager.selectNode(nodeId);

        console.log('Node clicked and highlighted:', nodeId);
    }

    /**
     * Handle edge click from visualizer
     * @param {number} edgeIndex - Edge index (from vis.js)
     */
    handleEdgeClick(edgeIndex) {
        console.log('Edge clicked:', edgeIndex);

        // Get the edge from the graph state
        const edge = this.graphState.edges[edgeIndex];
        if (!edge) return;

        // Find the target node of this edge
        const targetNodeId = edge.to;
        const targetNode = this.graphState.nodes.find(n => n.id === targetNodeId);
        if (!targetNode || !targetNode.pathways || targetNode.pathways.length === 0) return;

        // Find which pathway this edge belongs to
        const edgeId = edge.id;
        let pathwayIndex = -1;
        for (let i = 0; i < targetNode.pathways.length; i++) {
            if (targetNode.pathways[i].includes(edgeId)) {
                pathwayIndex = i;
                break;
            }
        }
        if (pathwayIndex === -1) return; // Edge not in any pathway

        // Get current pathway index for this node (always initialized to 0)
        let currentIndex = this.nodePathwayIndex.get(targetNodeId) || 0;

        // If clicking a different pathway edge, switch to it; otherwise cycle
        if (currentIndex !== pathwayIndex) {
            currentIndex = pathwayIndex;
        } else {
            // Cycle to the next pathway index
            currentIndex = (currentIndex + 1) % targetNode.pathways.length;
        }

        this.nodePathwayIndex.set(targetNodeId, currentIndex);

        // Re-render to apply highlights (updateVisualization handles edge highlighting)
        this.updateVisualization();

        console.log(`Showing pathway ${currentIndex + 1}/${targetNode.pathways.length} for node ${targetNodeId}`);
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
        // Clear any existing domain highlights
        this.visualizer.assignable.highlightedDomains.clear();

        // Highlight clicked domain
        this.visualizer.assignable.highlightedDomains.add(domainId);

        // Re-render to apply highlight
        this.updateVisualization();

        // Show domain details panel
        this.stateManager.selectDomain(domainId);

        console.log('Domain clicked and highlighted:', domainId);
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
