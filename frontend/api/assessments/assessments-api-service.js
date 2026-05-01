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
     * @param {string} graphUuid - The graph UUID
     */
    async getLatestSelfAssessment(graphUuid) {
        return await this.get(`/self-assessment/${graphUuid}/latest`);
    }

    /**
     * Delete self-assessment for a graph
     * @param {string} graphUuid - The graph UUID
     */
    async deleteSelfAssessment(graphUuid) {
        return await this.delete(`/self-assessment/${graphUuid}/delete`);
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
