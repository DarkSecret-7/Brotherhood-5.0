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
 * Assessments Transformer - Convert between backend and frontend assessment data structures
 * Handles capabilities, assessments, and self-assessment transformations
 */
class AssessmentsTransformer {
    
    /**
     * Transform backend capability data to frontend format
     * @param {Object} backendCapability - Backend capability response
     * @returns {Object} Frontend capability object
     */
    transformCapabilityFromBackend(backendCapability) {
        if (!backendCapability) return null;

        return {
            hash: backendCapability.public_hash,
            snapshotUuid: backendCapability.snapshot_uuid,
            userUuid: backendCapability.user_uuid,
            assessmentName: backendCapability.assessment_name,
            assessmentType: backendCapability.assessment_type,
            assessmentVersion: backendCapability.assessment_version,
            assessmentDate: backendCapability.assessment_date ? new Date(backendCapability.assessment_date) : null,
            assessedNodes: this.transformAssessedNodesFromBackend(backendCapability.assessed_nodes || []),
            // Computed properties
            nodeCount: (backendCapability.assessed_nodes || []).length,
            averageScore: this.calculateAverageScore(backendCapability.assessed_nodes || []),
            // completionStatus: this.determineCompletionStatus(backendCapability.assessed_nodes || [])
        };
    }

    /**
     * Transform frontend capability data to backend format
     * @param {Object} frontendCapability - Frontend capability object
     * @returns {Object} Backend capability request data
     */
    transformCapabilityToBackend(frontendCapability) {
        return {
            snapshot_uuid: frontendCapability.snapshotUuid,
            user_uuid: frontendCapability.userUuid,
            assessment_name: frontendCapability.assessmentName,
            assessment_type: frontendCapability.assessmentType,
            assessment_version: frontendCapability.assessmentVersion,
            assessed_nodes: this.transformAssessedNodesToBackend(frontendCapability.assessedNodes)
        };
    }

    /**
     * Transform backend assessed nodes to frontend format
     * @param {Array} backendAssessedNodes - Backend assessed nodes array
     * @returns {Array} Frontend assessed nodes array
     */
    transformAssessedNodesFromBackend(backendAssessedNodes) {
        if (!Array.isArray(backendAssessedNodes)) return [];

        return backendAssessedNodes.map(node => ({
            nodeId: node.node_id,
            snapshotUuid: node.snapshot_uuid,
            evaluation: node.evaluation || {},      // A flexible dict
            // Computed properties
            // score: this.extractScore(node.evaluation),
            // status: this.determineNodeStatus(node.evaluation),
            // feedback: this.extractFeedback(node.evaluation),
            // evidence: this.extractEvidence(node.evaluation)
        }));
    }

    /**
     * Transform frontend assessed nodes to backend format
     * @param {Array} frontendAssessedNodes - Frontend assessed nodes array
     * @returns {Array} Backend assessed nodes array
     */
    transformAssessedNodesToBackend(frontendAssessedNodes) {
        if (!Array.isArray(frontendAssessedNodes)) return [];

        return frontendAssessedNodes.map(node => ({
            snapshot_uuid: node.snapshotUuid,
            node_id: node.nodeId,
            evaluation: node.evaluation
        }));
    }

    /**
     * Transform self-assessment request to backend format
     * @param {Object} frontendRequest - Frontend self-assessment request
     * @returns {Object} Backend self-assessment request
     */
    transformSelfAssessmentToBackend(frontendRequest) {
        return {
            graph_uuid: frontendRequest.graphUuid,
            proof_inputs: this.transformProofInputsToBackend(frontendRequest.proofInputs)
        };
    }

    /**
     * Transform proof inputs to backend format
     * @param {Object} frontendProofInputs - Frontend proof inputs as dictionary {nodeId: value}
     * @returns {Array} Backend proof inputs as array [{node_id, value}]
     */
    transformProofInputsToBackend(frontendProofInputs) {
        if (!frontendProofInputs || typeof frontendProofInputs !== 'object') return [];

        return Object.entries(frontendProofInputs).map(([nodeId, value]) => ({
            node_id: parseInt(nodeId),
            value: parseInt(value)
        }));
    }

    /**
     * Calculate average score from assessed nodes
     * @param {Array} assessedNodes - Assessed nodes array
     * @returns {number} Average score
     */
    calculateAverageScore(assessedNodes) {
        if (!Array.isArray(assessedNodes) || assessedNodes.length === 0) return 0;
        
        const scores = assessedNodes.map(node => this.extractScore(node.evaluation)).filter(score => typeof score === 'number' && score !== null);
        if (scores.length === 0) return 0;
        
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    /**
     * Determine completion status from assessed nodes
     * @param {Array} assessedNodes - Assessed nodes array
     * @returns {string} Completion status
     */
    determineCompletionStatus(assessedNodes) {
        if (!Array.isArray(assessedNodes) || assessedNodes.length === 0) return 'not_started';
        
        const completedCount = assessedNodes.filter(node => 
            this.determineNodeStatus(node.evaluation) === 'completed'
        ).length;
        
        if (completedCount === 0) return 'not_started';
        if (completedCount === assessedNodes.length) return 'completed';
        return 'in_progress';
    }

    /**
     * Extract score from evaluation object
     * @param {Object} evaluation - Evaluation object
     * @returns {number|null} Score value
     */
    extractScore(evaluation) {
        if (!evaluation || typeof evaluation !== 'object') return null;
        return evaluation.value || evaluation.score || null;
    }

    /**
     * Determine node status from evaluation
     * @param {Object} evaluation - Evaluation object
     * @returns {string} Node status
     */
    determineNodeStatus(evaluation) {
        if (!evaluation || typeof evaluation !== 'object') return 'not_assessed';
        
        if (evaluation.value !== undefined) {
            return evaluation.value > 0 ? 'completed' : 'failed';
        }
        
        return evaluation.status || 'not_assessed';
    }

    /**
     * Extract feedback from evaluation
     * @param {Object} evaluation - Evaluation object
     * @returns {string} Feedback text
     */
    extractFeedback(evaluation) {
        if (!evaluation || typeof evaluation !== 'object') return '';
        return evaluation.feedback || evaluation.comments || '';
    }

    /**
     * Extract evidence from evaluation
     * @param {Object} evaluation - Evaluation object
     * @returns {Array} Evidence array
     */
    extractEvidence(evaluation) {
        if (!evaluation || typeof evaluation !== 'object') return [];
        return evaluation.evidence || [];
    }
}

// Export singleton instance
const assessmentsTransformer = new AssessmentsTransformer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AssessmentsTransformer, assessmentsTransformer };
} else {
    window.AssessmentsTransformer = AssessmentsTransformer;
    window.assessmentsTransformer = assessmentsTransformer;
}
