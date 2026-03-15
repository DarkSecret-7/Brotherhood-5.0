// Workspace Operations: Node and Domain Management

// --- Node Operations ---

function addNode() {
    var domainLocalId = parseInt(document.getElementById('node-parent-domain').value);
    var localId = parseInt(document.getElementById('node-id').value);
    var title = document.getElementById('node-title').value;
    var desc = document.getElementById('node-desc').value;
    var pre = document.getElementById('node-pre').value;
    var assessable = document.getElementById('node-assessable').checked;
    // sources is deprecated, use source_items
    var sourceItems = JSON.parse(JSON.stringify(newNodeSources));

    if (isNaN(localId) || !title) {
        customAlert('Valid ID and Title required');
        return;
    }

    if (draftNodes.some(function(n) { return n.local_id === localId; })) {
        customAlert('Node ID already exists');
        return;
    }

    var resolvedDomainId = null;
    if (!isNaN(domainLocalId)) {
        var domain = draftDomains.find(function(d) { return d.local_id === domainLocalId; });
        if (domain) resolvedDomainId = domain.local_id;
        else customAlert('Warning: Domain #' + domainLocalId + ' not found. Placing at root.');
    }

    draftNodes.push({
        local_id: localId,
        title: title,
        description: desc,
        prerequisite: pre,
        source_items: sourceItems,
        domain_id: resolvedDomainId,
        assessable: assessable
    });

    persistDraft();
    document.getElementById('node-id').value = '';
    document.getElementById('node-title').value = '';
    document.getElementById('node-desc').value = '';
    document.getElementById('node-pre').value = '';
    document.getElementById('node-assessable').checked = false;
    newNodeSources = [];
    renderSources('new');
    refreshWorkspace();
}

function openEditModal(nodeOrId) {
    var node = nodeOrId;
    if (typeof nodeOrId === 'number' || typeof nodeOrId === 'string') {
        node = draftNodes.find(function(n) { return n.local_id == nodeOrId; });
    }
    
    if (!node) {
        console.error('Node not found for editing:', nodeOrId);
        return;
    }

    document.getElementById('edit-node-id-display').innerText = '#' + node.local_id;
    document.getElementById('edit-node-id').value = node.local_id;
    document.getElementById('edit-node-title').value = node.title;
    document.getElementById('edit-node-desc').value = node.description || '';
    document.getElementById('edit-node-pre').value = node.prerequisite || '';
    document.getElementById('edit-node-assessable').checked = node.assessable || false;
    
    // Ensure deep copy to avoid modifying draftNodes directly until save
    editNodeSources = node.source_items ? JSON.parse(JSON.stringify(node.source_items)) : [];
    
    renderSources('edit');
    document.getElementById('editModal').dataset.oldLocalId = node.local_id;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function updateNode() {
    var oldLocalId = parseInt(document.getElementById('editModal').dataset.oldLocalId);
    var newLocalId = parseInt(document.getElementById('edit-node-id').value);
    var title = document.getElementById('edit-node-title').value;
    var desc = document.getElementById('edit-node-desc').value;
    var pre = document.getElementById('edit-node-pre').value;
    var assessable = document.getElementById('edit-node-assessable').checked;
    var sourceItems = JSON.parse(JSON.stringify(editNodeSources));

    if (isNaN(newLocalId) || !title) {
        customAlert('Valid ID and Title required');
        return;
    }

    var node = draftNodes.find(function(n) { return n.local_id === oldLocalId; });
    if (!node) return;

    if (oldLocalId !== newLocalId && draftNodes.some(function(n) { return n.local_id === newLocalId; })) {
        customAlert('Node ID already exists');
        return;
    }

    node.local_id = newLocalId;
    node.title = title;
    node.description = desc;
    node.prerequisite = pre;
    node.source_items = sourceItems;
    node.assessable = assessable;

    persistDraft();
    closeEditModal();
    refreshWorkspace();
}

function confirmDeleteNode(event, localId) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    customConfirm('Delete this node from draft?').then(function(confirmed) {
        if (confirmed) {
            draftNodes = draftNodes.filter(function(n) { return n.local_id !== localId; });
            persistDraft();
            refreshWorkspace();
        }
    });
}

function ejectNode(localId) {
    var node = draftNodes.find(function(n) { return n.local_id === localId; });
    if (!node || node.domain_id === null) return;

    var currentDomain = draftDomains.find(function(d) { return d.local_id === node.domain_id; });
    if (!currentDomain) return;

    node.domain_id = currentDomain.parent_id;
    persistDraft();
    refreshWorkspace();
}



// --- Domain Operations ---



