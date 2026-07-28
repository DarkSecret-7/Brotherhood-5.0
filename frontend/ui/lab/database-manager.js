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

/*
 * Database Manager
 * Handles database operations and snapshot management for the database page
 * Uses DatabaseStateManager for state management
 */
class DatabaseManager {
    constructor(stateManager) {
        this.snapshotsApiService = window.snapshotsApiService;
        this.proposalsApiService = window.proposalsApiService;
        this.authorshipApiService = window.authorshipApiService;
        this.stateManager = stateManager;
        this.initializeEventListeners();
        
        // Subscribe to state changes
        this.stateManager.subscribe(this.handleStateChange.bind(this));
    }

    initializeEventListeners() {
        // Add event listeners for modal triggers if they exist
        document.addEventListener('click', (e) => {
            if (e.target.id === 'global-import-btn') {
                this.openGlobalImportModal();
            }
            if (e.target.id === 'refresh-btn') {
                this.refreshSnapshots(true);
            }
        });

        // Dialog button handlers using event delegation
        document.addEventListener('click', (e) => {
            // Close button (X) click
            if (e.target.closest('#dialogModal .close')) {
                e.preventDefault();
                e.stopPropagation();
                this.stateManager.closeDialog(false);
                return;
            }

            // Cancel button click
            if (e.target.id === 'dialog-cancel-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.stateManager.closeDialog(false);
                return;
            }

            // OK/Confirm button click
            if (e.target.id === 'dialog-confirm-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.stateManager.closeDialog(true);
                return;
            }
        });

        // Overlay click to close
        const dialogModal = document.getElementById('dialogModal');
        if (dialogModal) {
            dialogModal.addEventListener('click', (e) => {
                if (e.target === dialogModal) {
                    this.stateManager.closeDialog(false);
                }
            });
        }
    }

    /**
     * Handle state changes from state manager
     */
    handleStateChange(state) {
        // On first call, ensure all modals are hidden (defensive)
        if (!this._initialized) {
            this._initialized = true;
            const graphActionModal = document.getElementById('graphActionModal');
            const globalImportModal = document.getElementById('globalImportModal');
            const dialogModal = document.getElementById('dialogModal');
            if (graphActionModal) graphActionModal.style.display = 'none';
            if (globalImportModal) globalImportModal.style.display = 'none';
            if (dialogModal) dialogModal.style.display = 'none';
        }

        // Handle loading states
        if (state.isLoading || state.isRefreshing) {
            // Update UI to show loading state if needed
        }

        // Handle errors
        if (state.error) {
            console.error('Database manager error:', state.error);
        }

        // Handle modal states
        if (state.modals.graphAction !== undefined) {
            const modal = document.getElementById('graphActionModal');
            if (modal) {
                modal.style.display = state.modals.graphAction ? 'flex' : 'none';
            }
        }

        if (state.modals.globalImport !== undefined) {
            const modal = document.getElementById('globalImportModal');
            if (modal) {
                modal.style.display = state.modals.globalImport ? 'flex' : 'none';
            }
        }

        // Handle dialog modal
        if (state.modals.dialog !== undefined) {
            const modal = document.getElementById('dialogModal');
            const dialog = state.dialog;
            if (modal) {
                modal.style.display = state.modals.dialog ? 'flex' : 'none';
                
                // Update dialog content
                if (state.modals.dialog) {
                    document.getElementById('dialog-title').textContent = dialog.title;
                    document.getElementById('dialog-body').textContent = dialog.message;
                    
                    const inputContainer = document.getElementById('dialog-input-container');
                    const inputEl = document.getElementById('dialog-input');
                    const cancelBtn = document.getElementById('dialog-cancel-btn');
                    const confirmBtn = document.getElementById('dialog-confirm-btn');
                    
                    if (dialog.type === 'prompt') {
                        inputContainer.style.display = 'block';
                        inputEl.value = dialog.defaultValue || '';
                        cancelBtn.style.display = 'inline-block';
                    } else if (dialog.type === 'confirm') {
                        inputContainer.style.display = 'none';
                        cancelBtn.style.display = 'inline-block';
                    } else {
                        inputContainer.style.display = 'none';
                        cancelBtn.style.display = 'none';
                    }
                    
                    confirmBtn.textContent = dialog.confirmText || 'OK';
                    cancelBtn.textContent = dialog.cancelText || 'Cancel';
                }
            }
        }
    }

