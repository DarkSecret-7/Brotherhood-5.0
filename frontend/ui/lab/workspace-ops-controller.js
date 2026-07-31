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
 * Workspace Operations Controller - Manages workspace operations only
 * Focuses on what to display and user interactions only
 */
class WorkspaceOpsController {
    constructor(stateManager, databaseStateManager = null) {
        this.stateManager = stateManager;
        this.databaseStateManager = databaseStateManager || window.databaseStateManager || null;
        this.initializeElements();
        this.bindEventListeners();
    }

    initializeElements() {
        this.elements = {};

        this.elements.addNode = {
            domainId: document.getElementById('node-parent-domain'),
            localId: document.getElementById('node-id'),
            title: document.getElementById('node-title'),
            description: document.getElementById('node-desc'),
            prerequisite: document.getElementById('node-pre'),
            assessable: document.getElementById('node-assessable'),
            sources: document.getElementById('new-node-sources')
        }

        this.elements.addDomain = {
            id: document.getElementById('create-domain-id'),
            parentId: document.getElementById('domain-parent-domain'),
            title: document.getElementById('create-domain-title'),
            description: document.getElementById('create-domain-desc')
        }
    }

    bindEventListeners() {

    }

    // Add node
    addNode() {
        // Get sources from form state
        const formSources = this.stateManager.state.forms.newNode.sources || [];
        
        // Validate form
        const isMobile = window.innerWidth <= 768;
        const localIdVal = isMobile ? document.getElementById('modal-node-id')?.value : this.elements.addNode.localId.value;
        const titleVal = isMobile ? document.getElementById('modal-node-title')?.value : this.elements.addNode.title.value;
        const descVal = isMobile ? document.getElementById('modal-node-desc')?.value : this.elements.addNode.description.value;
        const preVal = isMobile ? document.getElementById('modal-node-pre')?.value : this.elements.addNode.prerequisite.value;
        const domainIdVal = isMobile ? document.getElementById('modal-node-parent-domain')?.value : this.elements.addNode.domainId.value;

        const nodeData = {
            id: localIdVal ? parseInt(localIdVal) : null,
            title: (titleVal || '').trim(),
            description: (descVal || '').trim(),
            prerequisites: (preVal || '').trim(),
            domainId: domainIdVal ? parseInt(domainIdVal) : null,
            sources: formSources.filter(s => !s._isDeleted) // Only include non-deleted sources
        };

        if (!nodeData.title) {
            this.stateManager.showAlert('Node title is required');
            return;
        }

        if (!nodeData.id || nodeData.id <= 0 || typeof nodeData.id !== 'number') {
            this.stateManager.showAlert('Valid node ID is required');
            return;
        }

        // Add node to state with error handling
        try {
            this.stateManager.addNode(nodeData);
            
            // Reset form (preserves domainId)
            this.stateManager.resetForm('newNode');
            
            if (isMobile) {
                // Clear modal inputs specifically
                const modalId = document.getElementById('modal-node-id');
                const modalTitle = document.getElementById('modal-node-title');
                const modalDesc = document.getElementById('modal-node-desc');
                const modalPre = document.getElementById('modal-node-pre');
                if (modalId) modalId.value = '';
                if (modalTitle) modalTitle.value = '';
                if (modalDesc) modalDesc.value = '';
                if (modalPre) modalPre.value = '';
                
                // Close modal
                this.stateManager.toggleModal('createNode', false);
            }
            
            // Render sidebar forms to update UI
            window.labUIController.renderSidebarForms();
            
            this.stateManager.showMessage('Node added successfully', 'success');
        } catch (error) {
            this.stateManager.showMessage(error.message, 'error');
        }
    }
    
