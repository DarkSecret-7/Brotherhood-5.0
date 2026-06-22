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
        this.currentProposalType = null; // Track which tab's proposal we're viewing

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
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

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
            pendingList.innerHTML = this.renderProposalItems(tabProposals.pending, currentProposalTab === 'received', true);
        }
        if (notPendingList) {
            notPendingList.innerHTML = this.renderProposalItems(tabProposals.notPending, currentProposalTab === 'received', false);
        }

        // Render modal if open
        this.renderProposalModal();
    }

    renderProposalItems(proposals, isInvitation = false, pendingList = true) {
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
            if (isInvitation) {
                return `
                    <div class="proposal-item" onclick="proposalsController.openInvitationDetail('${p.graphUuid}')">
                        <div class="proposal-info">
                            <span class="proposal-type">Invitation</span>
                            <span class="proposal-graph">${p.graphUuid || 'Unknown Graph'}</span>
                        </div>
                        <div class="proposal-status ${p.answered ? 'status-executed' : 'status-pending'}">
                            ${p.answered ? 'Answered' : 'Pending'}
                        </div>
                    </div>
                `;
            }
            return `
                <div class="proposal-item" onclick="proposalsController.openProposalDetail('${p.publicHash}', '${p.proposalType}')">
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
            consensusEl.textContent = `${c.yesCount} yes, ${c.noCount} no, ${c.remainingVotes} remaining`;
        } else {
            consensusEl.textContent = 'N/A';
        }

        // Show/hide vote and delete sections based on state
        const voteSection = document.getElementById('proposal-detail-vote-section');
        const deleteSection = document.getElementById('proposal-detail-delete-section');
        const inviteSection = document.getElementById('proposal-detail-invite-section');
        const isPending = proposal.proposalStatus === 'Pending';

        voteSection.style.display = 'none';
        deleteSection.style.display = 'none';
        inviteSection.style.display = 'none';

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

    async openProposalDetail(proposalHash, proposalType) {
        console.log(proposalHash, this.stateManager.state.proposals);
        
        this.currentProposalType = proposalType;
        try {
            const allProposals = this.stateManager.state.proposals['all'];
            const proposal = allProposals.find(p => p.publicHash === proposalHash);
            if (!proposal) {
                this.stateManager.showAlert('Proposal not found');
                return;
            }
            this.stateManager.setCurrentProposalDetail(proposal);
        } catch (error) {
            console.error('Failed to load proposal details', error);
            this.stateManager.showAlert('Failed to load proposal details');
        }
    }

    openInvitationDetail(graphUuid) {
        // Invitations are displayed in list format - clicking shows details
        // Accept/decline functionality would be implemented here
        this.stateManager.showAlert(`Invitation to graph: ${graphUuid}\n\nAccept/Decline functionality coming soon.`);
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
}