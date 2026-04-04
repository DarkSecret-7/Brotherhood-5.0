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
     * @returns {Promise<Array>} Array of suggestion objects
     */
    async getSuggestions(prompt, context, graphName, systemPrompt) {
        const response = await this.post('/llm/suggest', {
            prompt: prompt,
            context: context.substring(0, 3000),
            graph_name: graphName,
            system_prompt: systemPrompt
        });
        return response.suggestions || [];
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
