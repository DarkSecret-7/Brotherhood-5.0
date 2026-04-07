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
        const nodeData = {
            id: this.elements.addNode.localId.value ? parseInt(this.elements.addNode.localId.value) : null,
            title: this.elements.addNode.title.value.trim(),
            description: this.elements.addNode.description.value.trim(),
            prerequisites: this.elements.addNode.prerequisite.value.trim(),
            domainId: this.elements.addNode.domainId.value ? parseInt(this.elements.addNode.domainId.value) : null,
            assessable: this.elements.addNode.assessable.checked,
            sources: formSources.filter(s => !s._isDeleted) // Only include non-deleted sources
        };

        
        if (!nodeData.title) {
            this.stateManager.customAlert('Node title is required');
            return;
        }

        if (!nodeData.id || nodeData.id <= 0) {
            this.stateManager.customAlert('Valid node ID is required');
            return;
        }

        // Add node to state with error handling
        try {
            this.stateManager.addNode(nodeData);
            
            // Reset form (except domainId)
            const currentDomainId = this.elements.addNode.domainId.value;
            this.stateManager.resetForm('newNode');
            this.elements.addNode.domainId.value = currentDomainId;
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
            parentId: null // Will be set if grouping
        };

        // Validate
        if (!domainData.title) {
            this.stateManager.customAlert('Domain title is required');
            return;
        }

        if (!domainData.id || domainData.id <= 0) {
            this.stateManager.customAlert('Valid domain ID is required');
            return;
        }

        // Check if we have selected items to group
        const { selectedNodes, selectedDomains } = this.stateManager.state;
        const hasSelections = selectedNodes.size > 0 || selectedDomains.size > 0;
        
        // Set parent to common parent of selected items
        if (hasSelections) {
            const commonParent = this.stateManager.getCommonParentFromSelection();
            if (commonParent !== false) {
                domainData.parentId = commonParent;
            } else {
                this.stateManager.showMessage('No common parent found for selected items', 'error');
                return;
            }
        }

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
            assessable: editFormElements.assessable.checked
        };
        
        // Validate form
        if (!nodeData.title) {
            this.stateManager.customAlert('Node title is required');
            return;
        }
        
        if (!nodeData.id || nodeData.id <= 0) {
            this.stateManager.customAlert('Valid node ID is required');
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
                assessable: nodeData.assessable,
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
            this.stateManager.customAlert('Domain title is required');
            return;
        }
        
        if (!domainData.id || domainData.id <= 0) {
            this.stateManager.customAlert('Valid domain ID is required');
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
        this.stateManager.updateForm('dialog', {
            title: 'Delete Node',
            message: 'Are you sure you want to delete this node?',
            input: '',
            callback: (confirmed) => {
                if (confirmed) {
                    this.stateManager.deleteNode(nodeId);
                }
            }
        });
        this.stateManager.toggleModal('dialog', true);
    }

    /**
     * Delete domain with confirmation
     * @param {number} domainId - Domain ID to delete
     */
    deleteDomain(domainId) {
        // Show dialog via state manager
        this.stateManager.showDialog(
            title = 'Delete Domain', 
            message = 'Are you sure you want to delete this domain and all its contents?', 
            type = 'alert', 
            callback = (confirmed) => {
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
        Object.assign(form, node);

        // Populate HTML form elements
        const editFormElements = window.labUIController.elements.forms.editNode;
        if (editFormElements) {
            editFormElements.localId.value = node.id || '';
            editFormElements.title.value = node.title || '';
            editFormElements.description.value = node.description || '';
            editFormElements.prerequisite.value = node.prerequisites || '';
            editFormElements.propagateChanges.checked = node.propagateChanges !== false; // Default to true
            editFormElements.assessable.checked = node.assessable || false;
        }

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
        Object.assign(form, domain);

        // Populate HTML form elements
        const editFormElements = window.labUIController.elements.forms.editDomain;
        if (editFormElements) {
            editFormElements.localId.value = domain.id || '';
            editFormElements.title.value = domain.title || '';
            editFormElements.description.value = domain.description || '';
        }

        // Update domain ID display in modal header
        const domainIdDisplay = document.getElementById('edit-domain-id-display');
        if (domainIdDisplay) {
            domainIdDisplay.textContent = `#${domain.id}`;
        }

        // Open modal via state manager
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
                this.stateManager.showMessage('Cannot restore node: parent domain is marked for deletion', 'error');
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
            // Check if selected items have a common parent
            /*if (this.stateManager.getCommonParentFromSelection() === false) {
                this.stateManager.showMessage('Cannot group items: selected items must have a common parent', 'error');
                return;
            }*/

           console.log("Has Selections");
           
        }
        
        // Open create domain modal via state manager
        this.stateManager.toggleModal('createDomain', true);
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
            this.stateManager.customAlert('Version label is required');
            return;
        }
        if (!this.databaseStateManager) {
            this.stateManager.customAlert('Database management orchestration is not available.');
            return;
        }

        try {
            this.stateManager.setLoading(true);

            // Export raw draft and delegate persistence to database management orchestration
            const workspaceDraft = this.stateManager.exportWorkspace({ versionLabel, overwrite });
            
            // Show confirmation dialog for overwrites
            if (overwrite) {
                this.stateManager.customConfirm(
                    'Are you sure you want to overwrite the existing snapshot? This will replace all data.',
                    async (confirmed) => {
                        if (confirmed) {
                            try {
                                const savedSnapshot = await this.databaseStateManager.saveWorkspaceSnapshot(workspaceDraft);
                                // Keep workspace synced to canonical saved snapshot
                                this.stateManager.loadSnapshot(savedSnapshot);
                                // Show success alert
                                this.stateManager.customAlert(`Snapshot saved successfully (UUID: ${savedSnapshot.uuid}).`);
                            } catch (error) {
                                this.stateManager.customAlert(`Save Error: ${error.message}`);
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
            console.log('workspaceDraft', workspaceDraft);
            const savedSnapshot = await this.databaseStateManager.saveWorkspaceSnapshot(workspaceDraft);

            // Keep workspace synced to canonical saved snapshot
            this.stateManager.loadSnapshot(savedSnapshot);
            // Show success alert
            this.stateManager.customAlert(`Snapshot saved successfully (UUID: ${savedSnapshot.uuid}).`);
        } catch (error) {
            this.stateManager.customAlert(`Save Error: ${error.message}`);
        } finally {
            this.stateManager.setLoading(false);
        }
    }

    /**
     * Handle clear workspace
     */
    handleClearWorkspace() {
        // Show confirm dialog via state manager
        this.stateManager.customConfirm(
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
}

window.WorkspaceOpsController = WorkspaceOpsController;