    // Add domain
    addDomain() {        
        // Get form values
        const domainData = {
            id: parseInt(this.elements.addDomain.id.value) || null,
            title: this.elements.addDomain.title.value.trim(),
            description: this.elements.addDomain.description.value.trim(),
            parentId: parseInt(this.elements.addDomain.parentId.value), // Overrides common parent if automatically set upon modal opening
        };

        // Validate
        if (!domainData.title) {
            this.stateManager.showAlert('Domain title is required');
            throw new Error('Domain title is required');
        }

        if (!domainData.id || domainData.id <= 0 || typeof domainData.id !== 'number') {
            this.stateManager.showAlert('Valid domain ID is required');
            throw new Error('Valid domain ID is required');
        }

        if (domainData.parentId <= 0 || typeof domainData.parentId !== 'number') {
            this.stateManager.showAlert('Invalid parent domain ID');
            throw new Error('Invalid parent domain ID');
        }

        // Check if we have selected items to group
        const hasSelections = this.stateManager.state.selectedNodes.size > 0 || this.stateManager.state.selectedDomains.size > 0;

        // Add domain to state with error handling
        try {
            this.stateManager.addDomain(domainData);
            
            if (hasSelections) {
                // Move selected items into the new domain
                this.stateManager.moveSelectedToDomain(domainData.id);
                this.stateManager.showMessage('Domain created and items grouped successfully', 'success');
            } else {
                this.stateManager.showMessage('Domain added successfully', 'success');
            }

            // Reset form (preserves parentId)
            this.stateManager.resetForm('newDomain');
            
            // Render sidebar forms to update UI
            window.labUIController.renderSidebarForms();
            
            this.stateManager.toggleModal('createDomain', false);
        } catch (error) {
            this.stateManager.showMessage(error.message, 'error');
        }
    }

    /**
     * Update node from form data
     */
    updateNode() {
        // Read form values directly from HTML elements
        const editFormElements = window.labUIController.elements.forms.editNode;
        if (!editFormElements) return;
        
        const nodeData = {
            id: parseInt(editFormElements.localId.value) || null,
            title: editFormElements.title.value.trim(),
            description: editFormElements.description.value.trim(),
            prerequisites: editFormElements.prerequisite.value.trim(),
            // assessable: editFormElements.assessable.checked
        };
        
        // Validate form
        if (!nodeData.title) {
            this.stateManager.showAlert('Node title is required');
            return;
        }
        
        if (!nodeData.id || nodeData.id <= 0 || typeof nodeData.id !== 'number') {
            this.stateManager.showAlert('Valid node ID is required');
            return;
        }
        
        // Update node in state
        try {
            // Get sources from form state (which was populated during editNode)
            const form = this.stateManager.state.forms.editNode;
            
            this.stateManager.updateNode(nodeData.id, {
                title: nodeData.title,
                description: nodeData.description,
                prerequisites: nodeData.prerequisites,
                // assessable: nodeData.assessable,
                sources: form.sources || []
            },
            editFormElements.propagateChanges.checked);
            
            // Close modal via state manager
            this.stateManager.toggleModal('editNode', false);
            this.stateManager.showMessage('Node updated successfully', 'success');
        } catch (error) {
            this.stateManager.showMessage(error.message, 'error');
        }
    }

    /**
     * Update domain from form data
     */
    updateDomain() {
        // Read form values directly from HTML elements
        const editFormElements = window.labUIController.elements.forms.editDomain;
        if (!editFormElements) return;
        
        const domainData = {
            id: parseInt(editFormElements.localId.value) || null,
            title: editFormElements.title.value.trim(),
            description: editFormElements.description.value.trim()
        };
        
        // Validate form
        if (!domainData.title) {
            this.stateManager.showAlert('Domain title is required');
            return;
        }
        
        if (!domainData.id || domainData.id <= 0 || typeof domainData.id !== 'number') {
            this.stateManager.showAlert('Valid domain ID is required');
            return;
        }
        
        // Update domain in state
        try {
            this.stateManager.updateDomain(domainData.id, {
                title: domainData.title,
                description: domainData.description
            });
            
            // Close modal via state manager
            this.stateManager.toggleModal('editDomain', false);
            this.stateManager.showMessage('Domain updated successfully', 'success');
        } catch (error) {
            this.stateManager.showMessage(error.message, 'error');
        }
    }

    /**
     * Delete node with confirmation
     * @param {number} nodeId - Node ID to delete
     */
    deleteNode(nodeId) {
        // Show dialog via state manager
        this.stateManager.showConfirm(
            'Are you sure you want to delete this node?',
            (confirmed) => {
                if (confirmed) {
                    this.stateManager.deleteNode(nodeId);
                }
            }
        );
    }

