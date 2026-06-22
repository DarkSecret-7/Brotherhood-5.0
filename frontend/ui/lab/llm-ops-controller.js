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
 * LLM Operations Controller - Handles LLM-related business logic
 * Delegates UI operations to state manager
 */
class LLMOpsController {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.currentSuggestions = [];
        this.availableModels = [];
        this.defaultModel = null;
        this.selectedModel = null;
    }

    /**
     * Load available models from the API
     * @param {Function} onSuccess - Callback with models on success
     * @param {Function} onError - Callback with error message on error
     */
    async loadAvailableModels(onSuccess, onError) {
        try {
            if (!window.llmApiService) {
                throw new Error('LLM API service not available');
            }

            const response = await window.llmApiService.getAvailableModels();
            this.availableModels = response.models || [];
            this.defaultModel = response.default;
            this.selectedModel = this.defaultModel;
            onSuccess(this.availableModels, this.defaultModel);
        } catch (error) {
            console.error('Failed to load models:', error);
            onError(error.message);
        }
    }

    /**
     * Set the selected model
     * @param {string} modelId - Model ID to use
     */
    setSelectedModel(modelId) {
        this.selectedModel = modelId;
    }

    /**
     * Get the currently selected model
     * @returns {string} Selected model ID
     */
    getSelectedModel() {
        return this.selectedModel || this.defaultModel;
    }

    /**
     * Get context from selected nodes or all nodes
     * @returns {Object} Context string and count info
     */
    getContextForLLM() {
        const { nodes, selectedNodes } = this.stateManager.state;
        const selectedNodeIds = Array.from(selectedNodes || []);

        // If selections exist, use only selected nodes
        if (selectedNodeIds.length > 0) {
            const selectedNodesList = nodes.filter(n => selectedNodes.has(n.id));
            const context = selectedNodesList.map(n => `${n.title}: ${n.description}`).join('\n');
            return {
                context,
                count: selectedNodesList.length,
                isSelection: true
            };
        }

        // Otherwise use all nodes
        const context = nodes && nodes.length > 0
            ? nodes.map(n => `${n.title}: ${n.description}`).join('\n')
            : '';
        return {
            context,
            count: nodes ? nodes.length : 0,
            isSelection: false
        };
    }

    /**
     * Query LLM for suggestions
     * @param {string} prompt - User's query prompt
     * @param {Function} onSuccess - Callback with suggestions on success
     * @param {Function} onError - Callback with error message on error
     */
    async queryLLM(prompt, onSuccess, onError) {
        if (!prompt || !prompt.trim()) {
            onError('Please enter a prompt');
            return;
        }

        try {
            // Build context from selected nodes or all nodes
            const { context, count, isSelection } = this.getContextForLLM();

            // Get Graph Name
            let graphName = 'Unknown Graph';
            const baseGraphLabel = this.stateManager.state.baseGraphLabel;
            const currentVersionLabel = this.stateManager.state.currentVersionLabel;
            if (baseGraphLabel) {
                graphName = baseGraphLabel;
            } else if (currentVersionLabel) {
                graphName = currentVersionLabel;
            }

            // Check if LLM API service is available
            if (!window.llmApiService) {
                throw new Error('LLM API service not available');
            }

            // System prompt capability available but using backend default for now
            const systemPrompt = null;

            const model = this.getSelectedModel();

            console.log(`[LLM] Using ${isSelection ? 'selected' : 'all'} nodes: ${count} nodes as context`);

            const suggestions = await window.llmApiService.getSuggestions(prompt, context, graphName, systemPrompt, model);
            this.currentSuggestions = suggestions;
            onSuccess(suggestions);

        } catch (error) {
            console.error('LLM Query failed:', error);
            onError(error.message);
        }
    }

    /**
     * Get next available node ID
     * @returns {number} Next available ID
     */
    getNextNodeId() {
        let nextId = 1;
        const nodes = this.stateManager.state.nodes;
        if (nodes && nodes.length > 0) {
            const maxId = Math.max(...nodes.map(n => n.id));
            nextId = maxId + 1;
        }
        return nextId;
    }

    /**
     * Import a single LLM suggestion as a node
     * @param {string} title - Node title
     * @param {string} description - Node description
     */
    importSingleLLMNode(title, description) {
        const nodeData = {
            id: this.getNextNodeId(),
            title: title,
            description: description,
            prerequisites: '',
            sources: [],
            domainId: null,
            assessable: false
        };

        try {
            this.stateManager.addNode(nodeData);

            // Close modal via UI controller
            if (window.labUIController) {
                window.labUIController.closeLLMModal();
            }

            this.stateManager.showMessage('Successfully imported 1 node', 'success');
        } catch (error) {
            console.error('Error adding node:', error);
            this.stateManager.showMessage('Failed to import node', 'error');
        }
    }

    /**
     * Import selected LLM suggestions as nodes
     */
    importLLMSelected() {
        const checkboxes = document.querySelectorAll('.llm-suggestion-checkbox');
        let selectedCount = 0;
        const newNodes = [];

        // Calculate starting ID
        let nextId = this.getNextNodeId();

        checkboxes.forEach(cb => {
            if (cb.checked) {
                const card = cb.closest('.llm-suggestion-card');
                const titleEl = card.querySelector('.s-title');
                const descEl = card.querySelector('.s-desc');

                if (titleEl && descEl) {
                    newNodes.push({
                        id: nextId++,
                        title: titleEl.textContent,
                        description: descEl.textContent,
                        prerequisites: '',
                        sources: [],
                        domainId: null,
                        assessable: false
                    });
                    selectedCount++;
                }
            }
        });

        if (selectedCount === 0) {
            this.stateManager.showMessage('Please select at least one suggestion to import', 'error');
            return;
        }

        // Add nodes to state
        newNodes.forEach(nodeData => {
            try {
                this.stateManager.addNode(nodeData);
            } catch (error) {
                console.error('Error adding node:', error);
            }
        });

        // Close modal via UI controller
        if (window.labUIController) {
            window.labUIController.closeLLMModal();
        }

        // Notify user
        this.stateManager.showMessage(`Successfully imported ${selectedCount} nodes`, 'success');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LLMOpsController };
} else {
    window.LLMOpsController = LLMOpsController;
}
