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
 * Gallery Controller - Manages UI interactions and operations for the public gallery
 * Combines UI controller and operations controller for read-only gallery
 */
class GalleryController {
    constructor(stateManager, transformer) {
        this.stateManager = stateManager;
        // Use global API services from scope
        this.transformer = transformer;

        this.visualizer = null;

        // Graph state (local copy for visualization)
        this.graphState = {
            nodes: [],
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
                detailPrereq: document.getElementById('detail-prereq'),
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
        // Parse URL parameters using utility
        const urlParams = UrlParser.parseUrlParameters();
        
        // Load snapshot list
        await this.loadSnapshotList();
        
        // Initialize graph visualizer
        this.initializeVisualizer();
        
        // Load specific graph if UUID provided in URL
        if (urlParams.graph) {
            await this.loadSnapshotFromUrl(urlParams.graph);
        }
    }
    
    /**
     * Load snapshot from URL parameter with error handling
     * @param {string} graphUuid - Graph UUID from URL
     */
    async loadSnapshotFromUrl(graphUuid) {
        try {
            // Check if the graph exists in the snapshot list
            const snapshotExists = this.stateManager.state.snapshotList.some(
                snapshot => snapshot.uuid === graphUuid
            );
            
            if (!snapshotExists) {
                console.warn('Graph UUID not found in public gallery:', graphUuid);
                this.stateManager.showMessage(
                    `The requested graph is not available in the public gallery.`, 
                    'error'
                );
                return;
            }
            
            // Load the snapshot
            await this.loadSnapshot(graphUuid);
            
            console.log('Loaded graph from URL parameter:', graphUuid);
            
        } catch (error) {
            console.error('Failed to load graph from URL parameter:', error);
            this.stateManager.showMessage(
                `Failed to load the requested graph: ${error.message}`, 
                'error'
            );
        }
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
            onPathwayClick: (nodeId, pathwayIndex) =>
                this.handlePathwayClick(nodeId, pathwayIndex),
            // Legacy edge-click hook kept for back-compat.
            onEdgeClick: () => {},
            onPositionChange: (nodeId, position) => this.handlePositionChange(nodeId, position),
            onDomainClick: (domainId) => this.handleDomainClick(domainId),
            onUnfocus: () => this.handleUnfocus()
        });

