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
 * Strictly read-only + voting surface: listing, fetching and responding to proposals.
 * Lifecycle actions (join, invite, remove) live on AuthorshipApiService.
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
     * Get a specific join request by hash
     * @param {string} proposalHash
     * @returns {Object} Join request object
     */
    async getJoinRequest(proposalHash) {
        return await this.get(`/proposals/join_requests/${proposalHash}`);
    }

    /**
     * Get a specific authorship invitation by hash (recipient-only).
     * Slim schema: no consensus (does not apply to direct invitations).
     * @param {string} invitationHash
     * @returns {Object} Invitation object
     */
    async getInvitation(invitationHash) {
        return await this.get(`/proposals/invitations/${invitationHash}`);
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
     * Get all pending and nonpending join requests for a specific graph
     * @param {string} graphUuid - The graph UUID
     * @returns {Object} - { join_request?: object }
     */
    async getJoinRequestsForGraph(graphUuid) {
        return await this.get(`/proposals/${graphUuid}/requests`);
    }

    async deleteProposal(proposalHash) {
        return await this.delete(`/proposals/${proposalHash}`);
    }

    async respondToProposal(proposalHash, response) {
        return await this.post(`/proposals/${proposalHash}/respond`, response);
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