/**
 * Lab UI Controller - Manages UI interactions and display
 * Focuses on what to display and user interactions only
 */
class LabUIController {
    constructor(stateManager) {
        this.stateManager = stateManager;
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
            node: {
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
                assessable: document.getElementById('edit-node-assessable'),
                sources: document.getElementById('edit-node-sources')
            },
            editDomain: {
                localId: document.getElementById('edit-domain-id'),
                title: document.getElementById('edit-domain-title'),
                description: document.getElementById('edit-domain-desc')
            }
        };
        
        // Buttons
        this.elements.buttons = {
            addNode: document.querySelector('.btn-primary[onclick*="handleAddNode"]'),
            addDomain: document.getElementById('btn-group-domain'),
            llmSuggest: document.getElementById('btn-llm-suggest'),
            clearWorkspace: document.getElementById('btn-clear-workspace'),
            saveSnapshot: document.getElementById('btn-save-snapshot')
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
            dialog: document.getElementById('dialogModal')
        };
        
        // Status elements
        this.elements.status = {
            currentVersionLabel: document.getElementById('current-version-label'),
            activeVersionInfo: document.getElementById('active-version-info'),
            clearWorkspaceBtn: document.getElementById('btn-clear-workspace'),
            statusDot: document.getElementById('status-dot')
        };
        
