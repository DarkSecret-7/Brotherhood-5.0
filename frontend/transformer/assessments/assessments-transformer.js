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
            completionStatus: this.determineCompletionStatus(backendCapability.assessed_nodes || []),
            // UI state
            isExpanded: false,
            isSelected: false,
            isShared: false
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

        return backendAssessed.map(node => ({
            nodeId: node.node_id,
            snapshotUuid: node.snapshot_uuid,
            evaluation: node.evaluation || {},
            // Computed properties
            score: this.extractScore(node.evaluation),
            status: this.determineNodeStatus(node.evaluation),
            feedback: this.extractFeedback(node.evaluation),
            evidence: this.extractEvidence(node.evaluation),
            // UI state
            isExpanded: false,
            isEditing: false
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
            proof_inputs: frontendRequest.proofInputs.map(input => ({
                node_id: input.nodeId,
                value: input.value
            }))
        };
    }

    /**
     * Transform proof inputs from backend format
     * @param {Array} backendProofInputs - Backend proof inputs
     * @returns {Array} Frontend proof inputs
     */
    transformProofInputsFromBackend(backendProofInputs) {
        if (!Array.isArray(backendProofInputs)) return [];

        return backendProofInputs.map(input => ({
            nodeId: input.node_id,
            value: input.value,
            // UI state
            isValid: true,
            errorMessage: ''
        }));
    }

    /**
     * Transform proof inputs to backend format
     * @param {Array} frontendProofInputs - Frontend proof inputs
     * @returns {Array} Backend proof inputs
     */
    transformProofInputsToBackend(frontendProofInputs) {
        if (!Array.isArray(frontendProofInputs)) return [];

        return frontendProofInputs.map(input => ({
            node_id: input.nodeId,
            value: input.value
        }));
    }

    /**
     * Transform assessment template from backend format
     * @param {Object} backendTemplate - Backend assessment template
     * @returns {Object} Frontend assessment template
     */
    transformAssessmentTemplateFromBackend(backendTemplate) {
        if (!backendTemplate) return null;

        return {
            graphLabel: backendTemplate.graph_label,
            assessmentName: backendTemplate.assessment_name,
            assessmentType: backendTemplate.assessment_type,
            version: backendTemplate.version,
            instructions: backendTemplate.instructions || '',
            nodes: this.transformTemplateNodesFromBackend(backendTemplate.nodes || []),
            scoringCriteria: backendTemplate.scoring_criteria || {},
            timeLimit: backendTemplate.time_limit || null,
            maxAttempts: backendTemplate.max_attempts || null
        };
    }

    /**
     * Transform template nodes from backend format
     * @param {Array} backendNodes - Backend template nodes
     * @returns {Array} Frontend template nodes
     */
    transformTemplateNodesFromBackend(backendNodes) {
        if (!Array.isArray(backendNodes)) return [];

        return backendNodes.map(node => ({
            id: node.local_id,
            title: node.title,
            description: node.description || '',
            required: node.required || false,
            weight: node.weight || 1,
            assessmentType: node.assessment_type || 'score',
            options: node.options || [],
            maxScore: node.max_score || null,
            // UI state
            isAnswered: false,
            answer: null,
            score: null
        }));
    }

    /**
     * Transform assessment statistics from backend format
     * @param {Object} backendStats - Backend assessment stats
     * @returns {Object} Frontend assessment stats
     */
    transformAssessmentStatsFromBackend(backendStats) {
        return {
            totalAssessments: backendStats.total_assessments || 0,
            averageScore: backendStats.average_score || 0,
            completionRate: backendStats.completion_rate || 0,
            passRate: backendStats.pass_rate || 0,
            lastAssessment: backendStats.last_assessment ? new Date(backendStats.last_assessment) : null,
            scoreDistribution: backendStats.score_distribution || {},
            timeStats: {
                averageTime: backendStats.average_time_minutes || 0,
                fastestTime: backendStats.fastest_time_minutes || 0,
                slowestTime: backendStats.slowest_time_minutes || 0
            },
            improvementStats: {
                averageImprovement: backendStats.average_improvement || 0,
                improvedCount: backendStats.improved_count || 0,
                declinedCount: backendStats.declined_count || 0
            }
        };
    }

    /**
     * Transform assessment history from backend format
     * @param {Array} backendHistory - Backend assessment history
     * @returns {Array} Frontend assessment history
     */
    transformAssessmentHistoryFromBackend(backendHistory) {
        if (!Array.isArray(backendHistory)) return [];

        return backendHistory.map(entry => ({
            id: entry.id,
            assessmentName: entry.assessment_name,
            assessmentType: entry.assessment_type,
            score: entry.score || 0,
            maxScore: entry.max_score || 0,
            status: entry.status || 'completed',
            completedAt: entry.completed_at ? new Date(entry.completed_at) : null,
            timeSpent: entry.time_spent_minutes || 0,
            attemptNumber: entry.attempt_number || 1,
            improvement: entry.improvement || 0,
            // Computed properties
            percentage: this.calculatePercentage(entry.score, entry.max_score),
            grade: this.calculateGrade(entry.score, entry.max_score),
            relativeTime: this.getRelativeTime(entry.completed_at)
        }));
    }

    /**
     * Calculate average score from assessed nodes
     * @param {Array} assessedNodes - Assessed nodes array
     * @returns {number} Average score
     */
    calculateAverageScore(assessedNodes) {
        if (!Array.isArray(assessedNodes) || assessedNodes.length === 0) return 0;
        
        const scores = assessedNodes.map(node => this.extractScore(node.evaluation)).filter(score => score !== null);
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

    /**
     * Calculate percentage score
     * @param {number} score - Achieved score
     * @param {number} maxScore - Maximum possible score
     * @returns {number} Percentage
     */
    calculatePercentage(score, maxScore) {
        if (!maxScore || maxScore === 0) return 0;
        return Math.round((score / maxScore) * 100);
    }

    /**
     * Calculate grade from score
     * @param {number} score - Achieved score
     * @param {number} maxScore - Maximum possible score
     * @returns {string} Grade
     */
    calculateGrade(score, maxScore) {
        const percentage = this.calculatePercentage(score, maxScore);
        
        if (percentage >= 90) return 'A';
        if (percentage >= 80) return 'B';
        if (percentage >= 70) return 'C';
        if (percentage >= 60) return 'D';
        return 'F';
    }

    /**
     * Get relative time string
     * @param {string|Date} timestamp - Timestamp
     * @returns {string} Relative time
     */
    getRelativeTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }

    /**
     * Validate assessment data
     * @param {Object} assessmentData - Assessment data to validate
     * @returns {Object} Validation result
     */
    validateAssessmentData(assessmentData) {
        const errors = [];

        if (!assessmentData.snapshotUuid) {
            errors.push('Snapshot UUID is required');
        }

        if (!assessmentData.userUuid) {
            errors.push('User UUID is required');
        }

        if (!assessmentData.assessmentName || assessmentData.assessmentName.trim().length === 0) {
            errors.push('Assessment name is required');
        }

        if (!assessmentData.assessedNodes || assessmentData.assessedNodes.length === 0) {
            errors.push('At least one assessed node is required');
        } else {
            assessmentData.assessedNodes.forEach((node, index) => {
                if (!node.nodeId) {
                    errors.push(`Assessed node ${index + 1}: Node ID is required`);
                }
                if (!node.snapshotUuid) {
                    errors.push(`Assessed node ${index + 1}: Snapshot UUID is required`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Create empty frontend capability structure
     * @returns {Object} Empty capability object
     */
    createEmptyCapability() {
        return {
            hash: null,
            snapshotUuid: null,
            userUuid: null,
            assessmentName: '',
            assessmentType: '',
            assessmentVersion: '1.0',
            assessmentDate: null,
            assessedNodes: [],
            nodeCount: 0,
            averageScore: 0,
            completionStatus: 'not_started',
            isExpanded: false,
            isSelected: false,
            isShared: false
        };
    }

    /**
     * Create empty self-assessment request
     * @returns {Object} Empty self-assessment request
     */
    createEmptySelfAssessmentRequest() {
        return {
            graphUuid: null,
            proofInputs: []
        };
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