        console.log('Graph visualizer initialized');
    }

    /**
     * Load snapshot list from API
     */
    async loadSnapshotList() {
        try {
            this.stateManager.setLoadingList(true);
            
            const backendList = await snapshotsApiService.getPublicSnapshots(true);
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
            
            const backendSnapshot = await snapshotsApiService.getPublicSnapshot(publicUuid);
            const frontendSnapshot = this.transformer.transformSnapshotFromBackend(backendSnapshot);
            
            this.stateManager.loadSnapshot(frontendSnapshot);

            // Clear Selections
        this.visualizer.assignable.highlightedNodes.clear();
        this.visualizer.assignable.highlightedDomains.clear();
            
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

        // Update local graph data from state manager
        this.updateGraphData();

        // Apply pathway highlights (controller assigns, visualizer renders)
        this.applyPathwayHighlights();

        // Update visualizer with current graph state
        this.visualizer.updateVisualization(this.graphState);
    }

    /**
     * Update graph data from state manager
     */
    updateGraphData() {
        const graphState = this.stateManager.getGraphState();
        this.graphState.nodes = graphState.nodes || [];
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
     * Apply pathway highlights by writing `(nodeId, pathwayIndex)`
     * pairs to the visualizer's `highlightedPathways` map. The
     * visualizer owns the edge reconstruction and applies the visual
     * highlight itself during the render.
     */
    applyPathwayHighlights() {
        this.visualizer.assignable.highlightedPathways.clear();
        this.nodePathwayIndex.forEach((pathwayIndex, nodeId) => {
            const node = this.graphState.nodes.find(n => n.id === nodeId);
            if (node && node.pathways && pathwayIndex < node.pathways.length) {
                this.visualizer.assignable.highlightedPathways.set(nodeId, pathwayIndex);
            }
        });
    }

    /**
     * Handle a pathway click, cycles through distinct available pathways starting from the reference index
     * @param {Object} edgeData - Edge data of the form {source: {id, type}, target: {id, type}}
     */
    handlePathwayClick(edgeData) {
        const { pathways, referenceIndex } = this.visualizer.getUniqueEdgeContribution(edgeData, true);

        // If no available pathways, return
        if (pathways == null || pathways.length === 0) return;

        let nextIndex = null;
        // If reference index is null, unhighlighted edge clicked, choose the first pathway
        if (referenceIndex == null) nextIndex = 0;
        // Else, cycle to the next pathway
        else nextIndex = (referenceIndex + 1) % pathways.length;

        this.nodePathwayIndex.set(pathways[nextIndex].nodeId, pathways[nextIndex].pathwayIndex);
        this.updateVisualization();

        console.log('Pathway clicked. Cycling and highlighting:',
            this.graphState.nodes.find(n => n.id === pathways[nextIndex].nodeId)?.pathways[pathways[nextIndex].pathwayIndex] || 'undefined',
            ', at index:', pathways[nextIndex].pathwayIndex, ', for target:', pathways[nextIndex].nodeId);
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
                
                // Update URL to reflect selected graph (without page refresh)
                UrlParser.updateUrlParameters({ graph: uuid }, true);
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

        if (this.elements.main.detailPrereq) {
            this.elements.main.detailPrereq.textContent = node.prerequisiteString || 'None';
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
            // Get child domains and nodes in this domain from the full state (not graphState)
            const childDomains = this.stateManager.getChildDomains(domain.id);
            const domainNodes = this.stateManager.getNodesInDomain(domain.id);
            
            let contentHtml = '';
            
            // Show child domains first
            if (childDomains && childDomains.length > 0) {
                contentHtml += `<h4 style="margin: 10px 0 5px 0; color: #5f6368; font-size: 0.85em;">Sub-domains (${childDomains.length})</h4>`;
                contentHtml += childDomains.map(childDomain => `
                    <div class="domain-child-domain-item" data-domain-id="${childDomain.id}">
                        <strong>${childDomain.id}: ${this.escapeHtml(childDomain.title)}</strong>
                    </div>
                `).join('');
            }
            
            // Show nodes
            if (domainNodes && domainNodes.length > 0) {
                if (childDomains.length > 0) {
                    contentHtml += `<h4 style="margin: 15px 0 5px 0; color: #5f6368; font-size: 0.85em;">Nodes (${domainNodes.length})</h4>`;
                }
                contentHtml += domainNodes.map(node => {
                    const assessableBadge = node.assessable ? '<span class="assessable-badge">(assessable)</span>' : '';
                    return `
                        <div class="domain-node-item" data-node-id="${node.id}">
                            <strong>${node.id}: ${this.escapeHtml(node.title)}</strong> ${assessableBadge}
                        </div>
                    `;
                }).join('');
            }
            
            if (contentHtml) {
                this.elements.main.domainDetailNodes.innerHTML = contentHtml;

                // Add click handlers for child domain items
                panel.querySelectorAll('.domain-child-domain-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const domainId = parseInt(item.dataset.domainId);
                        this.handleDomainClick(domainId);
                    });
                });

                // Add click handlers for domain node items
                panel.querySelectorAll('.domain-node-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const nodeId = parseInt(item.dataset.nodeId);
                        this.handleDomainNodeClick(nodeId);
                    });
                });
            } else {
                this.elements.main.domainDetailNodes.innerHTML = '<p style="color: #5f6368; font-style: italic;">No sub-domains or nodes in this domain</p>';
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
        // Clear only node and domain highlights (edge highlights are independent)
        this.visualizer.assignable.highlightedNodes.clear();
        this.visualizer.assignable.highlightedDomains.clear();

        // Highlight clicked node
        this.visualizer.assignable.highlightedNodes.add(nodeId);

        // Re-render to apply highlight
        this.updateVisualization();

        // Show node details
        this.stateManager.closeDomainDetails();
        this.stateManager.selectNode(nodeId);

        console.log('Node clicked and highlighted:', nodeId);
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
        this.stateManager.closeNodeDetails();
        this.stateManager.selectDomain(domainId);

        console.log('Domain clicked and highlighted:', domainId);
    }

    /**
     * Handle unfocus (click on empty space)
     * Closes details panels and clears selections
     */
    handleUnfocus() {
        // Clear highlights
        this.visualizer.assignable.highlightedNodes.clear();
        this.visualizer.assignable.highlightedDomains.clear();

        // Close both node and domain details panels
        this.stateManager.closeNodeDetails();
        this.stateManager.closeDomainDetails();

        this.updateVisualization();
        
        console.log('Unfocused - highlights cleared and details closed');
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
