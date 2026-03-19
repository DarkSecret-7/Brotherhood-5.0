/**
 * Gallery UI Controller - Pure display logic for public gallery
 * Handles all UI rendering and visual updates based on state
 */
class GalleryUIController {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.elements = {};
        
        // Initialize DOM element references
        this.initializeElements();
        
        // Subscribe to state changes
        this.stateManager.subscribe(this.render.bind(this));
        
        // Initial render
        this.render();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            // Sidebar elements
            sidebar: document.getElementById('sidebar'),
            graphList: document.getElementById('graph-list'),
            refreshBtn: document.getElementById('refresh-graphs'),
            
            // Main area elements
            graphContainer: document.getElementById('graph-container'),
            toggleSidebarBtn: document.querySelector('.toggle-sidebar-btn'),
            
            // Details panel elements
            nodeDetailsPanel: document.getElementById('node-details'),
            detailTitle: document.getElementById('detail-title'),
            detailMeta: document.getElementById('detail-meta'),
            detailDesc: document.getElementById('detail-desc'),
            detailSources: document.getElementById('detail-sources'),
            closeDetailsBtn: document.querySelector('.close-details'),
            
            // Header elements
            versionIndicator: document.querySelector('.version-indicator')
        };
    }

    /**
     * Main render function - updates UI based on current state
     */
    render() {
        const state = this.stateManager.getState();
        
        this.renderLoadingState(state.isLoading);
        this.renderErrorState(state.error);
        this.renderSidebar(state);
        this.renderGraphContainer(state);
        this.renderDetailsPanel(state);
        this.renderSidebarToggle(state.sidebarCollapsed);
    }

    /**
     * Render loading state
     */
    renderLoadingState(isLoading) {
        if (isLoading) {
            this.showLoadingInGraphList();
        }
    }

    /**
     * Render error state
     */
    renderErrorState(error) {
        if (error && this.elements.graphList) {
            this.elements.graphList.innerHTML = `
                <p style="color: #d93025; padding: 10px;">Error: ${error}</p>
            `;
        }
    }

    /**
     * Render sidebar with snapshot list
     */
    renderSidebar(state) {
        this.renderGraphList(state.publicSnapshots, state.selectedSnapshotLabel);
    }

    /**
     * Render graph list in sidebar
     */
    renderGraphList(snapshots, selectedLabel) {
        if (!this.elements.graphList) return;

        if (snapshots.length === 0) {
            this.elements.graphList.innerHTML = '<p style="padding: 10px; color: #5f6368;">No public graphs available.</p>';
            return;
        }
        
        let html = '';
        snapshots.forEach(snapshot => {
            const date = snapshot.lastUpdated ? snapshot.lastUpdated.toLocaleDateString() : 'Unknown';
            const isActive = snapshot.versionLabel === selectedLabel;
            
            html += `
                <div class="graph-item ${isActive ? 'active' : ''}" data-public-uuid="${snapshot.publicUuid}">
                    <div class="graph-title">${snapshot.versionLabel}</div>
                    <div class="graph-meta">
                        ${snapshot.nodeCount} nodes • Updated ${date}<br>
                        By ${snapshot.createdBy}
                    </div>
                </div>
            `;
        });
        
        this.elements.graphList.innerHTML = html;
        
        // Add click handlers
        const graphItems = this.elements.graphList.querySelectorAll('.graph-item');
        
        graphItems.forEach((item) => {
            item.addEventListener('click', () => this.onGraphItemClicked(item.dataset.publicUuid));
        });
    }

    /**
     * Show loading state in graph list
     */
    showLoadingInGraphList() {
        if (this.elements.graphList) {
            this.elements.graphList.innerHTML = '<p style="text-align: center; color: #5f6368; margin-top: 20px;">Loading...</p>';
        }
    }

    /**
     * Render graph container
     */
    renderGraphContainer(state) {
        // Update version indicator
        if (this.elements.versionIndicator) {
            this.elements.versionIndicator.textContent = 'Read-Only Mode';
        }
        
        // Graph rendering is handled by the visualization component
        // This just ensures the container is properly sized
        if (this.elements.graphContainer && state.currentSnapshot) {
            // Container will be updated by visualization logic
        }
    }

    /**
     * Render details panel
     */
    renderDetailsPanel(state) {
        const { modals, detailsPanel } = state;
        
        if (!this.elements.nodeDetailsPanel) return;
        
        // Show/hide panel
        this.elements.nodeDetailsPanel.style.display = 
            (modals.nodeDetails || modals.domainDetails) ? 'block' : 'none';
        
        // Render content based on type
        if (modals.nodeDetails && detailsPanel.type === 'node') {
            this.renderNodeDetails(detailsPanel.data);
        } else if (modals.domainDetails && detailsPanel.type === 'domain') {
            this.renderDomainDetails(detailsPanel.data);
        }
    }

    /**
     * Render node details
     */
    renderNodeDetails(nodeData) {
        if (!nodeData || !this.elements.detailTitle) return;
        
        this.elements.detailTitle.textContent = nodeData.title;
        this.elements.detailMeta.textContent = nodeData.meta;
        this.elements.detailDesc.textContent = nodeData.description || 'No description provided.';
        
        // Render sources
        this.renderSources(nodeData.sources);
    }

    /**
     * Render domain details
     */
    renderDomainDetails(domainData) {
        if (!domainData || !this.elements.detailTitle) return;
        
        this.elements.detailTitle.textContent = domainData.title;
        this.elements.detailMeta.textContent = domainData.meta;
        this.elements.detailDesc.textContent = domainData.description || 'No description provided.';
        
        // Render domain actions (expand/collapse)
        this.renderDomainActions(domainData);
    }

    /**
     * Render sources list
     */
    renderSources(sources) {
        if (!this.elements.detailSources) return;
        
        // Reset header
        const sourcesHeader = this.elements.detailSources.previousElementSibling;
        if (sourcesHeader && sourcesHeader.tagName === 'H4') {
            sourcesHeader.textContent = 'Sources';
        }
        
        this.elements.detailSources.innerHTML = '';
        
        if (sources && sources.length > 0) {
            sources.forEach(source => {
                const sourceDiv = document.createElement('div');
                sourceDiv.className = 'source-item-row';
                sourceDiv.style.marginBottom = '8px';
                sourceDiv.style.cursor = 'default';
                sourceDiv.innerHTML = `
                    <div class="source-icon">📄</div>
                    <div class="source-main-info">
                        <div class="source-title" title="${source.title}">${source.title}</div>
                        <div class="source-meta-info">
                            ${source.author ? `<span>👤 ${source.author}</span>` : ''}
                            ${source.year ? `<span>📅 ${source.year}</span>` : ''}
                        </div>
                        ${source.url ? `<a href="${source.url}" target="_blank" style="font-size: 0.85em; color: #1a73e8;">Open Link &nearr;</a>` : ''}
                    </div>
                `;
                this.elements.detailSources.appendChild(sourceDiv);
            });
        } else {
            this.elements.detailSources.innerHTML = '<span style="color: #9aa0a6; font-size: 0.9em;">No sources linked.</span>';
        }
    }

    /**
     * Render domain actions
     */
    renderDomainActions(domainData) {
        if (!this.elements.detailSources) return;
        
        // Change header to "Actions"
        const sourcesHeader = this.elements.detailSources.previousElementSibling;
        if (sourcesHeader && sourcesHeader.tagName === 'H4') {
            sourcesHeader.textContent = 'Actions';
        }
        
        this.elements.detailSources.innerHTML = '';
        
        // Add Expand/Collapse Button
        const btn = document.createElement('button');
        btn.style.width = '100%';
        btn.style.padding = '10px';
        btn.style.background = '#f1f3f4';
        btn.style.border = '1px solid #dadce0';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = '500';
        btn.style.color = '#3c4043';
        btn.style.transition = 'background 0.2s';
        
        btn.onmouseover = function() { btn.style.background = '#e8eaed'; };
        btn.onmouseout = function() { btn.style.background = '#f1f3f4'; };
        
        btn.textContent = domainData.isCollapsed ? 'Expand Domain' : 'Collapse Domain';
        
        btn.onclick = () => {
            this.onDomainToggleClicked(domainData.id);
        };
        
        this.elements.detailSources.appendChild(btn);
    }

    /**
     * Render sidebar toggle state
     */
    renderSidebarToggle(isCollapsed) {
        if (this.elements.sidebar) {
            this.elements.sidebar.classList.toggle('collapsed', isCollapsed);
        }
        
        // Update toggle button position
        if (this.elements.toggleSidebarBtn) {
            if (isCollapsed) {
                //this.elements.toggleSidebarBtn.style.left = '16px';
            } else {
                //this.elements.toggleSidebarBtn.style.left = '336px'; // 320px sidebar + 16px margin
            }
        }
    }

    /**
     * Handle graph item click - delegate to operations controller
     */
    onGraphItemClicked(public_uuid) {
        // This will be handled by the operations controller
        // We emit a custom event for the operations controller to handle
        const event = new CustomEvent('galleryGraphItemSelected', {
            detail: { public_uuid }
        });
        document.dispatchEvent(event);
    }

    /**
     * Handle domain toggle click - delegate to operations controller
     */
    onDomainToggleClicked(domainId) {
        // This will be handled by the operations controller
        const event = new CustomEvent('galleryDomainToggleClicked', {
            detail: { domainId }
        });
        document.dispatchEvent(event);
    }

    /**
     * Handle refresh button click - delegate to operations controller
     */
    onRefreshClicked() {
        const event = new CustomEvent('galleryRefreshClicked');
        document.dispatchEvent(event);
    }

    /**
     * Handle close details click - delegate to operations controller
     */
    onCloseDetailsClicked() {
        const event = new CustomEvent('galleryCloseDetailsClicked');
        document.dispatchEvent(event);
    }

    /**
     * Handle sidebar toggle click - delegate to operations controller
     */
    onToggleSidebarClicked() {
        const event = new CustomEvent('galleryToggleSidebarClicked');
        document.dispatchEvent(event);
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Refresh button
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => {
                this.onRefreshClicked();
            });
        }
        
        // Close details button
        if (this.elements.closeDetailsBtn) {
            this.elements.closeDetailsBtn.addEventListener('click', () => {
                this.onCloseDetailsClicked();
            });
        }
        
        // Toggle sidebar button
        if (this.elements.toggleSidebarBtn) {
            this.elements.toggleSidebarBtn.addEventListener('click', () => {
                this.onToggleSidebarClicked();
            });
        }
    }

    /**
     * Initialize the UI controller
     */
    initialize() {
        this.setupEventListeners();
        this.render();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GalleryUIController };
} else {
    window.GalleryUIController = GalleryUIController;
}

