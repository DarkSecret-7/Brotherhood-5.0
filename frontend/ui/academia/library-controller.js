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
 * Library Controller
 * Manages bookmarks and public graph browsing
 */
class LibraryController {
    constructor(academiaStateManager) {
        this.stateManager = academiaStateManager;
        // Use global API services from scope
        this.container = document.getElementById('library-content');
        this.activeTab = 'bookmarks'; // 'bookmarks' or 'browse'
        this.currentPreviewGraphUuid = null;
        
        // Bind button event handlers
        this.bindPreviewModalEvents();
    }

    async init() {
        this.stateManager.subscribe(this.render.bind(this));
        
        // Initialize modal as hidden
        this.initializePreviewModal();
        
        // Subscribe to state changes for preview modal
        this.stateManager.subscribe(this.handlePreviewModalState.bind(this));
        
        // First load cached bookmarks from localStorage for instant display
        this.loadCachedBookmarks();
        
        // Then fetch fresh data from API
        await this.loadBookmarks();
    }

    /**
     * Load cached bookmarks from localStorage
     */
    loadCachedBookmarks() {
        try {
            const cached = localStorage.getItem('library_bookmarks_cache');
            if (cached) {
                const bookmarks = JSON.parse(cached);
                this.stateManager.setBookmarks(bookmarks);
                console.log('LibraryController: Loaded cached bookmarks from localStorage');
            }
        } catch (e) {
            console.error('Failed to load cached bookmarks', e);
        }
    }

    /**
     * Save bookmarks to localStorage cache
     */
    saveBookmarksToCache(bookmarks) {
        try {
            localStorage.setItem('library_bookmarks_cache', JSON.stringify(bookmarks));
        } catch (e) {
            console.error('Failed to save bookmarks to cache', e);
        }
    }

    async loadBookmarks() {
        try {
            const bookmarks = await usersApiService.getBookmarks();
            this.stateManager.setBookmarks(bookmarks);
            // Cache for instant loading on next visit
            this.saveBookmarksToCache(bookmarks);
        } catch (error) {
            console.error('Failed to load bookmarks', error);
        }
    }

    /**
     * Hard refresh - force reload from API and clear cache
     */
    async refreshBookmarks() {
        try {
            // Clear cache first
            localStorage.removeItem('library_bookmarks_cache');
            // Show loading state
            this.stateManager.setState({ bookmarks: [], isLoading: true });
            // Fetch fresh data
            await this.loadBookmarks();
            this.stateManager.setState({ isLoading: false });
        } catch (error) {
            console.error('Failed to refresh bookmarks', error);
            this.stateManager.setState({ isLoading: false });
        }
    }

    async switchTab(tab) {
        this.activeTab = tab;
        if (tab === 'browse' && this.stateManager.getState().browseResults.length === 0) {
            await this.searchGraphs();
        }
        this.render(this.stateManager.getState());
    }

    async searchGraphs(query = '') {
        try {
            const results = await snapshotsApiService.getSnapshots({ publicOnly: true, limit: 20 });
            this.stateManager.setState({ browseResults: results });
        } catch (error) {
            console.error('Search failed', error);
        }
    }

    async toggleBookmark(graphUuid) {
        const isBookmarked = this.stateManager.isBookmarked(graphUuid);
        try {
            if (isBookmarked) {
                await usersApiService.deleteBookmark(graphUuid);
            } else {
                await usersApiService.createBookmark(graphUuid);
            }
            await this.loadBookmarks(); // Refresh list
        } catch (error) {
            console.error('Failed to toggle bookmark', error);
            alert('Action failed.');
        }
    }

