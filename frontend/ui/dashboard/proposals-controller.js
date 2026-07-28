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
 * Proposals Controller - Pure UI Controller for Proposals page
 * Only handles rendering and user input, delegates all data operations to state manager
 */
class ProposalsController {
    constructor(stateManager) {
        this.stateManager = stateManager;

        // Bind handlers for state subscription
        this.handleStateChange = this.handleStateChange.bind(this);
    }

    async init() {
        this.bindTabEvents();

        // Subscribe to state changes
        this.stateManager.subscribe(this.handleStateChange);

        // Load initial data via state manager
        await this.stateManager.loadAllProposals();
    }

    /**
     * Handle state changes - only renders based on state
     */
    handleStateChange(state) {
        this.render();
    }

    bindTabEvents() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        const tabSelect = document.getElementById('proposals-tab-select');
        if (tabSelect) {
            tabSelect.addEventListener('change', (e) => {
                this.switchTab(e.target.value);
            });
        }
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab select for mobile
        const tabSelect = document.getElementById('proposals-tab-select');
        if (tabSelect) {
            tabSelect.value = tabId;
        }

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        // Update currentProposalTab state
        this.stateManager.setState({ currentProposalTab: tabId });
    }

    /**
     * Main render method - renders current tab based on state
     */
    render() {
        const { proposals, isLoadingProposals, proposalsError, currentProposalTab } = this.stateManager.state;

        const tabProposals = proposals[currentProposalTab];
        if (!tabProposals) return;

        const pendingList = document.getElementById(`${currentProposalTab}-pending-list`);
        const notPendingList = document.getElementById(`${currentProposalTab}-notPending-list`);

        if (isLoadingProposals) {
            const loadingMsg = '<p class="empty-message">Loading...</p>';
            if (pendingList) pendingList.innerHTML = loadingMsg;
            if (notPendingList) notPendingList.innerHTML = loadingMsg;
            return;
        }

        if (proposalsError) {
            const errorMsg = `<p class="empty-message">${proposalsError}</p>`;
            if (pendingList) pendingList.innerHTML = errorMsg;
            if (notPendingList) notPendingList.innerHTML = errorMsg;
            return;
        }

        if (pendingList) {
            pendingList.innerHTML = this.renderProposalItems(tabProposals.pending, true);
        }
        if (notPendingList) {
            notPendingList.innerHTML = this.renderProposalItems(tabProposals.notPending, false);
        }

        // Render modal if open
        this.renderProposalModal();
    }

    renderProposalItems(proposals, pendingList = true) {
        const { currentProposalTab } = this.stateManager.state;

        if (!proposals || proposals.length === 0) {
            let emptyMsg = '';
            switch (currentProposalTab) {
                case 'authored':
                    emptyMsg = 'No authored proposals';
                    break;
                case 'join':
                    emptyMsg = 'No join requests';
                    break;
                case 'received':
                    emptyMsg = 'No received proposals';
                    break;
                default:
                    emptyMsg = 'No proposals';
                    break;
            }
            emptyMsg += pendingList ? ' pending' : ' in the past';
            return `<p class="empty-message">${emptyMsg}</p>`;
        }

        return proposals.map(p => {
            return `
                <div class="proposal-item" onclick="proposalsController.openProposalDetail('${p.publicHash}', '${currentProposalTab}')">
                    <div class="proposal-info">
                        <span class="proposal-type">${p.proposalType}</span>
                        <span class="proposal-graph">${p.graphLabel || 'Unknown Graph'}</span>
                    </div>
                    <div class="proposal-status ${this.getStatusClass(p.proposalStatus)}">
                        ${p.proposalStatus}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderProposalModal() {
        const modal = document.getElementById('proposal-detail-modal');
        const proposal = this.stateManager.state.currentProposalDetail;
        console.log(proposal);
        
        if (!proposal) {
            modal.style.display = 'none';
            return;
        }

        modal.style.display = 'flex';

        // Fill in the modal details
        document.getElementById('proposal-detail-type').textContent = proposal.proposalType;
        document.getElementById('proposal-detail-hash').textContent = proposal.publicHash;
        document.getElementById('proposal-detail-time').textContent = this.formatDate(proposal.proposalTime);
        document.getElementById('proposal-detail-initiator').textContent = proposal.proposerUsername || 'Unknown';
        document.getElementById('proposal-detail-target').textContent = proposal.targetUsername || '-';
        document.getElementById('proposal-detail-graph').textContent = proposal.graphLabel || proposal.graphUuid;
        document.getElementById('proposal-detail-status').textContent = proposal.proposalStatus;

        // Consensus
        const consensusEl = document.getElementById('proposal-detail-consensus');
        if (proposal.consensus) {
            const c = proposal.consensus;
            consensusEl.textContent = `${c.yesCount} yes, ${c.noCount} no, ${c.remainingVotes} ${proposal.proposalStatus === 'Pending' ? ' remaining' : ' abstained'}`;
        } else {
            consensusEl.textContent = 'N/A';
        }

        // Show/hide vote and delete sections based on state
        const voteSection = document.getElementById('proposal-detail-vote-section');
        const deleteSection = document.getElementById('proposal-detail-delete-section');
        const inviteSection = document.getElementById('proposal-detail-invite-section');
        const invitationRespondSection = document.getElementById('proposal-detail-invitation-respond-section');
        const isPending = proposal.proposalStatus === 'Pending';
        const isInvitation = !!proposal.isInvitation;

        voteSection.style.display = 'none';
        deleteSection.style.display = 'none';
        inviteSection.style.display = 'none';
        invitationRespondSection.style.display = 'none';

        if (isInvitation) {
            // Show Accept/Decline buttons only while still Pending
            if (isPending) {
                invitationRespondSection.style.display = 'block';
            }
            return;
        }

        // Show delete section for own pending proposals (isInitiator)
        if (isPending && proposal.isInitiator) {
            deleteSection.style.display = 'block';
        }
        // Show vote section for pending proposals where user can vote (not target)
        else if (isPending && !proposal.isTarget) {
            voteSection.style.display = 'block';
        }
        // Show invite section for invite proposals where user is target
        else if (proposal.isTarget) {
            inviteSection.style.display = 'block';
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'Pending': return 'status-pending';
            case 'Executed': return 'status-executed';
            case 'Rejected': return 'status-rejected';
            default: return '';
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    toggleSection(tab, section) {
        const header = document.querySelector(`[onclick="proposalsController.toggleSection('${tab}', '${section}')"]`);
        const content = document.getElementById(`${tab}-${section}-content`);
        const icon = document.getElementById(`${tab}-${section}-icon`);

        if (!content || !header) return;

        const isCollapsed = content.classList.contains('collapsed');

        if (isCollapsed) {
            content.classList.remove('collapsed');
            header.classList.remove('collapsed');
            if (icon) {
                icon.classList.remove('collapsed');
                icon.textContent = '▼';
            }
        } else {
            content.classList.add('collapsed');
            header.classList.add('collapsed');
            if (icon) {
                icon.classList.add('collapsed');
                icon.textContent = '▶';
            }
        }
    }

    async openProposalDetail(proposalHash, currentProposalTab) {
        try {
            const currentUserUuid = window.authApiService?.getCurrentUserUuid();

            if (currentProposalTab === 'authored') {
                const fullProposal = await window.proposalsApiService.getProposal(proposalHash);
                const transformed = window.proposalsTransformer.transformProposalFromBackend(fullProposal, currentUserUuid);
                this.stateManager.setCurrentProposalDetail(transformed);
            } else if (currentProposalTab === 'join') {
                const fullProposal = await window.proposalsApiService.getJoinRequest(proposalHash);
                const transformed = window.proposalsTransformer.transformJoinRequestFromBackend(fullProposal, currentUserUuid);
                this.stateManager.setCurrentProposalDetail(transformed);
            } else if (currentProposalTab === 'received') {
                const fullInvitation = await window.proposalsApiService.getInvitation(proposalHash);
                const transformed = window.proposalsTransformer.transformInvitationFromBackend(fullInvitation);
                this.stateManager.setCurrentProposalDetail(transformed);
            }
        } catch (error) {
            console.error('Failed to load proposal details', error);
            this.stateManager.showAlert('Failed to load proposal details');
        }
    }

    closeProposalDetailModal() {
        this.stateManager.setCurrentProposalDetail(null);
        this.currentProposalType = null;
    }

    async voteProposal(vote) {
        const proposal = this.stateManager.getCurrentProposalDetail();
        if (!proposal) return;

        try {
            await this.stateManager.voteProposal(proposal.publicHash, vote);
            this.closeProposalDetailModal();
        } catch (error) {
            alert('Failed to submit vote: ' + error.message);
        }
    }

    async deleteProposal() {
        const proposal = this.stateManager.getCurrentProposalDetail();
        if (!proposal) return;

        if (!confirm('Are you sure you want to delete this proposal?')) return;

        try {
            await this.stateManager.deleteProposal(proposal.publicHash);
            this.closeProposalDetailModal();
        } catch (error) {
            alert('Failed to delete proposal: ' + error.message);
        }
    }

    /**
     * Respond to an authorship invitation (accept or reject).
     */
    async respondToInvitation(action) {
        const invitation = this.stateManager.getCurrentProposalDetail();
        if (!invitation || !invitation.isInvitation) return;

        // Guard against responding to non-Pending invitations
        if (invitation.invitationStatus && invitation.invitationStatus !== 'Pending') {
            this.stateManager.showAlert(`Invitation is already ${invitation.invitationStatus.toLowerCase()}.`);
            return;
        }

        const verb = action ? 'accept' : 'reject';
        if (!confirm(`Are you sure you want to ${verb} this invitation?`)) return;

        try {
            await this.stateManager.respondToInvitation(invitation, action);
            this.closeProposalDetailModal();
        } catch (error) {
            alert(`Failed to ${verb} invitation: ` + error.message);
        }
    }
}