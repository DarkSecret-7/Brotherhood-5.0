/**
 * Assessments API Service - Assessment and capability endpoints
 * Handles self-assessment and capability management using UUIDs and hashes
 */
class AssessmentsApiService extends BaseApiService {
    
    /**
     * Create generic capability
     * @param {Object} capabilityData - { 
     *   snapshot_uuid, user_uuid, assessment_name, assessment_type, 
     *   assessment_version, assessed_nodes 
     * }
     */
    async createCapability(capabilityData) {
        return await this.post('/capabilities', capabilityData);
    }

    /**
     * Perform self-assessment
     * @param {Object} requestData - { graph_uuid, proof_inputs }
     * @param {Array} proof_inputs - [{ node_id, value }]
     */
    async performSelfAssessment(requestData) {
        return await this.post('/self-assessment', requestData);
    }

    /**
     * Get latest self-assessment for a graph
     * @param {string} graphLabel - The graph label
     */
    async getLatestSelfAssessment(graphLabel) {
        return await this.get(`/self-assessment/${graphLabel}/latest`);
    }

    /**
     * Delete self-assessment for a graph
     * @param {string} graphLabel - The graph label
     */
    async deleteSelfAssessment(graphLabel) {
        return await this.delete(`/self-assessment/${graphLabel}/delete`);
    }

    /**
     * Get capability by public hash
     * @param {string} publicHash - The capability's public hash
     */
    async getCapabilityByHash(publicHash) {
        return await this.get(`/capabilities/${publicHash}`);
    }

    /**
     * Delete capability by public hash
     * @param {string} publicHash - The capability's public hash
     */
    async deleteCapabilityByHash(publicHash) {
        return await this.delete(`/capabilities/${publicHash}`);
    }

    /**
     * Get user's capabilities for a specific snapshot
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async getUserCapabilities(snapshotUuid) {
        return await this.get(`/capabilities?snapshot_uuid=${snapshotUuid}`);
    }

    /**
     * Get public capabilities for a snapshot
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async getPublicCapabilities(snapshotUuid) {
        return await this.get(`/public/capabilities?snapshot_uuid=${snapshotUuid}`);
    }

    /**
     * Update capability
     * @param {string} publicHash - The capability's public hash
     * @param {Object} updateData - { assessment_name?, assessed_nodes? }
     */
    async updateCapability(publicHash, updateData) {
        return await this.patch(`/capabilities/${publicHash}`, updateData);
    }

    /**
     * Get assessment history for user and graph
     * @param {string} graphLabel - The graph label
     * @param {Object} options - { skip?, limit? }
     */
    async getAssessmentHistory(graphLabel, options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        
        const endpoint = `/assessment-history/${graphLabel}${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Validate proof inputs before submission
     * @param {Object} requestData - { graph_uuid, proof_inputs }
     */
    async validateProofInputs(requestData) {
        return await this.post('/self-assessment/validate', requestData);
    }

    /**
     * Get assessment statistics for a graph
     * @param {string} graphLabel - The graph label
     */
    async getAssessmentStats(graphLabel) {
        return await this.get(`/assessment-stats/${graphLabel}`);
    }

    /**
     * Export assessment results
     * @param {string} publicHash - The capability's public hash
     * @param {string} format - "json", "csv", or "pdf"
     */
    async exportAssessment(publicHash, format = 'json') {
        return await this.download(`/capabilities/${publicHash}/export?format=${format}`);
    }

    /**
     * Share capability publicly
     * @param {string} publicHash - The capability's public hash
     * @param {boolean} makePublic - Whether to make public or private
     */
    async shareCapability(publicHash, makePublic = true) {
        return await this.patch(`/capabilities/${publicHash}/share`, { is_public: makePublic });
    }

    /**
     * Get assessment template for a graph
     * @param {string} graphLabel - The graph label
     */
    async getAssessmentTemplate(graphLabel) {
        return await this.get(`/assessment-template/${graphLabel}`);
    }

    /**
     * Bulk create capabilities from assessment data
     * @param {Array} capabilitiesData - Array of capability objects
     */
    async bulkCreateCapabilities(capabilitiesData) {
        return await this.post('/capabilities/bulk', { capabilities: capabilitiesData });
    }
}

// Export singleton instance
const assessmentsApiService = new AssessmentsApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AssessmentsApiService, assessmentsApiService };
} else {
    window.AssessmentsApiService = AssessmentsApiService;
    window.assessmentsApiService = assessmentsApiService;
}