function moveSelectedToDomain(targetDomainId) {
    // Nodes to move
    selectedNodes.forEach(function(localId) {
        var node = draftNodes.find(function(n) { return n.local_id === localId; });
        if (node) node.domain_id = targetDomainId;
    });
    
    // Domains to move
    selectedDomains.forEach(function(sid) {
        if (sid === targetDomainId) return;
        
        // Prevent cyclic parentage
        var isCyclic = false;
        var checkId = targetDomainId;
        while (checkId !== null) {
            var pDomain = draftDomains.find(function(d) { return d.local_id === checkId; });
            if (pDomain && pDomain.parent_id === sid) {
                isCyclic = true;
                break;
            }
            checkId = pDomain ? pDomain.parent_id : null;
        }
        
        if (!isCyclic) {
            var domain = draftDomains.find(function(d) { return d.local_id === sid; });
            if (domain) domain.parent_id = targetDomainId;
        }
    });
    
    selectedNodes.clear();
    selectedDomains.clear();
    persistDraft();
    refreshWorkspace();
}



function handleAddDomainClick() {
    if (selectedNodes.size > 0 || selectedDomains.size > 0) {
        groupSelectedIntoDomain();
    } else {
        openCreateDomainModal();
    }
}

function openCreateDomainModal() {
    document.getElementById('create-domain-id').value = '';
    document.getElementById('create-domain-title').value = '';
    document.getElementById('createDomainModal').style.display = 'flex';
}

function closeCreateDomainModal() {
    document.getElementById('createDomainModal').style.display = 'none';
    if (originalDomainSubmit) {
        window.submitCreateDomain = originalDomainSubmit;
        originalDomainSubmit = null;
    }
}

var originalDomainSubmit = null;

function submitCreateDomain() {
    var domainLocalId = parseInt(document.getElementById('create-domain-id').value);
    var domainName = document.getElementById('create-domain-title').value;

    if (isNaN(domainLocalId) || !domainName) {
        customAlert('Valid ID and Title are required');
        return;
    }

    if (draftDomains.some(function(d) { return d.local_id === domainLocalId; })) {
        customAlert('Domain ID "' + domainLocalId + '" already exists.');
        return;
    }

    draftDomains.push({
        local_id: domainLocalId,
        title: domainName,
        collapsed: false,
        parent_id: null,
        description: ''
    });

    persistDraft();
    closeCreateDomainModal();
    refreshWorkspace();
}

function groupSelectedIntoDomain() {
    openCreateDomainModal();
    
    if (!originalDomainSubmit) {
        originalDomainSubmit = window.submitCreateDomain;
    }

    window.submitCreateDomain = function() {
        var domainLocalId = parseInt(document.getElementById('create-domain-id').value);
        var domainName = document.getElementById('create-domain-title').value;

        if (isNaN(domainLocalId) || !domainName) {
            customAlert('Valid ID and Title are required');
            return;
        }

        var existingDomain = draftDomains.find(function(d) { return d.local_id === domainLocalId; });

        var proceed = function(localId) {
            // Nodes to move
            selectedNodes.forEach(function(nid) {
                var node = draftNodes.find(function(n) { return n.local_id === nid; });
                if (node) node.domain_id = localId;
            });
            
            // Domains to move
            selectedDomains.forEach(function(sid) {
                if (sid === localId) return;
                var domain = draftDomains.find(function(d) { return d.local_id === sid; });
                if (domain) domain.parent_id = localId;
            });

            selectedNodes.clear();
            selectedDomains.clear();
            persistDraft();
            closeCreateDomainModal();
            refreshWorkspace();
        };

        if (existingDomain) {
            customConfirm('Domain ID "' + domainLocalId + '" already exists. Add selected items to it?').then(function(confirmed) {
                if (confirmed) proceed(domainLocalId);
            });
        } else {
            // Determine common parent
            var commonParentId = undefined;
            var mixedParents = false;
            
            selectedNodes.forEach(function(nid) {
                var node = draftNodes.find(function(n) { return n.local_id === nid; });
                var pId = node ? node.domain_id : null;
                if (commonParentId === undefined) commonParentId = pId;
                else if (commonParentId !== pId) mixedParents = true;
            });
            
            selectedDomains.forEach(function(sid) {
                var domain = draftDomains.find(function(d) { return d.local_id === sid; });
                var pId = domain ? domain.parent_id : null;
                if (commonParentId === undefined) commonParentId = pId;
                else if (commonParentId !== pId) mixedParents = true;
            });

            draftDomains.push({
                local_id: domainLocalId,
                title: domainName,
                collapsed: false,
                parent_id: mixedParents ? null : (commonParentId || null),
                description: ''
            });
            proceed(domainLocalId);
        }
    };
}

function toggleDomainCollapse(event, localId) {
    if (event) event.stopPropagation();
    var domain = draftDomains.find(function(d) { return d.local_id === localId; });
    if (domain) {
        domain.collapsed = !domain.collapsed;
        persistDraft();
        renderWorkspace();
    }
}

function openEditDomainModal(localId) {
    var domain = draftDomains.find(function(d) { return d.local_id === localId; });
    if (!domain) return;
    document.getElementById('editDomainModal').dataset.localId = domain.local_id;
    document.getElementById('edit-domain-id-display').innerText = '#' + domain.local_id;
    document.getElementById('edit-domain-id').value = domain.local_id;
    document.getElementById('edit-domain-title').value = domain.title;
    document.getElementById('edit-domain-desc').value = domain.description || '';
    document.getElementById('editDomainModal').style.display = 'flex';
}

