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
 * Lab UI Controller - Manages UI interactions and display
 * Focuses on what to display and user interactions only
 */
class LabUIController {
    constructor(stateManager, llmOpsController) {
        this.stateManager = stateManager;
        this.llmOpsController = llmOpsController;
        this.initializeElements();
        this.bindEventListeners();
        
        // Subscribe to state changes before initializing UI
        const boundCallback = this.handleStateChange.bind(this);
        this.stateManager.subscribe(boundCallback);
        
        // Initialize UI after subscription is set up
        this.initializeUI();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Initialize elements object
        this.elements = {};
        
        // Workspace elements
        this.elements.workspace = {
            nodeList: document.getElementById('draft-nodes-list'),
            draftNodesList: document.getElementById('draft-nodes-list'),
            versionLabel: document.getElementById('current-version-label'),
            versionInfo: document.getElementById('active-version-info'),
            clearBtn: document.getElementById('btn-clear-workspace'),
            draftCount: document.getElementById('draft-count'),
            newNodeForm: document.getElementById('new-node-form')
        };
        
        // Form elements
        this.elements.forms = {
            newNode: {
                domainId: document.getElementById('node-parent-domain'),
                localId: document.getElementById('node-id'),
                title: document.getElementById('node-title'),
                description: document.getElementById('node-desc'),
                prerequisite: document.getElementById('node-pre'),
                assessable: document.getElementById('node-assessable'),
                sources: document.getElementById('new-node-sources')
            },
            editNode: {
                localId: document.getElementById('edit-node-id'),
                title: document.getElementById('edit-node-title'),
                description: document.getElementById('edit-node-desc'),
                prerequisite: document.getElementById('edit-node-pre'),
                propagateChanges: document.getElementById('edit-node-propagate'),
                assessable: document.getElementById('edit-node-assessable'),
                sources: document.getElementById('edit-node-sources')
            },
            editDomain: {
                localId: document.getElementById('edit-domain-id'),
                title: document.getElementById('edit-domain-title'),
                description: document.getElementById('edit-domain-desc')
            },
            newDomain: {
                localId: document.getElementById('create-domain-id'),
                title: document.getElementById('create-domain-title'),
                description: document.getElementById('create-domain-desc'),
                parentId: document.getElementById('domain-parent-id')
            }
        };
        
        // Buttons
        this.elements.buttons = {
            addNode: document.querySelector('.btn-primary[onclick*="handleAddNode"]'),
            addDomain: document.getElementById('btn-group-domain'),
            llmSuggest: document.getElementById('btn-llm-suggest'),
            clearWorkspace: document.getElementById('btn-clear-workspace'),
            saveSnapshot: document.getElementById('btn-save-snapshot'),
            importWorkspace: document.getElementById('btn-import-workspace'),
            exportWorkspace: document.getElementById('btn-export-workspace')
        };

        // Import/Export elements
        this.elements.importExport = {
            fileInput: document.getElementById('import-file-input')
        };
                
        // Save elements
        this.elements.save = {
            versionLabel: document.getElementById('version-label'),
            overwriteToggle: document.getElementById('overwrite-toggle'),
            saveBtn: document.getElementById('btn-save-snapshot')
        };
        
        // Modal elements
        this.elements.modals = {
            editNode: document.getElementById('editModal'),
            createDomain: document.getElementById('createDomainModal'),
            editDomain: document.getElementById('editDomainModal'),
            source: document.getElementById('sourceModal'),
            llm: document.getElementById('llm-modal'),
            dialog: document.getElementById('dialogModal'),
            metadata: document.getElementById('metadata-modal')
        };
        
        // Status elements
        this.elements.status = {
            currentVersionLabel: document.getElementById('current-version-label'),
            activeVersionInfo: document.getElementById('active-version-info'),
            clearWorkspaceBtn: document.getElementById('btn-clear-workspace'),
            statusDot: document.getElementById('status-dot')
        };
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Modal close buttons - keep these as they're generic
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    const modalName = modal.id.replace('Modal', '').toLowerCase();
                    this.closeModal(modalName);
                }
            });
        });

        // Form submissions
        this.bindFormListeners();

        // Import file input change listener
        if (this.elements.importExport && this.elements.importExport.fileInput) {
            this.elements.importExport.fileInput.addEventListener('change', (e) => {
                if (window.workspaceOpsController && window.workspaceOpsController.handleFileImport) {
                    window.workspaceOpsController.handleFileImport(e);
                }
            });
        }
    }

    /**
     * Bind form-specific listeners
     */
    bindFormListeners() {
        // New node form field sync to state
        if (this.elements.forms && this.elements.forms.newNode) {
            const newNodeForm = this.elements.forms.newNode;
            
            // Sync all form fields to state on change (when user finishes with field)
            if (newNodeForm.localId) {
                newNodeForm.localId.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newNode', { localId: parseInt(e.target.value) || null });
                });
            }
            if (newNodeForm.title) {
                newNodeForm.title.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newNode', { title: e.target.value });
                });
            }
            if (newNodeForm.description) {
                newNodeForm.description.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newNode', { description: e.target.value });
                });
            }
            if (newNodeForm.domainId) {
                newNodeForm.domainId.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newNode', { domainId: parseInt(e.target.value) || null });
                });
            }
            if (newNodeForm.assessable) {
                newNodeForm.assessable.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newNode', { assessable: e.target.checked });
                });
            }
            if (newNodeForm.prerequisite) {
                newNodeForm.prerequisite.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newNode', { prerequisite: e.target.value });
                });
            }
        }

        // New domain form field sync to state
        if (this.elements.forms && this.elements.forms.newDomain) {
            const newDomainForm = this.elements.forms.newDomain;
            
            if (newDomainForm.localId) {
                newDomainForm.localId.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newDomain', { localId: parseInt(e.target.value) || null });
                });
            }
            if (newDomainForm.title) {
                newDomainForm.title.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newDomain', { title: e.target.value });
                });
            }
            if (newDomainForm.description) {
                newDomainForm.description.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newDomain', { description: e.target.value });
                });
            }
            if (newDomainForm.parentId) {
                newDomainForm.parentId.addEventListener('change', (e) => {
                    this.stateManager.updateForm('newDomain', { parentId: parseInt(e.target.value) || null });
                });
            }
        }

        // Node form auto-simplify prerequisites (if element exists)
        if (this.elements.forms && this.elements.forms.newNode && this.elements.forms.newNode.prerequisite) {
            // Add input event for real-time validation only (no simplification)
            this.elements.forms.newNode.prerequisite.addEventListener('input', (e) => {
                this.validatePrerequisites(e.target);
            });
            
            // Add blur event for auto-correction when unfocused
            this.elements.forms.newNode.prerequisite.addEventListener('blur', (e) => {
                this.autoSimplifyPrerequisites(e.target, true);
            });
        }
        
        // Edit node form auto-simplify prerequisites (if element exists)
        if (this.elements.forms && this.elements.forms.editNode && this.elements.forms.editNode.prerequisite) {
            // Add input event for real-time validation only (no simplification)
            this.elements.forms.editNode.prerequisite.addEventListener('input', (e) => {
                this.validatePrerequisites(e.target);
            });
            
            // Add blur event for auto-correction when unfocused
            this.elements.forms.editNode.prerequisite.addEventListener('blur', (e) => {
                this.autoSimplifyPrerequisites(e.target, true);
            });
        }
        
        // Version label input (if element exists)
        if (this.elements && this.elements.save && this.elements.save.versionLabel) {
            this.elements.save.versionLabel.addEventListener('blur', () => {
                //this.renderAssessableChanges();
                //this.validateAllRedirects();
            });
        }

        // Overwrite toggle listener (if element exists)
        if (this.elements && this.elements.save && this.elements.save.overwriteToggle) {
            this.elements.save.overwriteToggle.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const versionLabelInput = this.elements.save.versionLabel;
                const { currentVersionLabel, currentSnapshotUuid } = this.stateManager.state;

                // Prevent overwrite if there's no version label or UUID
                if (isChecked && (!currentVersionLabel || !currentSnapshotUuid)) {
                    e.target.checked = false;
                    this.stateManager.showMessage('Cannot overwrite: missing version label or UUID', 'error');
                    return;
                }

                if (isChecked && versionLabelInput) {
                    // Lock version label to base current version label
                    if (currentVersionLabel) {
                        versionLabelInput.value = currentVersionLabel;
                        versionLabelInput.disabled = true;
                    }
                } else if (versionLabelInput) {
                    // Unlock version label
                    versionLabelInput.disabled = false;
                }
            });
        }
    }

    /**
     * Initialize UI
     */
    initializeUI() {
        // Update workspace display
        this.updateWorkspaceDisplay();
        
        // Update status display
        this.updateStatusDisplay();
    }

    /**
     * Handle state changes
     * @param {Object} state - Current state
     */
    handleStateChange(state) {        
        this.updateWorkspaceDisplay();
        this.updateStatusDisplay();
        this.updateModalDisplay();
        this.updateLoadingState(state.isLoading);
        this.updateErrorDisplay(state.error);
    }
    
    /**
     * Update workspace display
     */
    updateWorkspaceDisplay() {
        const { nodes, domains, selectedNodes, selectedDomains } = this.stateManager.state;
        console.log('Nodes:', nodes.length, 'Domains:', domains.length);

        // Update add domain button text and visibility based on selection
        const hasSelections = selectedNodes.size > 0 || selectedDomains.size > 0;
        let canGroupUnderDomain = false;
        
        if (this.elements.buttons.addDomain) {
            // Delegate to operations controller for common parent check            
            canGroupUnderDomain = this.stateManager.getCommonParentFromSelection() !== false;
            
            this.elements.buttons.addDomain.style.display = hasSelections && !canGroupUnderDomain ? 'none' : 'block';
            this.elements.buttons.addDomain.textContent = canGroupUnderDomain ? 'Group Under Domain' : 'Add Domain'
        }
        
        // Update nodes list with tree structure built dynamically
        if (this.elements.workspace.draftNodesList) {
            const rootItems = this.getRootItems();

            if (rootItems.length === 0) {
                this.elements.workspace.draftNodesList.innerHTML = '<p class="empty-state">No items in workspace. Add your first node or domain to get started!</p>';
            } else {
                const html = this.renderTreeItems(rootItems, 0);
                this.elements.workspace.draftNodesList.innerHTML = html;
            }
        }
        
        // Update draft count
        if (this.elements.workspace.draftCount) {
            const ender = nodes.length === 1 ? ' node' : ' nodes';
            this.elements.workspace.draftCount.textContent = nodes.length + ender;
        }

        console.log(this.stateManager.getSelectedItems());
        
    }


    /**
     * Get root items (domains with no parent and nodes without domains)
     * @returns {Array} Root items
     */
    getRootItems() {
        const { nodes, domains } = this.stateManager.state;
        const rootItems = [];
        
        // Add domains with no parent
        domains.forEach(domain => {
            if (!domain.parentId) {
                rootItems.push({ ...domain, type: 'domain' });
            }
        });
        
        // Add nodes without domains
        nodes.forEach(node => {
            if (!node.domainId) {
                rootItems.push({ ...node, type: 'node' });
            }
        });
        
        return rootItems;
    }

    /**
     * Render tree items recursively
     * @param {Array} items - Items to render
     * @param {number} depth - Current depth for indentation
     * @returns {string} HTML string
     */
    renderTreeItems(items, depth) {
        const { selectedNodes, selectedDomains } = this.stateManager.state;
        const hasSelections = selectedNodes.size > 0 || selectedDomains.size > 0;
        
        return items.map(item => {
            const isSelected = item.type === 'domain' ? 
                selectedDomains.has(item.id) : 
                selectedNodes.has(item.id);
            
            const indent = depth * 20;
            
            if (item.type === 'domain') {
                return this.renderDomainItem(item, depth, isSelected, hasSelections);
            } else {
                return this.renderNodeItem(item, depth, isSelected);
            }
        }).join('');
    }

    /**
     * Get children of a domain dynamically using references
     * @param {number} domainId - Domain ID
     * @returns {Array} Array of child items (domains and nodes)
     */
    getDomainChildren(domainId) {
        const { nodes, domains } = this.stateManager.state;
        const children = [];
        
        // Add child domains
        domains.forEach(domain => {
            if (domain.parentId === domainId) {
                children.push({ ...domain, type: 'domain' });
            }
        });
        
        // Add child nodes
        nodes.forEach(node => {
            if (node.domainId === domainId) {
                children.push({ ...node, type: 'node' });
            }
        });
        
        return children;
    }

    /**
     * Render domain item
     * @param {Object} domain - Domain object
     * @param {number} depth - Depth for indentation
     * @param {boolean} isSelected - Whether domain is selected
     * @param {boolean} hasSelections - Whether any items are selected
     * @returns {string} HTML string
     */
    renderDomainItem(domain, depth, isSelected, hasSelections) {
        const levelIndent = 10;
        const currentPadding = (depth * levelIndent) + 5;
        const isCollapsed = domain.isCollapsed;
        const validityCheck = this.stateManager.getSelectedItems().every(item => {
            return this.stateManager.checkMoveValidity(item.id, domain.id);
        });
        
        // Determine status classes and indicators
        const isDirty = domain._isDirty;
        const isDeleted = domain._isDeleted;
        let statusClass = '';
        let statusIndicator = '';
        
        if (isDeleted) {
            statusClass = 'domain-deleted';
            statusIndicator = '<span class="status-badge deleted" title="Marked for deletion">🗑️</span>';
        } else if (isDirty) {
            statusClass = 'domain-dirty';
            statusIndicator = '<span class="status-badge dirty" title="Modified (unsaved)">●</span>';
        }
               
        const moveButton = hasSelections && validityCheck ? 
            `<button class="btn btn-primary btn-small" onclick="labUIController.moveSelectedToDomain(${domain.id})">Move</button>` : '';
        
        // Get children dynamically using references
        const children = this.getDomainChildren(domain.id);
        
        // Only render children if domain is not collapsed
        const childrenHtml = (!isCollapsed && children.length > 0) ? 
            this.renderTreeItems(children, depth + 1) : '';
                
        return `
            <div class="tree-item domain-item ${isCollapsed ? 'collapsed' : ''} ${isSelected ? 'selected' : ''} ${statusClass}" data-domain-id="${domain.id}">
                <div class="tree-item-header" style="padding-left: ${currentPadding}px;">
                    <input type="checkbox" class="selection-checkbox" ${isSelected ? 'checked' : ''}
                           onchange="labUIController.toggleDomainSelection(${domain.id})" ${isDeleted ? 'disabled' : ''}>
                    <span class="folder-icon" onclick="labUIController.toggleDomainCollapse(${domain.id})">${isCollapsed ? '▶' : '▼'}</span>
                    <div class="tree-item-content">
                        <span class="domain-badge">${domain.id}</span>
                        ${statusIndicator}
                        <span class="tree-item-title ${isDeleted ? 'deleted-title' : ''}">${this.escapeHtml(domain.title)}</span>
                        ${domain.description ? `<span class="tree-item-description">${this.escapeHtml(domain.description)}</span>` : ''}
                    </div>
                        ${domain.parentId && !isDeleted ? 
                            `<button class="btn btn-secondary btn-small" onclick="workspaceOpsController.ejectDomain(${domain.id})" title="Eject Domain">Eject</button>` : ''}
                        ${!isDeleted && hasSelections ? 
                            `<button class="btn btn-primary btn-small" onclick="labUIController.moveSelectedToDomain(${domain.id})" title="Move Selected">Move</button>` : ''}
                        ${!isDeleted ? `<button class="btn btn-secondary btn-small" onclick="workspaceOpsController.editDomain(${domain.id})">Edit</button>` : ''}
                        ${!isDeleted ? `<button class="btn btn-danger btn-small" onclick="workspaceOpsController.deleteDomain(${domain.id})">Delete</button>` : ''}
                        ${isDeleted ? `<button class="btn btn-secondary btn-small" onclick="workspaceOpsController.restoreDomain(${domain.id})">Restore</button>` : ''}
                    </div>
                </div>
                <div class="tree-item-children" style="display: ${isCollapsed ? 'none' : 'block'};">
                    ${childrenHtml}
                </div>
            </div>
        `;
    }

    /**
     * Render node item
     * @param {Object} node - Node object
     * @param {number} depth - Depth for indentation
     * @param {boolean} isSelected - Whether node is selected
     * @returns {string} HTML string
     */
    renderNodeItem(node, depth, isSelected) {
        const levelIndent = 15;
        const currentPadding = (depth * levelIndent) + 5;
        
        // Determine status classes and indicators
        const isDirty = node._isDirty;
        const isDeleted = node._isDeleted;
        let statusClass = '';
        let statusIndicator = '';
        
        if (isDeleted) {
            statusClass = 'node-deleted';
            statusIndicator = '<span class="status-badge deleted" title="Marked for deletion">🗑️</span>';
        } else if (isDirty) {
            statusClass = 'node-dirty';
            statusIndicator = '<span class="status-badge dirty" title="Modified (unsaved)">●</span>';
        }
        
        return `
            <div class="tree-item node-item ${isSelected ? 'selected' : ''} ${statusClass}" data-node-id="${node.id}">
                <div class="tree-item-header" style="padding-left: ${currentPadding}px;">
                    <input type="checkbox" class="selection-checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="labUIController.toggleNodeSelection(${node.id})" ${isDeleted ? 'disabled' : ''}>
                    <div class="tree-item-content">
                        <span class="tree-item-id">${node.id}</span>
                        ${statusIndicator}
                        <span class="tree-item-title ${isDeleted ? 'deleted-title' : ''}">${this.escapeHtml(node.title)}</span>
                        ${node.assessable ? '<span class="assessable-badge">A</span>' : ''}
                    </div>
                    <div class="tree-item-actions" onclick="event.stopPropagation()">
                        ${node.domainId && !isDeleted ? 
                            `<button class="btn btn-secondary btn-small" onclick="workspaceOpsController.ejectNode(${node.id})" title="Eject Node">Eject</button>` : ''}
                        ${!isDeleted ? `<button class="btn btn-secondary btn-small" onclick="workspaceOpsController.editNode(${node.id})">Edit</button>` : ''}
                        ${!isDeleted ? `<button class="btn btn-danger btn-small" onclick="workspaceOpsController.deleteNode(${node.id})">Delete</button>` : ''}
                        ${isDeleted ? `<button class="btn btn-secondary btn-small" onclick="workspaceOpsController.restoreNode(${node.id})">Restore</button>` : ''}
                    </div>
                </div>
                <div class="tree-item-details">
                    ${node.description ? `<p>${this.escapeHtml(node.description)}</p>` : ''}
                    ${node.prerequisites ? `<p><strong>Prereqs:</strong> <code>${this.escapeHtml(node.prerequisites)}</code></p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Toggle node selection
     * @param {number} nodeId - Node ID
     */
    toggleNodeSelection(nodeId) {
        this.stateManager.toggleNodeSelection(nodeId);
    }

    /**
     * Toggle domain selection
     * @param {number} domainId - Domain ID
     */
    toggleDomainSelection(domainId) {
        event.stopPropagation();
        this.stateManager.toggleDomainSelection(domainId);
    }

     /**
     * Toggle domain collapse/expand
     * @param {number} domainId - Domain ID
     */
    toggleDomainCollapse(domainId) {
        event.stopPropagation();
        
        const domain = this.stateManager.state.domains.find(d => d.id === domainId);
        if (domain) {           
            domain.isCollapsed = !domain.isCollapsed;
            this.stateManager.notifyStateChange();
        }
    }

    /**
     * @param {number} targetDomainId - Target domain ID
     */
    moveSelectedToDomain(targetDomainId) {
        try {
            this.stateManager.moveSelectedToDomain(targetDomainId);
            this.stateManager.showMessage('Items moved successfully', 'success');
        } catch (error) {
            this.stateManager.showMessage(error.message, 'error');
        }
    }

    updateStatusDisplay() {
        const { currentVersionLabel, currentSnapshotUuid } = this.stateManager.state;
        
        // Update current version label
        if (this.elements.status.currentVersionLabel) {
            this.elements.status.currentVersionLabel.textContent = currentVersionLabel || 'None';
        }

        // Update active version info
        if (this.elements.status.activeVersionInfo) {
            const info = currentVersionLabel || 'None';
            this.elements.status.activeVersionInfo.innerHTML = `Working on: <span>${this.escapeHtml(info)}</span>`;
        }

        // Update overwrite toggle
        if (this.elements.save.overwriteToggle) {
            const hasGraphMetadata = currentVersionLabel && currentSnapshotUuid;
            
            // Disable overwrite checkbox if there's no version label or UUID
            this.elements.save.overwriteToggle.disabled = !hasGraphMetadata;
            
            // Only check the toggle if metadata exists
            if (hasGraphMetadata) {
                this.elements.save.overwriteToggle.checked = true;
                
                // Lock version label to base graph label when overwrite is checked
                if (this.elements.save.versionLabel) {
                    this.elements.save.versionLabel.value = currentVersionLabel;
                    this.elements.save.versionLabel.disabled = true;
                }
            } else {
                this.elements.save.overwriteToggle.checked = false;
                
                // Unlock version label when overwrite is unchecked
                if (this.elements.save.versionLabel) {
                    this.elements.save.versionLabel.disabled = false;
                }
            }
        }
    }

    /**
     * Update modal display
     */
    updateModalDisplay() {
        const { modals, forms, dialog } = this.stateManager.state;
        
        // Update modal visibility
        Object.keys(modals).forEach(modalName => {
            const modal = this.elements.modals[modalName];
            if (modal) {
                modal.style.display = modals[modalName] ? 'flex' : 'none';
            }
        });
        
        // Update dialog content if dialog is visible
        if (modals.dialog && dialog) {
            this.renderDialogContent(dialog);
        }
        
        // Update edit node modal when visible
        if (modals.editNode && forms.editNode) {
            this.renderEditNodeForm(forms.editNode);
        }
        
        // Update edit domain modal when visible
        if (modals.editDomain && forms.editDomain) {
            this.renderEditDomainForm(forms.editDomain);
        }
        
        // Update metadata modal content when visible
        if (modals.metadata) {
            this.renderMetadataContent();
        }
    }

    /**
     * Render sidebar forms (new node, new domain) - call this when forms are reset
     */
    renderSidebarForms() {
        const forms = this.stateManager.state.forms;
        
        if (forms.newNode) {
            this.renderNewNodeForm(forms.newNode);
        }
        
        if (forms.newDomain) {
            this.renderNewDomainForm(forms.newDomain);
        }
    }

    /**
     * Update loading state
     * @param {boolean} isLoading - Loading state
     */
    updateLoadingState(isLoading) {
        // Update status dot
        if (this.elements.status.statusDot) {
            this.elements.status.statusDot.textContent = isLoading ? '⏳' : '●';
            this.elements.status.statusDot.style.color = isLoading ? '#fbbc04' : '#34a853';
        }

        // Disable/enable buttons during loading
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = isLoading;
        });

        // Re-enable modal close buttons
        document.querySelectorAll('.modal .close').forEach(btn => {
            btn.disabled = false;
        });
    }

    /**
     * Update error display
     * @param {string|null} error - Error message
     */
    updateErrorDisplay(error) {
        if (error) {
            this.stateManager.customAlert(error);
        }
    }

    /**
     * Open modal
     * @param {string} modalName - Modal name
     */
    openModal(modalName) {
        this.stateManager.toggleModal(modalName, true);
    }

    /**
     * Close modal
     * @param {string} modalName - Modal name
     */
    closeModal(modalName) {
        this.stateManager.toggleModal(modalName, false);
        this.stateManager.resetForm(modalName);
        
        // Special handling for LLM modal - clear results and input
        if (modalName === 'llm') {
            const resultsContainer = document.getElementById('llm-results');
            const queryInput = document.getElementById('llm-query');
            if (resultsContainer) resultsContainer.innerHTML = '';
            if (queryInput) queryInput.value = '';
        }
    }

    /**
     * Open LLM modal
     */
    openLLMModal() {
        this.openModal('llm');

        // Load available models
        const modelSelect = document.getElementById('llm-model-select');
        if (modelSelect && window.llmOpsController) {
            window.llmOpsController.loadAvailableModels(
                (models, defaultModel) => {
                    modelSelect.innerHTML = '';
                    models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.name;
                        if (model.id === defaultModel) {
                            option.selected = true;
                        }
                        modelSelect.appendChild(option);
                    });
                },
                (error) => {
                    modelSelect.innerHTML = '<option value="" disabled>Error loading models</option>';
                    console.error('Failed to load models:', error);
                }
            );
        }

        // Add change listener for model selection
        if (modelSelect) {
            modelSelect.onchange = (e) => {
                if (window.llmOpsController) {
                    window.llmOpsController.setSelectedModel(e.target.value);
                }
            };
        }

        // Check for selections and show/hide reminder
        const reminderDiv = document.getElementById('llm-selection-reminder');
        const selectedCountSpan = document.getElementById('llm-selected-count');
        if (reminderDiv && selectedCountSpan) {
            const { selectedNodes } = this.stateManager.state;
            const selectedCount = selectedNodes ? selectedNodes.size : 0;
            if (selectedCount > 0) {
                reminderDiv.style.display = 'block';
                selectedCountSpan.textContent = selectedCount;
            } else {
                reminderDiv.style.display = 'none';
            }
        }
    }

    /**
     * Open metadata modal
     */
    openMetadataModal() {
        this.openModal('metadata');
    }

    /**
     * Close metadata modal
     */
    closeMetadataModal() {
        this.closeModal('metadata');
    }

    /**
     * Render dialog content
     * @param {Object} dialog - Dialog state object
     */
    renderDialogContent(dialog) {
        const dialogTitle = document.getElementById('dialog-title');
        const dialogBody = document.getElementById('dialog-body');
        const dialogInput = document.getElementById('dialog-input');
        const dialogInputContainer = document.getElementById('dialog-input-container');
        const cancelBtn = document.getElementById('dialog-cancel-btn');
        const confirmBtn = document.getElementById('dialog-confirm-btn');
        
        if (dialogTitle) dialogTitle.textContent = dialog.title || 'Confirm';
        if (dialogBody) dialogBody.textContent = dialog.message || '';
        if (dialogInput) dialogInput.value = dialog.defaultValue || '';
        if (dialogInputContainer) {
            dialogInputContainer.style.display = dialog.type === 'prompt' ? 'block' : 'none';
        }
        
        // Show/hide cancel button based on dialog type
        if (cancelBtn) {
            cancelBtn.style.display = dialog.type === 'alert' ? 'none' : 'inline-block';
        }
        
        // Update button text
        if (confirmBtn) {
            confirmBtn.textContent = dialog.confirmText || 'OK';
        }
        if (cancelBtn) {
            cancelBtn.textContent = dialog.cancelText || 'Cancel';
        }
    }

    /**
     * Render edit node form based on form state
     * @param {Object} form - Edit node form state
     */
    renderEditNodeForm(form) {
        const editFormElements = this.elements.forms.editNode;
        if (!editFormElements) return;
        
        if (editFormElements.localId) editFormElements.localId.value = form.localId || '';
        if (editFormElements.title) editFormElements.title.value = form.title || '';
        if (editFormElements.description) editFormElements.description.value = form.description || '';
        if (editFormElements.prerequisite) editFormElements.prerequisite.value = form.prerequisite || '';
        if (editFormElements.propagateChanges) editFormElements.propagateChanges.checked = form.propagateChanges !== false;
        if (editFormElements.assessable) editFormElements.assessable.checked = form.assessable || false;
        
        // Render sources
        this.renderEditNodeSources(form.sources || [], 'editNode');
    }

    /**
     * Render edit domain form based on form state
     * @param {Object} form - Edit domain form state
     */
    renderEditDomainForm(form) {
        const editFormElements = this.elements.forms.editDomain;
        if (!editFormElements) return;
        
        if (editFormElements.localId) editFormElements.localId.value = form.localId || '';
        if (editFormElements.title) editFormElements.title.value = form.title || '';
        if (editFormElements.description) editFormElements.description.value = form.description || '';
        
        // Update domain ID display in modal header
        const domainIdDisplay = document.getElementById('edit-domain-id-display');
        if (domainIdDisplay) {
            domainIdDisplay.textContent = `#${form.localId}`;
        }
    }

    /**
     * Render new node form based on form state
     * @param {Object} form - New node form state
     */
    renderNewNodeForm(form) {
        const addFormElements = this.elements.forms.newNode;
        if (!addFormElements) return;
        
        if (addFormElements.localId) addFormElements.localId.value = form.localId || '';
        if (addFormElements.title) addFormElements.title.value = form.title || '';
        if (addFormElements.description) addFormElements.description.value = form.description || '';
        if (addFormElements.prerequisite) addFormElements.prerequisite.value = form.prerequisite || '';
        if (addFormElements.domainId) addFormElements.domainId.value = form.domainId || '';
        if (addFormElements.assessable) addFormElements.assessable.checked = form.assessable || false;
        
        // Render sources
        this.renderEditNodeSources(form.sources || [], 'newNode');
    }

    /**
     * Render new domain form based on form state
     * @param {Object} form - New domain form state
     */
    renderNewDomainForm(form) {
        const addFormElements = this.elements.forms.newDomain;
        if (!addFormElements) return;
        
        if (addFormElements.localId) addFormElements.localId.value = form.localId || '';
        if (addFormElements.title) addFormElements.title.value = form.title || '';
        if (addFormElements.description) addFormElements.description.value = form.description || '';
        if (addFormElements.parentId) addFormElements.parentId.value = form.parentId || '';
    }

    /**
     * Render metadata content
     */
    renderMetadataContent() {
        const state = this.stateManager.state;
        const metadataContent = document.getElementById('metadata-content');

        if (metadataContent) {
            const metadata = {
                'Current Version Label': state.currentVersionLabel || 'None',
                'Current Snapshot UUID': state.currentSnapshotUuid || 'None',
                'Base Graph Label': state.baseGraphLabel || 'None',
                'Base Graph UUID': state.baseGraphUuid || 'None',
                'Node Count': state.nodes.length,
                'Domain Count': state.domains.length,
                'Redirect Count': state.redirects.length,
                'Created At': state.createdAt ? new Date(state.createdAt).toLocaleString() : 'None',
                'Last Updated': state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'None',
                'Is Public': state.isPublic ? 'Yes' : 'No',
                'Authors': state.authors.map(author => author.username).join(', ')
            };
            
            let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
            for (const [key, value] of Object.entries(metadata)) {
                html += `
                    <div style="padding: 10px; background: #f5f5f5; border-radius: 4px;">
                        <div style="font-weight: 600; color: #5f6368; font-size: 0.9em; margin-bottom: 5px;">${key}</div>
                        <div style="word-break: break-all; font-family: monospace; font-size: 0.85em;">${value}</div>
                    </div>
                `;
            }
            html += '</div>';
            
            metadataContent.innerHTML = html;
        }
    }


    /**
     * Validate prerequisites without simplifying (for real-time feedback during typing)
     * @param {HTMLElement} input - Prerequisites input element
     */
    validatePrerequisites(input) {
        const value = input.value.trim();
        if (!value) {
            input.style.borderColor = '';
            this.hideSimplificationHelper(input);
            return;
        }
        
        // Check if utils are available
        if (!window.ExpressionUtils) {
            console.warn('ExpressionUtils not available');
            return;
        }
        
        try {
            // Get current context nodes
            const contextNodes = this.stateManager.state.nodes;
            
            // Validate with node existence check
            const validation = window.ExpressionUtils.validatePrerequisitesWithNodeCheck(value, contextNodes);
            
            // Update validation styling based on validation result
            if (validation.isValid) {
                input.style.borderColor = '';
            } else {
                input.style.borderColor = '#d93025';
                // Could optionally show tooltip with error message here
                console.log('Validation error:', validation.error);
            }
            
            // Hide helper text during typing (user can see it again on blur)
            this.hideSimplificationHelper(input);
        } catch (error) {
            console.error('Error validating prerequisites:', error);
            input.style.borderColor = '#d93025';
            this.hideSimplificationHelper(input);
        }
    }

    /**
     * Auto-simplify prerequisites (only on blur events)
     * @param {HTMLElement} input - Prerequisites input element
     * @param {boolean} forceUpdate - Force update even if not valid (for blur events)
     */
    autoSimplifyPrerequisites(input, forceUpdate = false) {
        const value = input.value.trim();
        if (!value) {
            this.hideSimplificationHelper(input);
            input.style.borderColor = '';
            return;
        }
        
        // Check if utils are available
        if (!window.ExpressionUtils) {
            console.warn('ExpressionUtils not available');
            return;
        }
        
        try {
            // Get current node context for simplification
            const currentNodeId = this.elements.forms.newNode.localId.value ? parseInt(this.elements.forms.newNode.localId.value) : null;
            const contextNodes = this.stateManager.state.nodes;
            
            // First validate with node existence check
            const validation = window.ExpressionUtils.validatePrerequisitesWithNodeCheck(value, contextNodes);
            
            // Only simplify if there are no non-existent nodes and the expression is syntactically valid
            if (validation.isValid && !validation.hasNonExistentNodes) {
                // Simplify the expression using the new function
                const simplified = window.ExpressionUtils.simplifyPrerequisitesInBrowser(
                    value, 
                    currentNodeId, 
                    contextNodes
                );
                
                // Update if expression was simplified
                if (simplified !== value) {
                    input.value = simplified;
                    this.hideSimplificationHelper(input);
                } else {
                    // Show helper that no simplification was possible
                    this.showSimplificationHelper(input, 'Expression already optimized');
                }
                
                // Clear validation styling for valid expressions
                input.style.borderColor = '';
            } else {
                // Show red border for invalid expressions or those with non-existent nodes
                input.style.borderColor = '#d93025';
                
                // Show helper explaining why simplification wasn't possible
                if (validation.hasNonExistentNodes) {
                    this.showSimplificationHelper(input, `Cannot simplify: missing nodes ${validation.missingNodes.join(', ')}`);
                } else {
                    this.showSimplificationHelper(input, 'Cannot simplify: invalid expression syntax');
                }
                
                if (forceUpdate && validation.error) {
                    this.stateManager.customAlert(validation.error);
                }
            }
        } catch (error) {
            console.error('Error simplifying prerequisites:', error);
            input.style.borderColor = '#d93025';
            this.showSimplificationHelper(input, 'Error processing expression');
        }
    }

    /**
     * Show helper text for simplification issues
     * @param {HTMLElement} input - Input element
     * @param {string} message - Helper message
     */
    showSimplificationHelper(input, message) {
        // Find or create helper element
        let helper = input.parentNode.querySelector('.simplification-helper');
        if (!helper) {
            helper = document.createElement('div');
            helper.className = 'simplification-helper';
            helper.style.fontSize = '12px';
            helper.style.color = '#666';
            helper.style.marginTop = '4px';
            helper.style.fontStyle = 'italic';
            input.parentNode.appendChild(helper);
        }
        helper.textContent = message;
        helper.style.display = 'block';
    }

    /**
     * Hide helper text
     * @param {HTMLElement} input - Input element
     */
    hideSimplificationHelper(input) {
        const helper = input.parentNode.querySelector('.simplification-helper');
        if (helper) {
            helper.style.display = 'none';
        }
    }

    /**
     * Validate prerequisite expression
     * @param {string} expression - Prerequisite expression
     */
    isValidPrerequisiteExpression(expression) {
        // Simple validation - check if it contains valid node IDs
        const matches = expression.match(/\b\d+\b/g);
        return matches && matches.length > 0;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Open source modal
     * @param {string} context - Context ('edit' or 'new')
     */
    openSourceModal(context) {
        this.sourceModalContext = context;
        
        // Clear editing state when adding new source
        this.editingSourceIndex = undefined;
        this.editingSourceForm = undefined;
        
        // Reset modal title
        document.getElementById('source-modal-title').textContent = 'Add Source';
        
        // Hide delete button
        document.getElementById('btn-delete-source').style.display = 'none';
        
        // Clear form inputs
        document.getElementById('source-title').value = '';
        document.getElementById('source-type').value = 'Other';
        document.getElementById('source-author').value = '';
        document.getElementById('source-year').value = '';
        document.getElementById('source-url').value = '';
        document.getElementById('source-start').value = '';
        document.getElementById('source-end').value = '';
        document.getElementById('source-bib-hash').value = '';
        document.getElementById('source-uuid').value = '';
        
        this.openModal('source');
    }

    /**
     * Close source modal
     */
    closeSourceModal() {
        this.closeModal('source');
    }

    /**
     * Submit source - add or update source in the correct form
     */
    submitSource() {
        const title = document.getElementById('source-title')?.value.trim();
        const type = document.getElementById('source-type')?.value;
        const author = document.getElementById('source-author')?.value.trim();
        const year = document.getElementById('source-year')?.value;
        const url = document.getElementById('source-url')?.value.trim();
        const fragmentStart = document.getElementById('source-start')?.value.trim();
        const fragmentEnd = document.getElementById('source-end')?.value.trim();
        
        if (!title) {
            this.stateManager.customAlert('Source title is required');
            return;
        }
        
        const sourceData = {
            title,
            type: type || 'Other',
            author: author || '',
            year: year ? parseInt(year) : null,
            url: url || '',
            fragmentStart: fragmentStart || '',
            fragmentEnd: fragmentEnd || '',
            hash: document.getElementById('source-bib-hash')?.value || null,
            sourceUuid: document.getElementById('source-uuid')?.value || null,
            _isDirty: true
        };
        
        // Check if we're editing an existing source
        if (this.editingSourceIndex !== undefined && this.editingSourceForm) {
            // Update existing source
            const form = this.stateManager.state.forms[this.editingSourceForm];
            if (form.sources && form.sources[this.editingSourceIndex]) {
                Object.assign(form.sources[this.editingSourceIndex], sourceData);
            }
            // Clear editing state
            this.editingSourceIndex = undefined;
            this.editingSourceForm = undefined;
        } else {
            // Add to the correct form based on context
            const formName = this.sourceModalContext === 'edit' ? 'editNode' : 'newNode';
            const form = this.stateManager.state.forms[formName];
            
            if (!form.sources) {
                form.sources = [];
            }
            
            form.sources.push(sourceData);
        }
        
        // Clear source form inputs
        document.getElementById('source-title').value = '';
        document.getElementById('source-author').value = '';
        document.getElementById('source-year').value = '';
        document.getElementById('source-url').value = '';
        document.getElementById('source-start').value = '';
        document.getElementById('source-end').value = '';
        document.getElementById('source-bib-hash').value = '';
        document.getElementById('source-uuid').value = '';
        
        // Close modal and trigger re-render
        this.closeModal('source');
        this.stateManager.notifyStateChange();
    }

    /**
     * Delete current source from modal
     */
    deleteCurrentSource() {
        if (this.editingSourceIndex !== undefined && this.editingSourceForm) {
            const form = this.stateManager.state.forms[this.editingSourceForm];
            if (form.sources && form.sources[this.editingSourceIndex]) {
                // Mark as deleted
                form.sources[this.editingSourceIndex]._isDeleted = true;
            }
            // Clear editing state
            this.editingSourceIndex = undefined;
            this.editingSourceForm = undefined;
            
            // Clear form and close modal
            document.getElementById('source-title').value = '';
            document.getElementById('source-author').value = '';
            document.getElementById('source-year').value = '';
            document.getElementById('source-url').value = '';
            document.getElementById('source-start').value = '';
            document.getElementById('source-end').value = '';
            document.getElementById('source-bib-hash').value = '';
            document.getElementById('source-uuid').value = '';
            
            this.closeModal('source');
            this.stateManager.notifyStateChange();
        }
    }

    /**
     * Close view source modal
     */
    closeViewSourceModal() {
        const modal = document.getElementById('viewSourceModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Close dialog - delegates to state manager
     * @param {boolean} confirmed - Whether dialog was confirmed
     */
    closeDialog(confirmed) {
        this.stateManager.closeDialog(confirmed);
    }

    /**
     * Query LLM - delegates to ops controller
     */
    async queryLLM() {
        const queryInput = document.getElementById('llm-query');
        const modelSelect = document.getElementById('llm-model-select');
        const resultsContainer = document.getElementById('llm-results');
        const loadingIndicator = document.getElementById('llm-loading');

        if (!queryInput || !resultsContainer || !loadingIndicator) return;

        const prompt = queryInput.value.trim();

        // Update selected model from dropdown
        if (modelSelect && window.llmOpsController) {
            window.llmOpsController.setSelectedModel(modelSelect.value);
        }

        // Show loading
        loadingIndicator.style.display = 'block';
        resultsContainer.innerHTML = '';

        // Delegate to ops controller
        await window.llmOpsController.queryLLM(
            prompt,
            (suggestions) => {
                this.displayLLMResults(suggestions);
                loadingIndicator.style.display = 'none';
            },
            (errorMessage) => {
                resultsContainer.innerHTML = `<div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">Failed to get suggestions: ${errorMessage}</div>`;
                loadingIndicator.style.display = 'none';
            }
        );
    }

    /**
     * Display LLM suggestion results
     * @param {Array} suggestions - Array of suggestion objects
     */
    displayLLMResults(suggestions) {
        const container = document.getElementById('llm-results');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '<p>No suggestions found.</p>';
            return;
        }

        // Add Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'llm-toolbar';
        
        toolbar.innerHTML = `
            <div class="llm-toolbar-label-group">
                <input type="checkbox" id="llm-select-all" onchange="labUIController.toggleSelectAllLLM(this)">
                <label for="llm-select-all" class="llm-toolbar-label">Select All</label>
            </div>
            <button class="btn btn-primary btn-small" onclick="window.llmOpsController.importLLMSelected()">Import Selected</button>
        `;
        container.appendChild(toolbar);

        suggestions.forEach((suggestion, index) => {
            const card = document.createElement('div');
            card.className = 'llm-suggestion-card';
            
            card.innerHTML = `
                <div class="llm-suggestion-content">
                    <div>
                        <input type="checkbox" class="llm-suggestion-checkbox">
                    </div>
                    <div style="flex: 1;">
                        <h4 class="llm-suggestion-title">${this.escapeHtml(suggestion.title)}</h4>
                        <p class="llm-suggestion-description">${this.escapeHtml(suggestion.description)}</p>
                        <button class="btn btn-secondary btn-small" onclick="window.llmOpsController.importSingleLLMNode('${this.escapeHtml(suggestion.title).replace(/'/g, "\\'")}', '${this.escapeHtml(suggestion.description).replace(/'/g, "\\'")}')">Use This Single</button>
                        <div style="display:none;" class="suggestion-data">
                            <span class="s-title">${this.escapeHtml(suggestion.title)}</span>
                            <span class="s-desc">${this.escapeHtml(suggestion.description)}</span>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    /**
     * Toggle select all LLM suggestions
     * @param {HTMLInputElement} checkbox - The select all checkbox
     */
    toggleSelectAllLLM(checkbox) {
        const checkboxes = document.querySelectorAll('.llm-suggestion-checkbox');
        checkboxes.forEach(cb => cb.checked = checkbox.checked);
    }

    /**
     * Close LLM modal
     */
    closeLLMModal() {
        this.closeModal('llm');
    }


    /**
     * Close global import modal
     */
    closeGlobalImportModal() {
        const modal = document.getElementById('globalImportModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Render sources in edit node modal
     * @param {Array} sources - Array of source objects
     * @param {string} formName - Form name ('editNode' or 'newNode')
     */
    renderEditNodeSources(sources, formName = 'editNode') {
        const containerId = formName === 'editNode' ? 'edit-node-sources' : 'new-node-sources';
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (sources.length === 0) {
            container.innerHTML = '<span style="color: #9aa0a6; font-size: 0.9em;">No sources linked.</span>';
            return;
        }
        
        sources.forEach((source, index) => {
            if (source._isDeleted) return; // Skip deleted sources
            
            const sourceDiv = document.createElement('div');
            sourceDiv.className = 'source-item-row';
            sourceDiv.style.marginBottom = '8px';
            sourceDiv.style.display = 'flex';
            sourceDiv.style.alignItems = 'center';
            sourceDiv.style.gap = '8px';
            sourceDiv.innerHTML = `
                <div style="flex: 1; font-size: 0.9em;">
                    <strong>${source.title || 'Untitled'}</strong>
                    ${source.author ? `<span style="color: #666;"> - ${source.author}</span>` : ''}
                </div>
                ${source.url ? `<a href="${source.url}" target="_blank" class="source-link-btn">🔗</a>` : ''}
                <button class="btn btn-secondary btn-small" onclick="labUIController.editSource(${index}, '${formName}')">Edit</button>
                <button class="btn btn-danger btn-small" onclick="labUIController.removeSource(${index}, '${formName}')">Remove</button>
            `;
            container.appendChild(sourceDiv);
        });
    }

    /**
     * Edit a source in the node form - populate source modal and open it
     * @param {number} sourceIndex - Index of source to edit
     * @param {string} formName - Form name ('editNode' or 'newNode')
     */
    editSource(sourceIndex, formName = 'editNode') {
        const form = this.stateManager.state.forms[formName];
        if (!form.sources || !form.sources[sourceIndex]) return;
        
        const source = form.sources[sourceIndex];
        
        // Populate source modal with existing data
        document.getElementById('source-title').value = source.title || '';
        document.getElementById('source-type').value = source.type || 'Other';
        document.getElementById('source-author').value = source.author || '';
        document.getElementById('source-year').value = source.year || '';
        document.getElementById('source-url').value = source.url || '';
        document.getElementById('source-start').value = source.fragmentStart || '';
        document.getElementById('source-end').value = source.fragmentEnd || '';
        document.getElementById('source-bib-hash').value = source.hash;
        document.getElementById('source-uuid').value = source.sourceUuid || '';
        
        // Store the index being edited
        this.editingSourceIndex = sourceIndex;
        this.editingSourceForm = formName;
        
        // Update modal title
        document.getElementById('source-modal-title').textContent = 'Edit Source';
        
        // Show delete button
        document.getElementById('btn-delete-source').style.display = 'inline-block';
        
        // Open modal
        this.openModal('source');
    }

    /**
     * Remove a source from the node form
     * @param {number} sourceIndex - Index of source to remove
     * @param {string} formName - Form name ('editNode' or 'newNode')
     */
    removeSource(sourceIndex, formName = 'editNode') {
        const form = this.stateManager.state.forms[formName];
        if (form.sources && form.sources[sourceIndex]) {
            // Mark as deleted instead of removing immediately
            form.sources[sourceIndex]._isDeleted = true;
            // Notify state change to trigger re-render
            this.stateManager.notifyStateChange();
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Remove event listeners and clean up resources
        this.stateManager.unsubscribe();
    }
}

// Export for use in other modules
window.LabUIController = LabUIController;