    async refreshSnapshots(force = false) {
        const listDiv = document.getElementById('snapshots-list');
        if (!listDiv) return;

        listDiv.innerHTML = '<p class="empty-state">Loading database snapshots...</p>';
        
        try {
            const snapshots = await this.stateManager.refreshSnapshots(force);
            
            if (!snapshots || snapshots.length === 0) {
                listDiv.innerHTML = '<p class="empty-state">No saved graphs found. Import a .knw file to get started!</p>';
                return;
            }

            this.renderSnapshots(snapshots);
        } catch (error) {
            console.error('Failed to refresh snapshots:', error);
            listDiv.innerHTML = '<p class="empty-state">Error loading snapshots. Please try again.</p>';
        }
    }

    renderSnapshots(snapshots) {
        this.stateManager.setLoadedSnapshots(snapshots);
        const listDiv = document.getElementById('snapshots-list');
        if (!listDiv) return;
        
        let html = '<table class="snapshots-table"><thead><tr>\
            <th class="graph-column">Graph</th>\
            <th class="node-column">Nodes</th>\
            <th class="assessable-column">Assessable</th>\
            <th class="author-column">Authors</th>\
            <th class="based-on-column">Based On</th>\
            <th class="action-column">Actions</th>\
            </tr></thead><tbody>';
        
        for (let i = 0; i < snapshots.length; i++) {
            const s = snapshots[i];
            console.log(s);
            
            const createdDate = s.createdAt ? s.createdAt.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown';
            const updatedDate = s.lastUpdated ? s.lastUpdated.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown';
            const versionLabel = s.versionLabel || '#' + s.uuid;
            const authors = s.authors && s.authors.length > 0 
                ? s.authors.map(author => author.username || author.displayName || 'Unknown').join(', ')
                : 'None';
            
            html += '<tr>' +
                '<td class="graph-column" style="cursor: pointer; color: #1a73e8; font-weight: 500;" onclick="databaseManager.openGraphActionModal(\'' + s.uuid + '\')">' +
                    '<div class="version-badge">' + versionLabel + '</div>' +
                    '<div class="database-list-metadata">' +
                        '<b>C:</b> ' + createdDate + '<br>' +
                        '<b>U:</b> ' + updatedDate +
                    '</div>' +
                '</td>' +
                '<td class="node-column">' + (s.nodeCount || 0) + '</td>' +
                '<td class="assessable-column">' + (s.assessableNodeCount || 0) + '</td>' +
                '<td class="author-column">' + (authors) + '</td>' +
                '<td class="based-on-column">' + (s.baseGraphLabel || 'None') + '</td>' +
                '<td class="action-column">' +
                    '<div style="display: flex; gap: 5px;">' +
                        '<button class="btn btn-primary btn-small" onclick="databaseManager.fetchSnapshotToWorkspace(event, \'' + s.uuid + '\')">Fetch</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }
        
        html += '</tbody></table>';
        listDiv.innerHTML = html;
    }

    openGraphActionModal(graphUuid) {
        const snapshots = this.stateManager.getLoadedSnapshots();
        const snapshot = snapshots.find(s => s.uuid === graphUuid);
        if (!snapshot) return;
        
        this.stateManager.setCurrentGraphActionSnapshot(snapshot);
        
        // Set Graph Name
        document.getElementById('graph-action-label-input').value = snapshot.versionLabel || ('v' + snapshot.uuid);
        
        // Set Info
        document.getElementById('graph-action-uuid').textContent = snapshot.uuid;
        document.getElementById('graph-action-created').textContent = snapshot.createdAt ? snapshot.createdAt.toLocaleString() : 'Unknown';
        document.getElementById('graph-action-updated').textContent = snapshot.lastUpdated ? snapshot.lastUpdated.toLocaleString() : 'Unknown';
        document.getElementById('graph-action-nodes').textContent = snapshot.nodeCount || 0;
        
        // Set Author
        const authorElement = document.getElementById('graph-action-author');
        if (snapshot.authors && snapshot.authors.length > 0) {
            authorElement.textContent = snapshot.authors.map(author => author.username || 'Unknown').join(', ');
        } else {
            authorElement.textContent = 'Unknown';
        }

        // Set onclick for actions
        document.getElementById('graph-action-fetch').addEventListener('click', (event) => {
            event.stopPropagation();
            this.fetchSnapshotToWorkspace(event, snapshot.uuid);
        });
        
        // Set Public Toggle
        document.getElementById('graph-action-public-toggle').checked = snapshot.isPublic || false;
        
        // Set Collaboration Section
        const currentUserUuid = localStorage.getItem('user_uuid');
        const isAuthor = snapshot.authors && snapshot.authors.some(author => author.uuid === currentUserUuid);
        
        const inviteSection = document.getElementById('collaboration-invite');
        const joinSection = document.getElementById('collaboration-join');
        const pendingSection = document.getElementById('pending-section');
        
        if (isAuthor) {
            inviteSection.style.display = 'block';
            joinSection.style.display = 'none';
            pendingSection.style.display = 'block';

            // Proposals
            this.fetchAndRenderProposals(snapshot.uuid);
        } else {
            inviteSection.style.display = 'none';
            joinSection.style.display = 'block';
            pendingSection.style.display = 'none';
            
            // Clear Proposals
            this.stateManager.setPendingProposals([]);
            this.renderPendingProposals([]);

            // Render join request section
            this.fetchAndRenderJoinRequest(snapshot.uuid);
        }
        
        // Reset file input and invite user input field
        const fileInput = document.getElementById('import-file-input');
        const inviteUserInput = document.getElementById('invite-user-uuid-input');
        if (fileInput) fileInput.value = '';
        if (inviteUserInput) inviteUserInput.value = '';
        
        this.stateManager.setModal('graphAction', true);
        document.getElementById('graphActionModal').style.display = 'flex';
    }

    async fetchAndRenderJoinRequest(graphUuid) {
        try {
            const joinRequest = await this.stateManager.fetchLatestJoinRequestForGraph(graphUuid);
            this.renderJoinRequest(joinRequest);
        } catch (err) {
            console.error('Failed to fetch join request:', err);
            this.renderJoinRequest(null);
        }
    }

    async renderJoinRequest(joinRequest) {
        const joinSection = document.getElementById('collaboration-join');
        if (!joinSection) return;

        console.log(joinRequest);

        // Renders join request according to proposal status
        let html = '';
        if (joinRequest && joinRequest.proposalStatus !== "approved") {
            html += '<p style="margin: 0 0 10px 0; color: #5f6368;">Join request sent.</p>';
            html += '<div id="collaboration-join-actions" style="display: flex; gap: 10px;">';
            if (joinRequest.proposalStatus === "Pending") {
                html += '<button class="btn btn-primary btn-small" disabled onclick="">Requested To Join</button>';
                html += '<button class="btn btn-danger btn-small" onclick="databaseManager.triggerDeleteProposal(\'' + joinRequest.publicHash + '\')">Cancel Request</button>';
            } else if (joinRequest.proposalStatus === "Rejected") {
                html += '<button class="btn btn-danger btn-small" disabled onclick="">Request Rejected</button>';
                html += '<button class="btn btn-primary btn-small" onclick="databaseManager.triggerJoinGraph()">Send Another Request</button>';
            }
            html += '<button class="btn btn-secondary btn-small" onclick="databaseManager.openProposalDetailModal(\'' + joinRequest.publicHash + '\')">Details</button>';
            html += '</div>';
        }
        else {
            html += '<p style="margin: 0 0 10px 0; color: #5f6368;">Request to join this graph as a collaborator.</p>';
            html += '<div id="collaboration-join-actions" style="display: flex; gap: 10px;">';
            html += '<button class="btn btn-primary btn-small" onclick="databaseManager.triggerJoinGraph()">Join Graph</button>';
            html += '</div>';
        }

        joinSection.style.display = 'block';
        joinSection.innerHTML = html;
    }

    async fetchAndRenderProposals(graphUuid) {
        try {
            const proposals = await this.stateManager.fetchProposalsForGraph(graphUuid);
            console.log(proposals);
            
            this.renderPendingProposals(proposals);
        } catch (err) {
            console.error('Failed to fetch proposals:', err);
            this.renderPendingProposals([]);
        }
    }

    renderPendingProposals(proposals) {
        const container = document.getElementById('pending-proposals-list');
        if (!container) return;

        if (!proposals || proposals.length === 0) {
            container.innerHTML = '<p style="color: #5f6368; margin: 0;">No pending proposals</p>';
            return;
        }

        let html = '';
        
        for (const proposal of proposals) {
            const initiatorDisplay = proposal.proposerUsername || proposal.proposerUuid.substring(0, 8);
            const typeDisplay = proposal.proposalType || 'Unknown';
            const statusClass = proposal.userVote === 1 ? 'vote-approve' : (proposal.userVote === -1 ? 'vote-reject' : '');

            html += `<div class="proposal-item ${statusClass}" onclick="databaseManager.openProposalDetailModal('${proposal.publicHash}')">`;
            html += `<span class="proposal-type">${typeDisplay}</span>`;
            html += `<span class="proposal-initiator">by ${initiatorDisplay}</span>`;

            if (proposal.isInitiator) {
                html += `<button class="proposal-delete-btn" onclick="event.stopPropagation(); databaseManager.triggerDeleteProposal('${proposal.publicHash}', true)">&times;</button>`;
            } else if (!proposal.isTarget) {
                const approveClass = proposal.userVote === 1 ? 'active' : '';
                const rejectClass = proposal.userVote === -1 ? 'active' : '';
                const responded = proposal.userVote === 1 || proposal.userVote === -1 ? 'disabled' : '';
                html += `<div class="proposal-vote-buttons" onclick="event.stopPropagation();">`;
                html += `<button class="btn-small proposal-vote-btn approve ${approveClass}" ${responded} onclick="databaseManager.voteProposal('${proposal.publicHash}', 1)">&#10003;</button>`;
                html += `<button class="btn-small proposal-vote-btn reject ${rejectClass}" ${responded} onclick="databaseManager.voteProposal('${proposal.publicHash}', -1)">&#10007;</button>`;
                html += `</div>`;
            }

            html += `</div>`;
        }
        container.innerHTML = html;
    }

    openProposalDetailModal(proposalHash) {
        // Joint Detail Modal for Graph Proposals and Join Requests
        
        const proposals = this.stateManager.getPendingProposals();
        let proposal = proposals.find(p => p.publicHash === proposalHash);
        
        // Check if join request is the proposal
        const joinRequest = this.stateManager.getJoinRequest();
        if (joinRequest && joinRequest.publicHash === proposalHash) proposal = joinRequest;

        if (!proposal) return;

        this.stateManager.setCurrentProposalDetail(proposal);

        document.getElementById('proposal-detail-type').textContent = proposal.proposalType || 'Unknown';
        document.getElementById('proposal-detail-hash').textContent = proposal.publicHash || '';
        document.getElementById('proposal-detail-time').textContent = proposal.proposalTime ? proposal.proposalTime.toLocaleString() : 'Unknown';
        document.getElementById('proposal-detail-initiator').textContent = proposal.proposerUsername || proposal.proposerUuid || 'Unknown';
        document.getElementById('proposal-detail-target').textContent = proposal.targetUsername || proposal.targetUserUuid || 'N/A';
        document.getElementById('proposal-detail-status').textContent = proposal.proposalStatus || 'Unknown';

        if (proposal.consensus) {
            document.getElementById('proposal-detail-consensus').textContent =
                `Yes: ${proposal.consensus.yesCount}, No: ${proposal.consensus.noCount}, Remaining: ${proposal.consensus.remainingVotes}`;
        } else {
            document.getElementById('proposal-detail-consensus').textContent = 'N/A';
        }

        const detailInviteSection = document.getElementById('proposal-detail-invite-section');
        const detailVoteSection = document.getElementById('proposal-detail-vote-section');
        const detailDeleteSection = document.getElementById('proposal-detail-delete-section');

        if (proposal.isInitiator) {
            detailInviteSection.style.display = 'none';
            detailVoteSection.style.display = 'none';
            detailDeleteSection.style.display = proposal.proposalStatus === "Pending" ? 'block' : 'none';
        } else if (!proposal.isTarget) {
            detailInviteSection.style.display = 'none';
            detailVoteSection.style.display = 'block';
            detailDeleteSection.style.display = 'none';

            const approveBtn = document.getElementById('proposal-detail-approve-btn');
            const rejectBtn = document.getElementById('proposal-detail-reject-btn');
            approveBtn.className = 'btn btn-primary btn-small' + (proposal.userVote === 1 ? ' active' : '');
            rejectBtn.className = 'btn btn-danger btn-small' + (proposal.userVote === -1 ? ' active' : '');
            if (proposal.userVote === 1 || proposal.userVote === -1) {
                approveBtn.disabled = true;
                rejectBtn.disabled = true;
            }
        } else {
            detailInviteSection.style.display = 'none';
            detailVoteSection.style.display = 'none';
            detailDeleteSection.style.display = 'none';
        }

        this.stateManager.setModal('proposalDetail', true);
        document.getElementById('proposalDetailModal').style.display = 'flex';
    }

    closeProposalDetailModal() {
        const modal = document.getElementById('proposalDetailModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.stateManager.setModal('proposalDetail', false);
        this.stateManager.setCurrentProposalDetail(null);
    }

    async triggerDeleteProposal(proposalHash, authorship = false) {
        // Wrapper for deleteProposal with confirmation
        const confirm = await this.stateManager.customConfirm('Are you sure you want to delete this proposal?');
        if (!confirm) return;
        await this.deleteProposal(proposalHash, authorship);
    }

    async deleteProposal(proposalHash, authorship = false) {
        try {
            const success = await proposalsApiService.deleteProposal(proposalHash);

            if (success) {
                const graphUuid = this.stateManager.state.currentGraphActionSnapshot.uuid;
                
                if (authorship) this.fetchAndRenderProposals(graphUuid);
                else this.fetchAndRenderJoinRequest(graphUuid);
                this.closeProposalDetailModal();

                this.stateManager.customAlert('Successful deletion: Proposal deleted successfully!');
            }
        } catch (err) {
            this.stateManager.customAlert('Error deleting proposal: ' + err.message);
        }
    }

    async voteProposal(proposalHash, vote) {
        // Get proposal detail
        const proposal = this.stateManager.getPendingProposals().find(p => p.publicHash === proposalHash);
        const lastVote = proposal.consensus.remainingVotes <= 1;
        if (lastVote) {
            const confirm = await this.stateManager.customConfirm('This is the last vote, the proposal will be immediately executed or rejected. Are you sure?');
            if (!confirm) return;
        }

        try {
            const frontendProposalConsent = {
                proposalHash: proposalHash,
                userUuid: window.authApiService?.getCurrentUserUuid(),
                userVote: vote
            }

            const backendProposalConsent = window.proposalsTransformer.transformProposalConsentToBackend(frontendProposalConsent);
            const result = await proposalsApiService.respondToProposal(proposalHash, backendProposalConsent);
            console.log(result);

            if (result.success) {
                const graphUuid = this.stateManager.state.currentGraphActionSnapshot.uuid;
                if (lastVote) {
                    this.closeProposalDetailModal();
                    await this.refreshSnapshots(true);          // Hard refresh if it was last vote
                    this.openGraphActionModal(graphUuid);       // Wait for refresh to complete and then reopen
                }
                this.fetchAndRenderProposals(graphUuid);
                // this.fetchAndRenderJoinRequest(graphUuid);   // Do NOT fetch join request because user is an author
                
                this.stateManager.customAlert(result.message);
            }
        } catch (err) {
            this.stateManager.customAlert('Error submitting vote: ' + err.message);
        }
    }

    closeGraphActionModal() {
        const modal = document.getElementById('graphActionModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.stateManager.setCurrentGraphActionSnapshot(null);
        this.stateManager.setModal('graphAction', false);
    }

    async fetchSnapshotToWorkspace(event, snapshotUuid) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Find the snapshot to get its version label for display
        const snapshots = this.stateManager.getLoadedSnapshots();
        const snapshot = snapshots.find(s => s.uuid === snapshotUuid);
        const displayLabel = snapshot ? snapshot.versionLabel : '#' + snapshotUuid;

        const confirmMsg = `STOP! This will clear your current workspace and load snapshot "${displayLabel}" (UUID: ${snapshotUuid}). Continue?`;
        
        const confirmed = await this.stateManager.customConfirm(confirmMsg);
        if (confirmed) {
            try {
                await this.stateManager.fetchSnapshotToWorkspace(snapshotUuid);
                window.location.href = '/lab/workspace';
            } catch (err) {
                this.stateManager.customAlert('Error fetching snapshot: ' + err.message);
            }
        }
    }

    async saveGraphChanges() {
        const newLabel = document.getElementById('graph-action-label-input').value;
        const isPublic = document.getElementById('graph-action-public-toggle').checked;
        
        try {
            await this.stateManager.saveGraphChanges(newLabel, isPublic);
            this.stateManager.customAlert('Changes saved successfully!');
            this.closeGraphActionModal();
            this.refreshSnapshots(true);
        } catch (err) {
            this.stateManager.customAlert('Error saving changes: ' + err.message);
        }
    }

    async triggerExportGraph() {
        try {
            const { blob, label } = await this.stateManager.exportGraph();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = label + '.knw';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            this.stateManager.customAlert('Export failed: ' + err.message);
        }
    }

    async triggerImportGraph() {
        const fileInput = document.getElementById('import-file-input');
        
        if (!fileInput || fileInput.files.length === 0) {
            this.stateManager.customAlert('Please select a .knw file.');
            return;
        }
        
        const file = fileInput.files[0];
        
        const confirmed = await this.stateManager.customConfirm('WARNING: This will completely replace the current graph with the imported file. Are you sure?');
        if (confirmed) {
            try {
                await this.stateManager.importGraph(file);
                this.stateManager.customAlert('Graph overwritten successfully!');
                this.closeGraphActionModal();
            } catch (err) {
                this.stateManager.customAlert('Import error: ' + err.message);
            }
        }
    }

    async triggerDeleteGraph() {
        // TODO: Implement custom confirmation based on number of collaborators
        // Show warning if graph has collaborator and notify user of making a proposal, instead of direct deletion

        const confirmed = await this.stateManager.customConfirm('PERMANENT DELETE! Are you sure you want to remove this graph?');
        if (confirmed) {
            try {
                await this.stateManager.deleteGraph();
                this.closeGraphActionModal();
                this.refreshSnapshots(true);
            } catch (err) {
                this.stateManager.customAlert('Error deleting graph: ' + err.message);
            }
        }
    }

    async triggerJoinGraph() {
        const snapshot = this.stateManager.getCurrentGraphActionSnapshot();
        if (!snapshot) {
            this.stateManager.customAlert('No graph selected.');
            return;
        }

        const confirmed = await this.stateManager.customConfirm('Request to join this graph as a collaborator?');
        if (confirmed) {
            try {
                const result = await this.authorshipApiService.joinGraph(snapshot.uuid);
                if (result.success) {
                    this.stateManager.customAlert('Join request submitted successfully!');
                    this.fetchAndRenderJoinRequest(snapshot.uuid);
                } else {
                    console.warn(result);
                    this.stateManager.customAlert('Join request failed: ' + result.detail);
                }
            } catch (err) {
                this.stateManager.customAlert('Error: ' + err.message);
            }
        }
    }

    async triggerInviteUser() {
        const snapshot = this.stateManager.getCurrentGraphActionSnapshot();
        if (!snapshot) {
            this.stateManager.customAlert('No graph selected.');
            return;
        }

        const targetUserUuid = document.getElementById('invite-user-uuid-input').value.trim();
        if (!targetUserUuid) {
            this.stateManager.customAlert('Please enter a user UUID.');
            return;
        }

        const confirmed = await this.stateManager.customConfirm('Invite this user to collaborate on the graph?');
        if (confirmed) {
            try {
                const result = await this.authorshipApiService.inviteToGraph(snapshot.uuid, targetUserUuid);
                console.log(result);
                if (result.success) {
                    if (result.direct) {
                        this.stateManager.customAlert('Collaboration invitation sent successfully');
                    } else {
                        this.stateManager.customAlert('Invite proposal created successfully!');
                    }
                    document.getElementById('invite-user-uuid-input').value = '';
                    this.fetchAndRenderProposals(snapshot.uuid);
                }
            } catch (err) {
                this.stateManager.customAlert('Error: ' + err.message);
            }
        }
    }

    openGlobalImportModal() {
        document.getElementById('global-import-file').value = '';
        document.getElementById('global-import-overwrite').checked = false;
        this.stateManager.setModal('globalImport', true);
        document.getElementById('globalImportModal').style.display = 'flex';
    }

    closeGlobalImportModal() {
        const modal = document.getElementById('globalImportModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.stateManager.setModal('globalImport', false);
    }

    async submitGlobalImport() {
        const fileInput = document.getElementById('global-import-file');
        const overwrite = document.getElementById('global-import-overwrite').checked;

        if (!fileInput || fileInput.files.length === 0) {
            this.stateManager.customAlert('Please select a .knw file.');
            return;
        }

        const file = fileInput.files[0];
        
        try {
            await this.stateManager.globalImportGraph(file, overwrite);
            this.stateManager.customAlert('Graph imported successfully!');
            this.closeGlobalImportModal();
            this.refreshSnapshots(true);
        } catch (err) {
            this.stateManager.customAlert('Import error: ' + err.message);
        }
    }
}

// Initialize database manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if required services are available
    if (window.snapshotsApiService && window.databaseStateManager && window.snapshotsTransformer && window.proposalsApiService) {
        // Initialize database manager
        window.databaseManager = new DatabaseManager(window.databaseStateManager);
        
        // Auto-load snapshots
        window.databaseManager.refreshSnapshots(false);
    } else {
        console.error('Required services not available:', {
            snapshotsApiService: !!window.snapshotsApiService,
            databaseStateManager: !!window.databaseStateManager,
            snapshotsTransformer: !!window.snapshotsTransformer,
            proposalsApiService: !!window.proposalsApiService
        });
    }
});

