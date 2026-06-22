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
 * LLM API Service - Handles AI suggestion API calls
 */
class LLMApiService extends BaseApiService {
    constructor() {
        super();
    }

    /**
     * Get AI suggestions for nodes based on a prompt
     * @param {string} prompt - User's query prompt
     * @param {string} context - Current graph context (node titles/descriptions)
     * @param {string} graphName - Current graph name
     * @param {string} systemPrompt - System prompt describing graph nature/purpose/goals
     * @param {string} model - Model ID to use for generation
     * @returns {Promise<Array>} Array of suggestion objects
     */
    async getSuggestions(prompt, context, graphName, systemPrompt, model) {
        const response = await this.post('/llm/suggest', {
            prompt: prompt,
            context: context.substring(0, 3000),
            graph_name: graphName,
            system_prompt: systemPrompt,
            model: model
        });
        return response.suggestions || [];
    }

    /**
     * Get list of available LLM models
     * @returns {Promise<Object>} Object with models array and default model ID
     */
    async getAvailableModels() {
        return await this.get('/llm/models');
    }
}

// Export singleton instance
const llmApiService = new LLMApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LLMApiService, llmApiService };
} else {
    window.LLMApiService = LLMApiService;
    window.llmApiService = llmApiService;
}