    /**
     * Delete domain with confirmation
     * @param {number} domainId - Domain ID to delete
     */
    deleteDomain(domainId) {
        // Show dialog via state manager
        this.stateManager.showConfirm(
            'Are you sure you want to delete this domain and all its contents?',
            (confirmed) => {
                if (confirmed) {
                    this.stateManager.deleteDomain(domainId);
                }
            }
        );
    }

    /**
     * Edit node - populate form and open modal
     * @param {number} nodeId - Node ID to edit
     */
    editNode(nodeId) {
        const node = this.stateManager.state.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Populate edit form via state manager
        const form = this.stateManager.state.forms.editNode;
        Object.assign(form, {
            localId: node.id,
            title: node.title,
            description: node.description,
            prerequisite: node.prerequisites,
            propagateChanges: node.propagateChanges !== false,
            // assessable: node.assessable || false,
            sources: node.sources || []
        });

        // Open modal via state manager - UI controller will render via handleStateChange
        this.stateManager.toggleModal('editNode', true);
    }

    /**
     * Edit domain - populate form and open modal
     * @param {number} domainId - Domain ID to edit
     */
    editDomain(domainId) {
        const domain = this.stateManager.state.domains.find(d => d.id === domainId);
        if (!domain) return;

        // Populate edit form via state manager
        const form = this.stateManager.state.forms.editDomain;
        Object.assign(form, {
            localId: domain.id,
            title: domain.title,
            description: domain.description
        });

        // Open modal via state manager - UI controller will render via handleStateChange
        this.stateManager.toggleModal('editDomain', true);
    }

    /**
     * Eject node from its current domain and move to grandparent domain
     * @param {number} nodeId - Node ID to eject
     */
    ejectNode(nodeId) {
        const node = this.stateManager.state.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Can only eject if node has a parent domain
        if (!node.domainId) {
            this.stateManager.showMessage('Node is already at root level', 'error');
            return;
        }

        const currentDomain = this.stateManager.state.domains.find(d => d.id === node.domainId);
        if (!currentDomain) {
            this.stateManager.showMessage('Parent domain not found', 'error');
            return;
        }

        // Move node to grandparent domain (could be null for root)
        const grandparentId = currentDomain.parentId;
        this.stateManager.updateNode(nodeId, {
            domainId: grandparentId
        });

        const destination = grandparentId ? `domain #${grandparentId}` : 'root level';
        this.stateManager.showMessage(`Node ejected to ${destination}`, 'success');
    }

    /**
     * Eject domain from its current parent and move to grandparent domain
     * @param {number} domainId - Domain ID to eject
     */
    ejectDomain(domainId) {
        const domain = this.stateManager.state.domains.find(d => d.id === domainId);
        if (!domain) return;

        // Can only eject if domain has a parent
        if (!domain.parentId) {
            this.stateManager.showMessage('Domain is already at root level', 'error');
            return;
        }

        const currentParent = this.stateManager.state.domains.find(d => d.id === domain.parentId);
        if (!currentParent) {
            this.stateManager.showMessage('Parent domain not found', 'error');
            return;
        }

        // Move domain to grandparent domain (could be null for root)
        const grandparentId = currentParent.parentId;
        this.stateManager.updateDomain(domainId, {
            parentId: grandparentId
        });

        const destination = grandparentId ? `domain #${grandparentId}` : 'root level';
        this.stateManager.showMessage(`Domain ejected to ${destination}`, 'success');
    }

    restoreNode(nodeId) {
        // Check if parent domain is not marked for delete
        const node = this.stateManager.state.nodes.find(n => n.id === nodeId);
        if (node) {
            const parentDomain = this.stateManager.state.domains.find(d => d.id === node.domainId);
            if (parentDomain && parentDomain._isDeleted) {
                this.stateManager.showAlert('Cannot restore node: parent domain is marked for deletion');
                return;
            }
        }

        this.stateManager.restoreNode(nodeId);
    }

