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
 * Dashboard State Manager
 * Single source of truth for dashboard-related state
 */
class DashboardStateManager {
    constructor() {
        this.state = {
            // Profile
            profile: null,
            profileEditMode: false,
            profileDirty: false,

            // Library
            bookmarks: [], // Array of BookmarkRead objects
            bookmarkedGraphMetadata: [], // Minimal metadata for suggestions
            browseResults: [], // Ephemeral search results
            searchQuery: '',
            searchPagination: { skip: 0, limit: 20, hasMore: false },
            selectedGraph: null, // Full graph data loaded on demand

            // Assessment
            assessmentGraph: null,
            proofInputs: {}, // { nodeId: value }
            currentCapability: null,
            assessmentInProgress: false,

            // Dialog State
            dialog: {
                isOpen: false,
                type: 'alert', // 'alert', 'confirm'
                title: '',
                message: '',
                confirmText: 'OK',
                cancelText: 'Cancel',
                resolve: null
            },

            // Preview Modal
            previewModal: {
                isOpen: false,
                isLoading: false,
                graphData: null,
                selectedNode: null,
                selectedDomain: null
            }
        };

        this.listeners = [];
        this.loadFromLocalStorage();
    }

    // --- State Access ---
    getState() {
        console.log('Getting state:', this.state);
        
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
        this.saveToLocalStorage();
    }

    // --- Observer Pattern ---
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // --- Persistence ---
    saveToLocalStorage() {
        const dataToSave = {
            bookmarkedGraphMetadata: this.state.bookmarkedGraphMetadata
        };
        localStorage.setItem('dashboard_state', JSON.stringify(dataToSave));
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('dashboard_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state.bookmarkedGraphMetadata = parsed.bookmarkedGraphMetadata || [];
            } catch (e) {
                console.error('Failed to load dashboard state from localStorage', e);
            }
        }
    }

    // --- Business Logic ---
    setProfile(profile) {
        this.setState({ profile, profileDirty: false });
    }

    toggleProfileEditMode(enabled) {
        this.setState({ profileEditMode: enabled });
    }

    setBookmarks(bookmarks) {
        this.setState({ bookmarks });
    }

    isBookmarked(graphUuid) {
        return this.state.bookmarks.some(b => b.graph_uuid === graphUuid);
    }

    // --- Preview Modal Management ---

    /**
     * Load graph data and open preview modal
     * @param {string} graphUuid - Public UUID of the graph to preview
     */
    async loadAndOpenPreview(graphUuid) {
        this.setState({
            previewModal: {
                ...this.state.previewModal,
                isOpen: true,
                isLoading: true,
                graphData: null,
                selectedNode: null,
                selectedDomain: null
            }
        });

        try {
            const backendSnapshot = await dashboardApiService.getGraphDetails(graphUuid);
            const transformedSnapshot = galleryTransformer.transformSnapshotFromBackend(backendSnapshot);
            
            this.setState({
                previewModal: {
                    ...this.state.previewModal,
                    isLoading: false,
                    graphData: transformedSnapshot
                }
            });
        } catch (error) {
            console.error('Failed to load graph preview:', error);
            this.setState({
                previewModal: {
                    ...this.state.previewModal,
                    isLoading: false,
                    graphData: null
                }
            });
            this.showAlert('Failed to load graph preview. Please try again.', 'Error');
        }
    }

    /**
     * Close preview modal and clear graph data
     */
    closePreviewModal() {
        this.setState({
            previewModal: {
                isOpen: false,
                isLoading: false,
                graphData: null,
                selectedNode: null,
                selectedDomain: null
            }
        });
    }

    /**
     * Set selected node for preview details panel
     * @param {number} nodeId - Node ID
     */
    setPreviewSelectedNode(nodeId) {
        const graphData = this.state.previewModal.graphData;
        if (!graphData || !graphData.nodes) {
            this.setState({
                previewModal: {
                    ...this.state.previewModal,
                    selectedNode: null,
                    selectedDomain: null
                }
            });
            return;
        }

        const node = graphData.nodes.find(n => n.id === nodeId);
        if (node) {
            this.setState({
                previewModal: {
                    ...this.state.previewModal,
                    selectedNode: {
                        id: node.id,
                        title: node.title,
                        description: node.description || ''
                    },
                    selectedDomain: null
                }
            });
        }
    }

    /**
     * Set selected domain for preview details panel
     * @param {number} domainId - Domain ID
     */
    setPreviewSelectedDomain(domainId) {
        const graphData = this.state.previewModal.graphData;
        if (!graphData || !graphData.domains) {
            this.setState({
                previewModal: {
                    ...this.state.previewModal,
                    selectedNode: null,
                    selectedDomain: null
                }
            });
            return;
        }

        const domain = graphData.domains.find(d => d.id === domainId);
        if (domain) {
            this.setState({
                previewModal: {
                    ...this.state.previewModal,
                    selectedNode: null,
                    selectedDomain: {
                        id: domain.id,
                        title: domain.title,
                        description: domain.description || ''
                    }
                }
            });
        }
    }

    /**
     * Clear preview selection
     */
    clearPreviewSelection() {
        this.setState({
            previewModal: {
                ...this.state.previewModal,
                selectedNode: null,
                selectedDomain: null
            }
        });
    }

    // --- Dialog Management ---

    /**
     * Show custom alert dialog
     * @param {string|Object} message - Alert message or options object { title, message }
     * @param {string} title - Dialog title (default: 'Alert')
     * @returns {Promise<void>} Resolves when dialog is closed
     */
    showAlert(message, title = 'Alert') {
        return new Promise((resolve) => {
            // Handle options object format: { title, message }
            const options = typeof message === 'object' ? message : { message, title };

            this.state.dialog = {
                isOpen: true,
                type: 'alert',
                title: options.title || title,
                message: options.message || message,
                confirmText: options.confirmText || 'OK',
                cancelText: options.cancelText || 'Cancel',
                resolve
            };
            this.notify();
        });
    }

    /**
     * Show custom confirm dialog
     * @param {string|Object} message - Confirm message or options object { title, message, confirmText, cancelText }
     * @param {string} title - Dialog title (default: 'Confirm')
     * @param {Object} dialogOptions - Additional options { confirmText, cancelText }
     * @returns {Promise<boolean>} Resolves with true (confirm) or false (cancel)
     */
    showConfirm(message, title = 'Confirm', dialogOptions = {}) {
        return new Promise((resolve) => {
            // Handle options object format: { title, message, confirmText, cancelText }
            const options = typeof message === 'object' ? message : { message, title, ...dialogOptions };

            this.state.dialog = {
                isOpen: true,
                type: 'confirm',
                title: options.title || title,
                message: options.message || message,
                confirmText: options.confirmText || 'OK',
                cancelText: options.cancelText || 'Cancel',
                resolve
            };
            this.notify();
        });
    }

    /**
     * Close dialog and resolve the promise
     * @param {boolean} result - User response (true for confirm/ok, false for cancel)
     */
    closeDialog(result) {
        const { resolve } = this.state.dialog;
        this.state.dialog = {
            ...this.state.dialog,
            isOpen: false,
            resolve: null
        };
        this.notify();
        if (resolve) {
            resolve(result);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardStateManager };
} else {
    window.DashboardStateManager = DashboardStateManager;
}
