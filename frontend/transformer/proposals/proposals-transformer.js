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
 * Proposals Transformer - Convert between backend and frontend proposal data structures
 */
class ProposalsTransformer {

    transformProposalFromBackend(backendProposal, currentUserUuid) {
        if (!backendProposal) return null;

        const frontendProposal = {
            publicHash: backendProposal.public_hash,
            proposalType: backendProposal.proposal_type,
            graphUuid: backendProposal.graph_uuid,
            proposerUuid: backendProposal.proposer_uuid,
            targetUserUuid: backendProposal.target_user_uuid,
            targetGraphUuid: backendProposal.target_graph_uuid,
            proposalTime: backendProposal.proposal_time ? new Date(backendProposal.proposal_time) : null,
            proposalStatus: backendProposal.proposal_status,
            graphLabel: backendProposal.graph_label || null,
            proposerUsername: backendProposal.proposer_username || null,
            targetUsername: backendProposal.target_username || null,
            targetGraphLabel: backendProposal.target_graph_label || null,
            isInitiator: backendProposal.proposer_uuid === currentUserUuid,
            isTarget: backendProposal.target_user_uuid === currentUserUuid
        };

        if (backendProposal.consensus) {
            frontendProposal.consensus = {
                yesCount: backendProposal.consensus.yes_count,
                noCount: backendProposal.consensus.no_count,
                abstainCount: backendProposal.consensus.abstain_count,
                remainingVotes: backendProposal.consensus.remaining_votes
            };
        }

        if (backendProposal.votes && typeof backendProposal.votes === 'object') {
            frontendProposal.votes = backendProposal.votes;
            frontendProposal.userVote = backendProposal.votes[currentUserUuid] !== undefined
                ? backendProposal.votes[currentUserUuid]
                : null;
        } else {
            frontendProposal.votes = {};
            frontendProposal.userVote = null;
        }

        return frontendProposal;
    }

    transformProposalListFromBackend(backendProposals, currentUserUuid) {
        if (!Array.isArray(backendProposals)) return [];
        return backendProposals.map(proposal => this.transformProposalFromBackend(proposal, currentUserUuid));
    }

    transformJoinRequestFromBackend(backendJoinRequest) {
        // Transform join request to the standardised proposal format
        // Treat Join Request as a Proposal with less information

        if (!backendJoinRequest) return null;
        
        return {
            publicHash: backendJoinRequest.public_hash,
            proposalType: 'Join',
            graphUuid: backendJoinRequest.graph_uuid,
            proposerUuid: backendJoinRequest.requestor_uuid,
            proposalTime: backendJoinRequest.created_at ? new Date(backendJoinRequest.created_at) : null,
            proposalStatus: backendJoinRequest.proposal_status || 'Unavailable',
            graphLabel: backendJoinRequest.graph_label || null,
            proposerUsername: backendJoinRequest.requestor_username || null,
            targetUsername: null,
            targetGraphLabel: null,
            isInitiator: true,
            isTarget: false
        };
    }

    transformProposalConsentFromBackend(backendProposalConsent) {
        if (!backendProposalConsent) return null;
        return {
            proposalHash: backendProposalConsent.proposal_hash,
            userUuid: backendProposalConsent.user_uuid,
            userVote: backendProposalConsent.user_vote,
            consentDate: backendProposalConsent.consent_date ? new Date(backendProposalConsent.consent_date) : null
        };
    }

    transformProposalConsentToBackend(frontendProposalConsent) {
        if (!frontendProposalConsent) return null;
        return {
            proposal_hash: frontendProposalConsent.proposalHash,
            user_uuid: frontendProposalConsent.userUuid,
            user_vote: frontendProposalConsent.userVote
        };
    }
}

const proposalsTransformer = new ProposalsTransformer();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProposalsTransformer, proposalsTransformer };
} else {
    window.ProposalsTransformer = ProposalsTransformer;
    window.proposalsTransformer = proposalsTransformer;
}