    restoreDomain(domainId) {
        // Check if parent domain is not marked for delete
        const domain = this.stateManager.state.domains.find(d => d.id === domainId);
        if (domain) {
            const parentDomain = this.stateManager.state.domains.find(d => d.id === domain.parentId);
            if (parentDomain && parentDomain._isDeleted) {
                this.stateManager.showMessage('Cannot restore domain: parent domain is marked for deletion', 'error');
                return;
            }
        }

        this.stateManager.restoreDomain(domainId);
    }

    /**
     * Handle add domain
     */
    handleAddDomain() {
        const { selectedNodes, selectedDomains } = this.stateManager.state;
        const hasSelections = selectedNodes.size > 0 || selectedDomains.size > 0;
        
        if (hasSelections) {
            console.log("Has Selections"); 
            
            // Automatic parent suggestion to common parent of selected items (soft rule, can be overridden in modal)
            const commonParent = this.stateManager.getCommonParentFromSelection();
            if (commonParent !== false) {
                this.elements.addDomain.parentId.value = commonParent;
            } else {
                this.elements.addDomain.parentId.value = null;
                this.stateManager.showAlert('No common parent found for selected items. Domain will be at root level, Override the parent in next modal if you wish to change this.');
            }
        }
        
        // Open create domain modal via state manager
        this.stateManager.toggleModal('createDomain', true);
    }

    /**
     * Handle open add node modal
     */
    handleOpenAddNodeModal() {
        const { selectedNodes, selectedDomains } = this.stateManager.state;
        const hasSelections = selectedNodes.size > 0 || selectedDomains.size > 0;
        
        const parentInput = document.getElementById('modal-node-parent-domain');
        if (parentInput) {
            if (hasSelections) {
                // Automatic parent suggestion to common parent of selected items (soft rule)
                const commonParent = this.stateManager.getCommonParentFromSelection();
                if (commonParent !== false) {
                    parentInput.value = commonParent;
                } else {
                    parentInput.value = '';
                }
            } else {
                parentInput.value = '';
            }
        }
        
        // Open create node modal via state manager
        this.stateManager.toggleModal('createNode', true);
    }