        // Forms reference for easier access
        this.forms = this.elements.forms;
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
                    this.closeModal(modal.id.replace('Modal', '').toLowerCase());
                }
            });
        });

        // Form submissions
        this.bindFormListeners();
    }

    /**
     * Bind form-specific listeners
     */
    bindFormListeners() {
        // Node form auto-simplify prerequisites (if element exists)
        if (this.forms && this.forms.node && this.forms.node.prerequisite) {
            // Add input event for real-time validation only (no simplification)
            this.forms.node.prerequisite.addEventListener('input', (e) => {
                this.validatePrerequisites(e.target);
            });
            
            // Add blur event for auto-correction when unfocused
            this.forms.node.prerequisite.addEventListener('blur', (e) => {
                this.autoSimplifyPrerequisites(e.target, true);
            });
        }
        
        // Edit node form auto-simplify prerequisites (if element exists)
        if (this.forms && this.forms.editNode && this.forms.editNode.prerequisite) {
            // Add input event for real-time validation only (no simplification)
            this.forms.editNode.prerequisite.addEventListener('input', (e) => {
                this.validatePrerequisites(e.target);
            });
            
            // Add blur event for auto-correction when unfocused
            this.forms.editNode.prerequisite.addEventListener('blur', (e) => {
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
            const totalItems = nodes.length + domains.length;
            this.elements.workspace.draftCount.textContent = totalItems;
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
            `<button class="btn-primary btn-small" onclick="labUIController.moveSelectedToDomain(${domain.id})">Move</button>` : '';
        
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
                            `<button class="btn-warning btn-small" onclick="workspaceOpsController.ejectDomain(${domain.id})" title="Eject Domain">Eject</button>` : ''}
                        ${!isDeleted && hasSelections ? 
                            `<button class="btn-primary btn-small" onclick="labUIController.moveSelectedToDomain(${domain.id})" title="Move Selected">Move</button>` : ''}
                        ${!isDeleted ? `<button class="btn-secondary btn-small" onclick="workspaceOpsController.editDomain(${domain.id})">Edit</button>` : ''}
                        ${!isDeleted ? `<button class="btn-danger btn-small" onclick="workspaceOpsController.deleteDomain(${domain.id})">Delete</button>` : ''}
                        ${isDeleted ? `<button class="btn-secondary btn-small" onclick="workspaceOpsController.restoreDomain(${domain.id})">Restore</button>` : ''}
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
                            `<button class="btn-warning btn-small" onclick="workspaceOpsController.ejectNode(${node.id})" title="Eject Node">Eject</button>` : ''}
                        ${!isDeleted ? `<button class="btn-secondary btn-small" onclick="workspaceOpsController.editNode(${node.id})">Edit</button>` : ''}
                        ${!isDeleted ? `<button class="btn-danger btn-small" onclick="workspaceOpsController.deleteNode(${node.id})">Delete</button>` : ''}
                        ${isDeleted ? `<button class="btn-secondary btn-small" onclick="workspaceOpsController.restoreNode(${node.id})">Restore</button>` : ''}
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
            this.showMessage('Items moved successfully', 'success');
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    updateStatusDisplay() {
        const { currentVersionLabel, baseGraphLabel, currentSnapshot } = this.stateManager.state;
        
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
            this.elements.save.overwriteToggle.checked = !!baseGraphLabel;
        }
    }

    /**
     * Update modal display
     */
    updateModalDisplay() {
        const { modals, forms } = this.stateManager.state;
        
        // Update modal visibility
        Object.keys(modals).forEach(modalName => {
            const modal = this.elements.modals[modalName];
            if (modal) {
                modal.style.display = modals[modalName] ? 'block' : 'none';
            }
        });
        
        // Update dialog content if dialog is visible
        if (modals.dialog && forms.dialog) {
            const dialogTitle = document.getElementById('dialog-title');
            const dialogBody = document.getElementById('dialog-body');
            const dialogInput = document.getElementById('dialog-input');
            const dialogInputContainer = document.getElementById('dialog-input-container');
            
            if (dialogTitle) dialogTitle.textContent = forms.dialog.title || 'Confirm';
            if (dialogBody) dialogBody.textContent = forms.dialog.message || '';
            if (dialogInput) dialogInput.value = forms.dialog.input || '';
            if (dialogInputContainer) {
                dialogInputContainer.style.display = forms.dialog.input ? 'block' : 'none';
            }
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
            this.showDialog('Error', error, null, () => {});
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
        this.stateManager.resetForm(`${modalName}Form`);
    }

    /**
     * Show dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {string} input - Input placeholder (optional)
     * @param {Function} callback - Callback function
     */
    showDialog(title, message, input = null, callback) {
        this.stateManager.updateForm('dialog', {
            title,
            message,
            input: input || '',
            callback
        });
        this.openModal('dialog');
    }

    /**
     * Open LLM modal
     */
    openLLMModal() {
        this.openModal('llm');
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
            const currentNodeId = this.forms.node.localId.value ? parseInt(this.forms.node.localId.value) : null;
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
                    this.showMessage('Prerequisites auto-simplified', 'info');
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
                    this.showMessage(validation.error, 'error');
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
     * Show message to user
     * @param {string} message - Message to show
     * @param {string} type - Message type ('success', 'error', 'info')
     */
    showMessage(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        // Implementation could show a toast or notification
    }

    /**
     * Open source modal
     * @param {string} context - Context ('edit' or 'new')
     */
    openSourceModal(context) {
        this.sourceModalContext = context;
        this.openModal('source');
    }

    /**
     * Close source modal
     */
    closeSourceModal() {
        this.closeModal('source');
    }

    /**
     * Submit source
     */
    submitSource() {
        // Implementation would go here
        this.closeModal('source');
    }

    /**
     * Delete current source
     */
    deleteCurrentSource() {
        // Implementation would go here
    }

    /**
     * Close view source modal
     */
    closeViewSourceModal() {
        const modal = document.getElementById('viewSourceModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Close dialog
     * @param {boolean} confirmed - Whether dialog was confirmed
     */
    closeDialog(confirmed) {
        const form = this.stateManager.state.forms.dialog;
        if (form.callback) {
            form.callback(confirmed);
        }
        this.closeModal('dialog');
    }

    /**
     * Close LLM modal
     */
    closeLLMModal() {
        this.closeModal('llm');
    }

    /**
     * Query LLM
     */
    async queryLLM() {
        // Implementation would go here
        console.log('Query LLM not implemented yet');
    }


    /**
     * Close global import modal
     */
    closeGlobalImportModal() {
        const modal = document.getElementById('globalImportModal');
        if (modal) modal.style.display = 'none';
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
