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
 * Authorship API Service
 *
 * Handles authorship lifecycle actions on a snapshot:
 *   - Request to join a snapshot as an author (always creates a Join proposal)
 *   - Invite a user to become an author (creates a proposal, or direct invite when sole author)
 *   - Remove an author (creates a proposal, or direct removal when only two authors)
 *
 * Read-only concerns (listing pending proposals, fetching individual proposals,
 * casting consent votes) remain on the proposals API service.
 */
class AuthorshipApiService extends BaseApiService {

    /**
     * Request to join a snapshot as an author.
     * Always creates a Join proposal — the caller is not yet an author
     * and therefore cannot self-authorize.
     *
     * @param {string} snapshotUuid - The snapshot UUID to join
     * @returns {Object} - { success: boolean, proposal_hash?: string }
     */
    async joinGraph(snapshotUuid) {
        return await this.post(`/snapshots/${snapshotUuid}/authors/join`);
    }

    /**
     * Invite a user to become an author of a snapshot.
     * Service decides whether to create a proposal or execute directly.
     *
     * @param {string} snapshotUuid - The snapshot UUID
     * @param {string} targetUserUuid - The user UUID to invite
     * @returns {Object} - { success: boolean, direct?: boolean, proposal_hash?: string }
     */
    async inviteToGraph(snapshotUuid, targetUserUuid) {
        return await this.post(`/snapshots/${snapshotUuid}/authors/invite`, {
            target_user_uuid: targetUserUuid
        });
    }

    /**
     * Remove an author from a snapshot.
     * Service decides whether to create a proposal or execute directly.
     *
     * @param {string} snapshotUuid - The snapshot UUID
     * @param {string} targetUserUuid - The author UUID to remove
     * @returns {Object} - { success: boolean, direct?: boolean, proposal_hash?: string }
     */
    async removeAuthorFromGraph(snapshotUuid, targetUserUuid) {
        return await this.delete(`/snapshots/${snapshotUuid}/authors/${targetUserUuid}`);
    }

    /**
     * Recipient accepts or rejects an authorship invitation
     * @param {string} snapshotUuid - The snapshot UUID
     * @param {string} invitationHash - The invitation public hash
     * @param {string} action - 'accept' or 'reject'
     * @returns {Object} - { success, invitation_status, direct }
     */
    async respondToInvitation(snapshotUuid, invitationHash, accept) {
        return await this.post(
            `/snapshots/${snapshotUuid}/authors/invitations/${invitationHash}/respond`,
            { accept: accept }
        );
    }
}

// Export singleton instance
const authorshipApiService = new AuthorshipApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthorshipApiService, authorshipApiService };
} else {
    window.AuthorshipApiService = AuthorshipApiService;
    window.authorshipApiService = authorshipApiService;
}