function closeEditDomainModal() {
    document.getElementById('editDomainModal').style.display = 'none';
}

function updateDomain() {
    var oldLocalId = parseInt(document.getElementById('editDomainModal').dataset.localId);
    var newLocalId = parseInt(document.getElementById('edit-domain-id').value);
    var title = document.getElementById('edit-domain-title').value;
    var desc = document.getElementById('edit-domain-desc').value;
    
    if (isNaN(newLocalId) || !title) {
        customAlert('Valid ID and Title are required');
        return;
    }

    var domain = draftDomains.find(function(d) { return d.local_id === oldLocalId; });
    if (!domain) return;

    // Check ID conflict if changed
    if (oldLocalId !== newLocalId && draftDomains.some(function(d) { return d.local_id === newLocalId; })) {
        customAlert('Domain ID already exists');
        return;
    }

    // Update references in nodes and other domains
    if (oldLocalId !== newLocalId) {
        draftNodes.forEach(function(n) { if (n.domain_id === oldLocalId) n.domain_id = newLocalId; });
        draftDomains.forEach(function(d) { if (d.parent_id === oldLocalId) d.parent_id = newLocalId; });
    }

    domain.local_id = newLocalId;
    domain.title = title;
    domain.description = desc;
    
    persistDraft();
    closeEditDomainModal();
    refreshWorkspace();
}

function ungroupDomain(localId) {
    customConfirm('Ungroup this domain? Nodes will remain but the domain will be deleted.').then(function(confirmed) {
        if (confirmed) {
            var domain = draftDomains.find(function(d) { return d.local_id === localId; });
            var targetParentId = domain ? domain.parent_id : null;
            
            draftNodes.forEach(function(n) { if (n.domain_id === localId) n.domain_id = targetParentId; });
            draftDomains.forEach(function(d) { if (d.parent_id === localId) d.parent_id = targetParentId; });
            
            draftDomains = draftDomains.filter(function(d) { return d.local_id !== localId; });
            persistDraft();
            refreshWorkspace();
        }
    });
}

function confirmDeleteDomain(localId) {
    customConfirm('PERMANENT DELETE! This will delete the domain AND all nodes and sub-domains inside. Continue?').then(function(confirmed) {
        if (confirmed) {
            var domainsToDelete = new Set();
            function collectRecursive(id) {
                domainsToDelete.add(id);
                draftDomains.forEach(function(d) {
                    if (d.parent_id === id) collectRecursive(d.local_id);
                });
            }
            collectRecursive(localId);

            draftNodes = draftNodes.filter(function(n) { return !domainsToDelete.has(n.domain_id); });
            draftDomains = draftDomains.filter(function(d) { return !domainsToDelete.has(d.local_id); });
            
            persistDraft();
            refreshWorkspace();
        }
    });
}

function ejectDomain(localId) {
    var domain = draftDomains.find(function(d) { return d.local_id === localId; });
    if (!domain || domain.parent_id === null) return;

    var parentDomain = draftDomains.find(function(d) { return d.local_id === domain.parent_id; });
    domain.parent_id = parentDomain ? parentDomain.parent_id : null;
    
    persistDraft();
    refreshWorkspace();
}

function clearWorkspace() {
    customConfirm('Clear current workspace?').then(function(confirmed) {
        if (confirmed) {
            draftNodes = [];
            draftDomains = [];
            currentSnapshotLabel = null;
            baseGraphLabel = null;
            localStorage.removeItem('currentSnapshotLabel');
            localStorage.removeItem('baseGraphLabel');
            localStorage.removeItem('baseGraphCreator');
            
            // Clear version label
            var labelInput = document.getElementById('version-label');
            if (labelInput) labelInput.value = '';

            var overwriteToggle = document.getElementById('overwrite-toggle');
            if (overwriteToggle) {
                overwriteToggle.checked = false;
                handleOverwriteToggle();
            }

            persistDraft();
            refreshWorkspace();
        }
    });
}



function autoSimplifyPrerequisites(inputId) {
    var input = document.getElementById(inputId);
    var expression = input.value;
    if (!expression) return;

    // For the edit modal, we know the current local ID
    var currentNodeId = null;
    if (inputId === 'edit-node-pre') {
        var titleText = document.getElementById('edit-node-id-display').innerText;
        currentNodeId = parseInt(titleText.replace('#', ''));
    } else if (inputId === 'node-pre') {
        var idVal = document.getElementById('node-id').value;
        if (idVal) currentNodeId = parseInt(idVal);
    }

    var simplified = simplifyPrerequisitesInBrowser(expression, currentNodeId, draftNodes);
    if (simplified !== expression) {
        input.value = simplified;

        // Optional: highlight the change
        input.style.backgroundColor = '#e8f0fe';
        setTimeout(function() { input.style.backgroundColor = ''; }, 1000);
    }
}