    render(state) {
        // Update tab button active states
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            if (this.activeTab === 'bookmarks' && btn.innerText.includes('Bookmarks')) {
                btn.classList.add('active');
            } else if (this.activeTab === 'browse' && btn.innerText.includes('Browse')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Show/hide sections
        const bookmarksSection = document.getElementById('bookmarks-section');
        const browseSection = document.getElementById('browse-section');
        
        if (bookmarksSection) {
            bookmarksSection.style.display = this.activeTab === 'bookmarks' ? 'block' : 'none';
        }
        if (browseSection) {
            browseSection.style.display = this.activeTab === 'browse' ? 'block' : 'none';
        }

        // Render content into appropriate container
        let contentHtml = '';
        if (this.activeTab === 'bookmarks') {
            contentHtml = this.renderBookmarks(state.bookmarks);
            const contentContainer = document.getElementById('library-content');
            if (contentContainer) contentContainer.innerHTML = contentHtml;
        } else {
            contentHtml = this.renderBrowse(state.browseResults);
            const contentContainer = document.getElementById('browse-content');
            if (contentContainer) contentContainer.innerHTML = contentHtml;
        }
    }

    renderBookmarks(bookmarks) {
        if (bookmarks.length === 0 && !this.stateManager.getState().isLoading) {
            return `
                <div class="card" style="text-align: center; padding: 40px;">
                    <p>You have no bookmarks. Go to 'Browse' to find graphs to follow!</p>
                </div>
            `;
        }

        if (bookmarks.length === 0) {
            return `<div class="card" style="text-align: center; padding: 40px;"><p>Loading bookmarks...</p></div>`;
        }

        console.log(bookmarks);

        return `
            <div class="graph-grid">
                ${bookmarks.map(b => `
                    <div class="graph-card">
                        <h3>${b.graph_meta.version_label}</h3>
                        <p>Bookmarked on: ${new Date(b.created_at).toLocaleDateString()}</p>
                        <div class="card-actions">
                            <button class="btn btn-primary" onclick="window.location.href='/academia/assessment?graph=${b.graph_uuid}'">Assess</button>
                            <button class="btn btn-outline" onclick="academiaStateManager.loadAndOpenPreview('${b.graph_uuid}')">Preview</button>
                            <button class="btn btn-danger" onclick="libraryController.toggleBookmark('${b.graph_uuid}')">Remove</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderBrowse(results) {
        return `
            <div class="search-box card">
                <input type="text" placeholder="Search graphs (WIP)..." onkeyup="if(event.key==='Enter') libraryController.searchGraphs(this.value)">
            </div>
            <div class="graph-grid">
                ${results.map(g => `
                    <div class="graph-card">
                        <h3>${g.version_label}</h3>
                        <p>Authors: ${this.extractAuthors(g.authors)}</p>
                        <p>Nodes: ${g.node_count}, Assessable: ${g.assessable_node_count}</p>
                        <div class="card-actions">
                            <button class="btn btn-outline" onclick="academiaStateManager.loadAndOpenPreview('${g.public_uuid}')">Preview</button>
                            <button class="btn ${this.stateManager.isBookmarked(g.public_uuid) ? 'btn-danger' : 'btn-primary'}"
                                    onclick="libraryController.toggleBookmark('${g.public_uuid}')">
                                ${this.stateManager.isBookmarked(g.public_uuid) ? 'Remove Bookmark' : 'Bookmark'}
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    extractAuthors(authors) {
        if (!authors || authors.length === 0) {
            return 'None';
        }

        return authors.map(a => a.username).join(', ');
    }

    /**
     * Initialize preview modal as hidden
     */
    initializePreviewModal() {
        const modalOverlay = document.getElementById('preview-modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    }

    /**
     * Handle preview modal state changes
     */
    handlePreviewModalState(state) {
        if (!state.previewModal) return;

        const modalOverlay = document.getElementById('preview-modal-overlay');
        const loadingElement = document.getElementById('preview-loading');
        const graphNameElement = document.getElementById('preview-graph-name');
        const graphUuidElement = document.getElementById('preview-graph-uuid');
        
        if (state.previewModal.isOpen) {
            modalOverlay.style.display = 'flex';
            if (state.previewModal.isLoading) {
                loadingElement.style.display = 'block';
                // Clear previous titles while loading
                if (graphNameElement) graphNameElement.textContent = '';
                if (graphUuidElement) graphUuidElement.textContent = '';
            } else {
                loadingElement.style.display = 'none';
                // Set graph titles when data is available
                this.updatePreviewTitles(state.previewModal);
            }
        } else {
            modalOverlay.style.display = 'none';
        }

        // Update graph when data is available
        if (state.previewModal.graphData && !state.previewModal.isLoading) {
            if (window.academiaGraphController) {
                window.academiaGraphController.update(state.previewModal.graphData);
            }
        }
    }

    /**
     * Update preview modal titles with graph information
     */
    updatePreviewTitles(previewModal) {
        const graphNameElement = document.getElementById('preview-graph-name');
        const graphUuidElement = document.getElementById('preview-graph-uuid');

        if (graphNameElement) {
            graphNameElement.textContent = previewModal.graphName || 'Unknown Graph';
        }

        if (graphUuidElement) {
            graphUuidElement.textContent = previewModal.graphUuid || 'Unknown UUID';
        }

        // Store current graph UUID and update button states
        this.currentPreviewGraphUuid = previewModal.graphUuid;
        this.updatePreviewButtons(previewModal.graphUuid);
    }

    /**
     * Bind preview modal button event handlers
     */
    bindPreviewModalEvents() {
        const bookmarkBtn = document.getElementById('preview-bookmark-btn');
        const assessBtn = document.getElementById('preview-assess-btn');

        if (bookmarkBtn) {
            bookmarkBtn.addEventListener('click', () => this.handlePreviewBookmark());
        }

        if (assessBtn) {
            assessBtn.addEventListener('click', () => this.handlePreviewAssess());
        }
    }

    /**
     * Handle bookmark button click in preview modal
     */
    async handlePreviewBookmark() {
        if (!this.currentPreviewGraphUuid) return;

        try {
            await this.toggleBookmark(this.currentPreviewGraphUuid);
            // Update button states after bookmark toggle
            this.updatePreviewButtons(this.currentPreviewGraphUuid);
        } catch (error) {
            console.error('Failed to toggle bookmark from preview:', error);
        }
    }

    /**
     * Handle assess button click in preview modal
     */
    handlePreviewAssess() {
        if (!this.currentPreviewGraphUuid) return;

        // Navigate to assessment page with graph UUID as URL parameter
        window.location.href = `/academia/assessment?graph=${this.currentPreviewGraphUuid}`;
    }

    /**
     * Update preview modal button states based on bookmark status
     */
    updatePreviewButtons(graphUuid) {
        const bookmarkBtn = document.getElementById('preview-bookmark-btn');
        const assessBtn = document.getElementById('preview-assess-btn');

        if (!bookmarkBtn || !assessBtn) return;

        const isBookmarked = this.stateManager.isBookmarked(graphUuid);

        if (isBookmarked) {
            bookmarkBtn.textContent = 'Remove Bookmark';
            bookmarkBtn.className = 'btn btn-danger btn-sm';
            assessBtn.style.display = 'inline-block';
        } else {
            bookmarkBtn.textContent = 'Bookmark';
            bookmarkBtn.className = 'btn btn-primary btn-sm';
            assessBtn.style.display = 'none';
        }
    }
}