    /**
     * Handle save snapshot
     */
    async handleSaveSnapshot() {
        console.log("Saving...");
        
        // Get version label from UI - need to access the element
        const versionLabelElement = document.getElementById('version-label');
        const versionLabel = versionLabelElement ? versionLabelElement.value.trim() : '';
        const overwriteToggleElement = document.getElementById('overwrite-toggle');
        const overwrite = overwriteToggleElement ? overwriteToggleElement.checked : false;

        if (!versionLabel) {
            // Show alert via state manager
            this.stateManager.showAlert('Version label is required');
            return;
        }
        if (!this.databaseStateManager) {
            this.stateManager.showAlert('Database management orchestration is not available.');
            return;
        }

        try {
            this.stateManager.setLoading(true);

            // Export raw draft and delegate persistence to database management orchestration
            const workspaceDraft = this.stateManager.exportWorkspace({ versionLabel, overwrite });
            
            // Show confirmation dialog for overwrites
            if (overwrite) {
                this.stateManager.showConfirm(
                    'Are you sure you want to overwrite the existing snapshot? This will replace all data.',
                    async (confirmed) => {
                        if (confirmed) {
                            try {
                                const savedSnapshot = await this.databaseStateManager.saveWorkspaceSnapshot(workspaceDraft);
                                // Keep workspace synced to canonical saved snapshot
                                this.stateManager.loadSnapshot(savedSnapshot);
                                // Show success alert
                                this.stateManager.showAlert(`Snapshot saved successfully (UUID: ${savedSnapshot.currentSnapshotUuid}).`);
                            } catch (error) {
                                this.stateManager.showAlert(`Save Error: ${error.message}`);
                            } finally {
                                this.stateManager.setLoading(false);
                            }
                        } else {
                            this.stateManager.setLoading(false);
                        }
                    }
                );
                return; // Exit here, callback will handle the save
            }

            // Normal save (no overwrite)
            const savedSnapshot = await this.databaseStateManager.saveWorkspaceSnapshot(workspaceDraft);

            // Keep workspace synced to canonical saved snapshot
            this.stateManager.loadSnapshot(savedSnapshot);
            // Show success alert
            this.stateManager.showAlert(`Snapshot saved successfully (UUID: ${savedSnapshot.currentSnapshotUuid}).`);
        } catch (error) {
            this.stateManager.showAlert(`Save Error: ${error.message}`);
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    /**
     * Handle reset workspace
     */
    handleResetWorkspace() {
        // Show confirm dialog via state manager
        this.stateManager.showConfirm(
            'Are you sure you want to reset the workspace? This will refetch the snapshot from the database and clear all changes in the current workspace. If this graph was imported from a file, the database may not have it, or have a different version.',
            async (confirmed) => {
                if (confirmed) {
                    try {
                        await this.databaseStateManager.fetchSnapshotToWorkspace(this.stateManager.state.currentSnapshotUuid);
                        // Load initial data to sync with database
                        this.stateManager.loadInitialData();
                    } catch (error) {
                        this.stateManager.showAlert(`Error resetting workspace: ${error.message}`);
                    } finally {
                        // Load initial data to sync with database
                        this.stateManager.loadInitialData();
                        this.stateManager.setLoading(false);
                    }
                }
            }
        );
    }

       /**
     * Handle clear workspace
     */
    handleClearWorkspace() {
        // Show confirm dialog via state manager
        this.stateManager.showConfirm(
            'Are you sure you want to clear the workspace? All unsaved changes will be lost.',
            (confirmed) => {
                if (confirmed) {
                    this.stateManager.clearWorkspace();
                }
            }
        );
    }

    /**
     * Handle overwrite toggle
     */
    handleOverwriteToggle() {
        const overwriteToggleElement = document.getElementById('overwrite-toggle');
        if (overwriteToggleElement) {
            const isChecked = overwriteToggleElement.checked;
            // Update state or perform other actions as needed
            console.log('Overwrite toggle:', isChecked);
        }
    }

    /**
     * Handle export workspace to a v1.0 .knw file (client-side, binary).
     */
    async handleExportWorkspace() {
        // Get version label and overwrite settings from the same inputs used for database save
        const versionLabelElement = document.getElementById('version-label');
        const overwriteToggleElement = document.getElementById('overwrite-toggle');

        const versionLabel = versionLabelElement ? versionLabelElement.value.trim() : '';
        const overwrite = overwriteToggleElement ? overwriteToggleElement.checked : false;

        if (!versionLabel) {
            this.stateManager.showAlert('Version label is required for export');
            return;
        }

        try {
            await this.stateManager.exportToFile({ versionLabel, overwrite });
            this.stateManager.showMessage(`Exported successfully as ${versionLabel}.knw`, 'success');
        } catch (error) {
            this.stateManager.showMessage(`Export Error: ${error.message}`, 'error');
        }
    }

    /**
     * Handle import workspace from .knw file (client-side)
     */
    handleImportWorkspace() {
        // Trigger file input click
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * Handle file input change for import (v1.0 binary .knw).
     * @param {Event} event - File input change event
     */
    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file extension
        if (!file.name.endsWith('.knw')) {
            this.stateManager.showMessage('Please select a .knw file', 'error');
            event.target.value = '';
            return;
        }

        try {
            // Read as ArrayBuffer (v1.0 .knw is binary)
            const bytes = new Uint8Array(await file.arrayBuffer());

            // Show confirmation dialog before replacing workspace
            this.stateManager.showConfirm(
                `Are you sure you want to import "${file.name}"? This will replace the current workspace with all unsaved changes lost.`,
                async (confirmed) => {
                    if (!confirmed) return;
                    try {
                        await this.stateManager.importFromFile(bytes);
                        this.stateManager.showAlert(`Imported successfully from ${file.name}`);
                    } catch (error) {
                        this.stateManager.showAlert(`Import Error: ${error.message}`);
                    }
                }
            );
        } catch (error) {
            this.stateManager.showMessage(`Failed to read file: ${error.message}`, 'error');
        }

        // Clear file input
        event.target.value = '';
    }
}

window.WorkspaceOpsController = WorkspaceOpsController;

