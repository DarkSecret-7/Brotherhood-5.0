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
 * Proposals API Service
 * Handles join and invite proposal operations
 */
class ProposalsApiService extends BaseApiService {

    /**
     * Get proposals for graphs where user is an author
     * @returns {Array} Array of proposal objects
     */
    async getAuthoredProposals(pending_only = false, skip = 0, limit = 100) {
        return await this.get(`/proposals/authored?pending_only=${pending_only}&skip=${skip}&limit=${limit}`);
    }
    
    /**
     * Get proposals sent by the current user
     * @returns {Array} Array of proposal objects
     */
    async getJoinRequests(skip = 0, limit = 100) {
        return await this.get(`/proposals/join_requests?skip=${skip}&limit=${limit}`);
    }

    /**
     * Get authorship invitations received by the current user
     * @returns {Array} Array of invitation objects
     */
    async getReceivedInvitations(skip = 0, limit = 100) {
        return await this.get(`/proposals/invitations/received?skip=${skip}&limit=${limit}`);
    }

    /**
     * Get a specific proposal by hash
     * @param {string} proposalHash
     * @returns {Object} Proposal object
     */
    async getProposal(proposalHash) {
        return await this.get(`/proposals/${proposalHash}`);
    }

    /**
     * Get proposals for a specific graph (only for authors)
     * @param {string} graphUuid - The graph UUID
     * @returns {Array} Array of proposal objects
     */
    async getProposalsForGraph(graphUuid, pendingOnly = false) {
        return await this.get(`/proposals/${graphUuid}/proposals?pending_only=${pendingOnly}`);
    }

    /**
     * Get join request for a specific graph
     * @param {string} graphUuid - The graph UUID
     * @returns {Object} - { join_request?: object }
     */
    async getJoinRequestForGraph(graphUuid) {
        return await this.get(`/proposals/${graphUuid}/request`);
    }

    /**
     * Request to join a graph as an author
     * @param {string} graphUuid - The graph UUID
     * @returns {Object} - { success: boolean, proposal_hash?: string }
     */
    async joinGraph(graphUuid) {
        return await this.post(`/proposals/${graphUuid}/join`);
    }

    /**
     * Invite a user to become an author of a graph
     * @param {string} graphUuid - The graph UUID
     * @param {string} targetUserUuid - The target user UUID to invite
     * @returns {Object} - { success: boolean, direct?: boolean, proposal_hash?: string }
     */
    async inviteToGraph(graphUuid, targetUserUuid) {
        console.log(graphUuid, typeof graphUuid, targetUserUuid, typeof targetUserUuid);
        
        return await this.post(`/proposals/${graphUuid}/invite`, {
            target_user_uuid: targetUserUuid
        });
    }

    async deleteProposal(proposalHash) {
        return await this.delete(`/proposals/${proposalHash}`);
    }

    async respondToProposal(proposalHash, response) {
        return await this.post(`/proposals/${proposalHash}/respond`, response);
    }

    async removeAuthorFromGraph(graphUuid, targetUserUuid) {
        return await this.post(`/proposals/${graphUuid}/remove`, {
            target_user_uuid: targetUserUuid
        });
    }
}

// Export singleton instance
const proposalsApiService = new ProposalsApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProposalsApiService, proposalsApiService };
} else {
    window.ProposalsApiService = ProposalsApiService;
    window.proposalsApiService = proposalsApiService;
}