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
            graphLabel: backendProposal.graph_label || '',
            proposerUsername: backendProposal.proposer_username || '',
            targetUsername: backendProposal.target_username || '',
            targetGraphLabel: backendProposal.target_graph_label || '',
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

    /**
     * Categorize proposals into pending and not pending
     */
    categorizeProposals(proposals) {
        const pending = proposals.filter(p => p.proposalStatus === 'Pending');
        const notPending = proposals.filter(p => p.proposalStatus !== 'Pending');
        return { pending, notPending };
    }

    transformProposalListFromBackend(backendProposals, currentUserUuid, categorized = false) {
        if (!Array.isArray(backendProposals)) return [];
        const proposals = backendProposals.map(proposal => this.transformProposalFromBackend(proposal, currentUserUuid));
        
        if (categorized) return this.categorizeProposals(proposals);     // Returns an object with pending and noPending sorted
        else return proposals;
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
            graphLabel: backendJoinRequest.graph_label || '',
            proposerUsername: backendJoinRequest.requestor_username || '',
            targetUsername: '',
            targetGraphLabel: '',
            isInitiator: true,
            isTarget: false
        };
    }

    transformJoinRequestListFromBackend(backendJoinRequests, categorized = false) {
        if (!Array.isArray(backendJoinRequests)) return [];
        const joinRequests = backendJoinRequests.map(joinRequest => this.transformJoinRequestFromBackend(joinRequest));
        
        if (categorized) return this.categorizeProposals(joinRequests);     // Returns an object with pending and noPending sorted
        else return joinRequests;
    }

    /**
     * Transform a backend AuthorshipInvitation into a proposal-like shape so
     * the unified modal can render it alongside real proposals.
     * isInvitation is set to true so the modal can hide proposal-only
     * sections (vote, delete, invite hint) and show the response section.
     * invitationStatus mirrors the backend 'Pending' | 'Accepted' | 'Rejected'.
     */
    transformInvitationFromBackend(backendInvitation) {
        if (!backendInvitation) return null;
        return {
            // Unified-modal fields
            publicHash: backendInvitation.public_hash,
            proposalType: 'Invitation',
            graphUuid: backendInvitation.graph_uuid,
            graphLabel: backendInvitation.graph_label || '',
            proposerUuid: backendInvitation.initiator_uuid,
            proposerUsername: backendInvitation.initiator_username || '',
            targetUserUuid: backendInvitation.recipient_uuid,
            targetUsername: backendInvitation.recipient_username || '',
            proposalTime: backendInvitation.created_at ? new Date(backendInvitation.created_at) : null,
            proposalStatus: backendInvitation.invitation_status || 'Pending',
            isInitiator: false,
            isTarget: true,
            // Invitation-specific flag for modal rendering
            // TEMPORARY, should remove later
            isInvitation: true,
            invitationStatus: backendInvitation.invitation_status || 'Pending',
        };
    }

    transformInvitationListFromBackend(backendInvitations, categorized = false) {
        if (!Array.isArray(backendInvitations)) return [];
        const invitations = backendInvitations.map(invitation => this.transformInvitationFromBackend(invitation));
        
        if (categorized) return this.categorizeProposals(invitations);     // Returns an object with pending and noPending sorted
        else return invitations;
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