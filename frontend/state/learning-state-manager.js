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
 * Learning State Manager - Pure state storage for the learning page
 * ONLY stores and manipulates state. NEVER renders.
 */
class LearningStateManager {
    constructor() {
        this.state = {
            currentGraph: null,
            viewMode: 'list',
            isLoading: false,
            error: null,
            selectedNode: null,
            showNodeDetails: false,
            selectedDomain: null,
            showDomainDetails: false,
            selectedNodeSources: [],
            showSourcesPanel: false
        };

        this.subscribers = [];

        // Dialog state
        this.state.dialog = {
            isOpen: false,
            title: '',
            message: '',
            type: 'confirm', // 'confirm' | 'alert'
            confirmText: 'OK',
            cancelText: 'Cancel',
            resolve: null
        }
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        callback(this.state);
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    notify() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Error in LearningStateManager subscriber:', error);
            }
        });
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    loadGraph(graphData) {
        this.setState({
            currentGraph: graphData,
            selectedNode: null,
            showNodeDetails: false,
            selectedDomain: null,
            showDomainDetails: false,
            selectedNodeSources: [],
            showSourcesPanel: false,
            error: null
        });
    }

    clearGraph() {
        this.setState({
            currentGraph: null,
            viewMode: 'list',
            selectedNode: null,
            showNodeDetails: false,
            selectedDomain: null,
            showDomainDetails: false,
            selectedNodeSources: [],
            showSourcesPanel: false,
            error: null
        });
    }

    setLoading(isLoading) {
        this.setState({ isLoading });
    }

    setError(error) {
        this.setState({ error });
    }

    setViewMode(mode) {
        this.setState({ viewMode: mode });
    }

    closeAllPanels() {
        this.setState({
            showSourcesPanel: false,
            showNodeDetails: false,
            showDomainDetails: false,
            selectedNode: null,
            selectedNodeSources: [],
            selectedDomain: null
        });
    }

    selectNode(nodeId) {
        if (!this.state.currentGraph) return;

        const node = this.state.currentGraph.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const sources = node.sources || [];

        this.setState({
            selectedNode: node,
            selectedNodeSources: sources,
            showSourcesPanel: true,
            showNodeDetails: false,
            showDomainDetails: false,
            selectedDomain: null
        });
    }

    clearNodeSelection() {
        this.setState({
            selectedNode: null,
            selectedNodeSources: [],
            showSourcesPanel: false
        });
    }

    showNodeDetails() {
        if (this.state.selectedNode) {
            this.setState({
                showNodeDetails: true,
                showSourcesPanel: false,
                showDomainDetails: false
            });
        }
    }

    closeNodeDetails() {
        this.setState({ showNodeDetails: false });
    }

    closeSourcesPanel() {
        this.setState({ showSourcesPanel: false });
    }

    openSourcesPanel() {
        if (this.state.selectedNodeSources.length > 0) {
            this.setState({
                showSourcesPanel: true,
                showNodeDetails: false,
                showDomainDetails: false
            });
        }
    }

    selectDomain(domainId) {
        if (!this.state.currentGraph) return;

        const domain = this.state.currentGraph.domains.find(d => d.id === domainId);
        if (!domain) return;

        this.setState({
            selectedDomain: domain,
            showDomainDetails: true,
            showSourcesPanel: false,
            showNodeDetails: false,
            selectedNode: null
        });
    }

    closeDomainDetails() {
        this.setState({ showDomainDetails: false, selectedDomain: null });
    }

    getState() {
        return this.state;
    }

    // Dialog Handling
    
    /**
     * Show custom confirm dialog
     * @param {Object} options - { title, message, confirmText, cancelText }
     * @returns {Promise<boolean>} Resolves with true if confirmed, false if cancelled
     */
    showConfirm(options) {
        return new Promise((resolve) => {
            this.setState({
                dialog: {
                    isOpen: true,
                    title: options.title || 'Confirm',
                    message: options.message || '',
                    type: 'confirm',
                    confirmText: options.confirmText || 'OK',
                    cancelText: options.cancelText || 'Cancel',
                    resolve: resolve
                }
            });
        });
    }

    /**
     * Show custom alert dialog
     * @param {Object} options - { title, message, confirmText }
     * @returns {Promise<void>} Resolves when dismissed
     */
    showAlert(options) {
        return new Promise((resolve) => {
            this.setState({
                dialog: {
                    isOpen: true,
                    title: options.title || 'Alert',
                    message: options.message || '',
                    type: 'alert',
                    confirmText: options.confirmText || 'OK',
                    cancelText: '',
                    resolve: resolve
                }
            });
        });
    }

    /**
     * Close dialog with result
     * @param {boolean} result - User response
     */
    closeDialog(result) {
        const dialog = this.state.dialog;
        
        // Close the dialog
        this.setState({
            dialog: {
                ...this.state.dialog,
                isOpen: false
            }
        });
        
        // Resolve the promise
        if (dialog && dialog.resolve) {
            dialog.resolve(result);
        }
    }
}