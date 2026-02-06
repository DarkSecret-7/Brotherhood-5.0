// --- Configuration ---
var API_BASE = '/api/v1';
var currentSnapshotLabel = localStorage.getItem('currentSnapshotLabel') || null;
var baseGraphLabel = localStorage.getItem('baseGraphLabel') || null;
var newNodeSources = [];
var editNodeSources = [];

// Domain State (Now handled entirely by browser localStorage)
var draftDomains = JSON.parse(localStorage.getItem('draftDomains')) || [];
var draftNodes = JSON.parse(localStorage.getItem('draftNodes')) || [];

var selectedNodes = new Set();
var selectedDomains = new Set();

// Helper to persist state to localStorage
function persistDraft() {
    localStorage.setItem('draftDomains', JSON.stringify(draftDomains));
    localStorage.setItem('draftNodes', JSON.stringify(draftNodes));
    if (currentSnapshotLabel) localStorage.setItem('currentSnapshotLabel', currentSnapshotLabel);
    if (baseGraphLabel) localStorage.setItem('baseGraphLabel', baseGraphLabel);
}

// Initializing the UI
window.addEventListener('DOMContentLoaded', function() {
    var overwriteToggle = document.getElementById('overwrite-toggle');
    if (overwriteToggle) {
        // If we have a base graph (loaded or just saved), turn overwrite on
        // Otherwise (new workspace), turn it off
        if (baseGraphLabel) {
            overwriteToggle.checked = true;
        } else {
            overwriteToggle.checked = false;
        }
        handleOverwriteToggle();
    }
});

function handleOverwriteToggle() {
    var toggle = document.getElementById('overwrite-toggle');
    var labelInput = document.getElementById('version-label');
    var hint = document.getElementById('overwrite-hint');
    
    if (toggle.checked) {
        if (baseGraphLabel) {
            labelInput.value = baseGraphLabel;
        }
        labelInput.readOnly = true;
        labelInput.style.backgroundColor = '#f1f3f4';
        if (hint) hint.style.display = 'block';
    } else {
        labelInput.readOnly = false;
        labelInput.style.backgroundColor = '';
        if (hint) hint.style.display = 'none';
    }
}

// --- Custom Dialog System ---
var dialogPromiseResolve = null;

function showDialog(options) {
    var modal = document.getElementById('dialogModal');
    document.getElementById('dialog-title').innerText = options.title || 'Notification';
    document.getElementById('dialog-body').innerText = options.message || '';
    
    var inputContainer = document.getElementById('dialog-input-container');
    var input = document.getElementById('dialog-input');
    var cancelBtn = document.getElementById('dialog-cancel-btn');
    var confirmBtn = document.getElementById('dialog-confirm-btn');
    
    if (options.type === 'prompt') {
        inputContainer.style.display = 'block';
        input.value = options.defaultValue || '';
        cancelBtn.style.display = 'inline-block';
    } else if (options.type === 'confirm') {
        inputContainer.style.display = 'none';
        cancelBtn.style.display = 'inline-block';
    } else {
        inputContainer.style.display = 'none';
        cancelBtn.style.display = 'none';
    }
    
    confirmBtn.innerText = options.confirmText || 'OK';
    cancelBtn.innerText = options.cancelText || 'Cancel';
    
    modal.style.display = 'flex';
    if (options.type === 'prompt') input.focus();
    
    return new Promise(function(resolve) {
        dialogPromiseResolve = resolve;
    });
}

function closeDialog(result) {
    var modal = document.getElementById('dialogModal');
    var input = document.getElementById('dialog-input');
    var type = document.getElementById('dialog-input-container').style.display === 'block' ? 'prompt' : 
               (document.getElementById('dialog-cancel-btn').style.display === 'inline-block' ? 'confirm' : 'alert');
    
    modal.style.display = 'none';
    
    if (dialogPromiseResolve) {
        if (type === 'prompt') {
            dialogPromiseResolve(result ? input.value : null);
        } else {
            dialogPromiseResolve(result);
        }
        dialogPromiseResolve = null;
    }
}

// Global replacements for native calls
window.customAlert = function(msg) {
    return showDialog({ type: 'alert', title: 'Alert', message: msg });
};
window.customConfirm = function(msg) {
    return showDialog({ type: 'confirm', title: 'Confirm', message: msg });
};
window.customPrompt = function(msg, def) {
    return showDialog({ type: 'prompt', title: 'Prompt', message: msg, defaultValue: def });
};

// --- Low-Level API Service (Network Layer) ---
var api = {
    _getHeaders: function() {
        var token = localStorage.getItem('access_token');
        var headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    },
    _handleResponse: function(response) {
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('access_token');
            document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }
        return response;
    },
    fetchSnapshots: function() {
        return fetch(API_BASE + '/snapshots', { headers: this._getHeaders() })
            .then(this._handleResponse)
            .then(function(res) { return res.json(); });
    },
    fetchSnapshot: function(id) {
        return fetch(API_BASE + '/snapshots/' + id, { headers: this._getHeaders() })
            .then(this._handleResponse)
            .then(function(res) { return res.json(); });
    },
    deleteSnapshot: function(id) {
        return fetch(API_BASE + '/snapshots/' + id, { 
            method: 'DELETE',
            headers: this._getHeaders()
        }).then(this._handleResponse);
    },
    postSaveSnapshot: function(snapshotData) {
        return fetch(API_BASE + '/snapshots', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(snapshotData)
        }).then(this._handleResponse);
    },
    postSimplifyPrerequisites: function(expression, currentNodeId, contextNodes) {
        return fetch(API_BASE + '/draft/simplify-prerequisites', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ 
                expression: expression, 
                current_node_id: currentNodeId,
                context_nodes: contextNodes 
            })
        }).then(this._handleResponse).then(function(res) { return res.json(); });
    }
};

function logout() {
    // Clear the token from localStorage
    localStorage.removeItem('access_token');
    
    // Clear the token from cookies by setting an expired date
    // We clear multiple variations to be safe (with/without samesite/path)
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=lax;";
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=strict;";
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    
    // Force a redirect to the login page using replace to clear history
    window.location.replace('/login');
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

    api.postSimplifyPrerequisites(expression, currentNodeId, draftNodes).then(function(data) {
        if (data.simplified_expression !== expression) {
            console.log('Simplified expression from:', expression, 'to:', data.simplified_expression);
            input.value = data.simplified_expression;
            
            // Optional: highlight the change
            input.style.backgroundColor = '#e8f0fe';
            setTimeout(function() { input.style.backgroundColor = ''; }, 1000);
        }
    });
}

// --- UI Rendering ---
function refreshWorkspace() {
    updateVersionDisplay();
    renderWorkspace();
}

function renderWorkspace() {
    var nodes = draftNodes;
    var domains = draftDomains;
    
    var listDiv = document.getElementById('draft-nodes-list');
    document.getElementById('draft-count').innerText = nodes.length + ' Nodes';
    
    if (nodes.length === 0 && domains.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">Your workspace is currently empty.</p>';
        return;
    }

    // Build domain tree
    var domainMap = {};
    // Sort domains by local_id to ensure consistent processing order
    var sortedDomains = JSON.parse(JSON.stringify(domains));
    sortedDomains.sort(function(a, b) { return a.local_id - b.local_id; });
    
    sortedDomains.forEach(function(d) { 
        domainMap[d.local_id] = d; 
        d.children = []; 
        d.nodeList = []; 
    });
    
    var rootDomains = [];
    sortedDomains.forEach(function(d) {
        if (d.parent_id !== null && domainMap[d.parent_id]) {
            domainMap[d.parent_id].children.push(d);
        } else {
            rootDomains.push(d);
        }
    });

    // Add nodes to their domains
    var standaloneNodes = [];
    // Sort nodes by local_id to ensure consistent ordering
    var sortedNodes = JSON.parse(JSON.stringify(nodes));
    sortedNodes.sort(function(a, b) { return a.local_id - b.local_id; });
    
    sortedNodes.forEach(function(node) {
        if (node.domain_id !== null && domainMap[node.domain_id]) {
            domainMap[node.domain_id].nodeList.push(node);
        } else {
            standaloneNodes.push(node);
        }
    });

    // Final sort for children lists to ensure stability
    sortedDomains.forEach(function(d) {
        d.children.sort(function(a, b) { return a.local_id - b.local_id; });
        d.nodeList.sort(function(a, b) { return a.local_id - b.local_id; });
    });
    rootDomains.sort(function(a, b) { return a.local_id - b.local_id; });
    standaloneNodes.sort(function(a, b) { return a.local_id - b.local_id; });

    var html = '<table><thead><tr><th class="tree-column">ID</th><th>Title</th><th>Prerequisites</th><th>Actions</th></tr></thead><tbody>';
    
    // Recursive render function
    function renderDomain(domain, depth) {
        var isCollapsed = domain.collapsed;
        var levelIndent = 15;
        var currentPadding = (depth * levelIndent) + 5;
        var isAnySelected = selectedNodes.size > 0 || selectedDomains.size > 0;
        var isThisDomainSelected = selectedDomains.has(domain.local_id);
        
        html += '<tr class="domain-folder ' + (isCollapsed ? 'collapsed' : '') + '" onclick="openEditDomainModal(' + domain.local_id + ')">' +
            '<td class="tree-column" onclick="event.stopPropagation()" style="padding-left: ' + currentPadding + 'px;">' +
                '<input type="checkbox" class="selection-checkbox" ' + (selectedDomains.has(domain.local_id) ? 'checked' : '') + ' onchange="toggleDomainSelection(' + domain.local_id + ')">' +
                '<span class="folder-icon" onclick="toggleDomainCollapse(event, ' + domain.local_id + ')">' + (isCollapsed ? '▶' : '▼') + '</span>' +
                '<span class="domain-badge">' + domain.local_id + '</span>' +
            '</td>' +
            '<td colspan="3" style="padding-left: ' + (depth * levelIndent) + 'px;">' +
                '<strong class="clickable-title">' + domain.title + '</strong>' +
                (domain.description ? ' <span class="domain-description">' + domain.description + '</span>' : '') +
                ' <div class="domain-actions" onclick="event.stopPropagation()">' +
                    (isAnySelected && !isThisDomainSelected ? '<button class="btn-primary btn-small" onclick="moveSelectedToDomain(' + domain.local_id + ')">Move</button>' : '') +
                    (domain.parent_id !== null ? '<button class="btn-secondary btn-small" onclick="ejectDomain(' + domain.local_id + ')">Eject</button>' : '') +
                    '<button class="btn-secondary btn-small" onclick="ungroupDomain(' + domain.local_id + ')">Ungroup</button>' +
                    '<button class="btn-danger btn-small" onclick="confirmDeleteDomain(' + domain.local_id + ')">Delete All</button>' +
                '</div>' +
            '</td>' +
        '</tr>';

        if (!isCollapsed) {
            // Render sub-domains
            domain.children.forEach(function(child) {
                renderDomain(child, depth + 1);
            });
            
            // Render nodes
            domain.nodeList.forEach(function(node) {
                html += renderNodeRow(node, domain.local_id, depth + 1);
            });
        }
    }

    rootDomains.forEach(function(d) { renderDomain(d, 0); });
    standaloneNodes.forEach(function(node) { html += renderNodeRow(node, null, 0); });

    html += '</tbody></table>';
    listDiv.innerHTML = html;

    // Sync graph if visible
    if (document.getElementById('graph-visualizer').style.display === 'block') {
        renderGraph(nodes, domains);
    }
    
    updateGroupButtonVisibility();
}

function renderNodeRow(node, domainId, depth) {
    var isSelected = selectedNodes.has(node.local_id);
    var rowClass = 'domain-node-row ' + (isSelected ? ' selected-row' : '');
    
    var levelIndent = 15;
    var currentPadding = (depth * levelIndent) + 5;
    
    return '<tr class="' + rowClass + '" onclick="openEditModal(' + JSON.stringify(node).replace(/"/g, '&quot;') + ')">' +
        '<td class="tree-column" onclick="event.stopPropagation()" style="padding-left: ' + currentPadding + 'px;">' +
            '<input type="checkbox" class="selection-checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="toggleNodeSelection(' + node.local_id + ')">' +
            '<span class="node-id">' + node.local_id + '</span>' +
        '</td>' +
        '<td style="padding-left: ' + (depth * levelIndent) + 'px;"><strong>' + node.title + '</strong></td>' +
        '<td><code>' + (node.prerequisite || '-') + '</code></td>' +
        '<td>' +
            '<div class="node-actions" onclick="event.stopPropagation()">' +
                (domainId !== null ? '<button class="btn-secondary btn-small" onclick="ejectNode(' + node.local_id + ')">Eject</button>' : '') +
                '<button class="btn-danger btn-small" onclick="confirmDeleteNode(event, ' + node.local_id + ')">Delete</button>' +
            '</div>' +
        '</td>' +
    '</tr>';
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

function ejectDomain(localId) {
    var domain = draftDomains.find(function(d) { return d.local_id === localId; });
    if (!domain || domain.parent_id === null) return;

    var parentDomain = draftDomains.find(function(d) { return d.local_id === domain.parent_id; });
    domain.parent_id = parentDomain ? parentDomain.parent_id : null;
    
    persistDraft();
    refreshWorkspace();
}

function toggleNodeSelection(localId) {
    if (selectedNodes.has(localId)) {
        selectedNodes.delete(localId);
    } else {
        selectedNodes.add(localId);
    }
    updateGroupButtonVisibility();
    refreshWorkspace();
}

function toggleDomainSelection(localId) {
    if (selectedDomains.has(localId)) {
        selectedDomains.delete(localId);
    } else {
        selectedDomains.add(localId);
    }
    updateGroupButtonVisibility();
    refreshWorkspace();
}

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

function updateGroupButtonVisibility() {
    var btn = document.getElementById('btn-group-domain');
    if (selectedNodes.size > 0 || selectedDomains.size > 0) {
        btn.innerText = 'Group under Domain';
    } else {
        btn.innerText = 'Add Domain';
    }
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

function addSource(type) {
    var inputId = type === 'new' ? 'new-source-input' : 'edit-source-input';
    var sourcesList = type === 'new' ? newNodeSources : editNodeSources;
    var input = document.getElementById(inputId);
    var url = input.value.trim();
    
    if (url) {
        if (!url.startsWith('http')) url = 'https://' + url;
        sourcesList.push(url);
        input.value = '';
        renderSources(type);
    }
}

function removeSource(type, index) {
    var sourcesList = type === 'new' ? newNodeSources : editNodeSources;
    sourcesList.splice(index, 1);
    renderSources(type);
}

function renderSources(type) {
    var containerId = type === 'new' ? 'new-node-sources' : 'edit-node-sources';
    var sourcesList = type === 'new' ? newNodeSources : editNodeSources;
    var container = document.getElementById(containerId);
    
    var html = '';
    for (var i = 0; i < sourcesList.length; i++) {
        html += '<span class="source-tag" title="' + sourcesList[i] + '">' + 
                '<a href="' + sourcesList[i] + '" target="_blank" class="source-link">' + sourcesList[i] + '</a>' +
                '<span class="remove-source" onclick="removeSource(\'' + type + '\', ' + i + ')">&times;</span>' +
                '</span>';
    }
    container.innerHTML = html;
}

function updateVersionDisplay() {
    var infoDiv = document.getElementById('active-version-info');
    var labelSpan = document.getElementById('current-version-label');
    if (baseGraphLabel) {
        infoDiv.style.display = 'block';
        labelSpan.innerText = baseGraphLabel;
    } else {
        infoDiv.style.display = 'none';
    }
}

function refreshSnapshots() {
    api.fetchSnapshots().then(function(snapshots) {
        var listDiv = document.getElementById('snapshots-list');
        if (snapshots.length === 0) {
            listDiv.innerHTML = '<p class="empty-state">No snapshots found in database.</p>';
            return;
        }

        var html = '<table><thead><tr><th>Version</th><th>Nodes</th><th>Created By</th><th>Based On</th><th>Actions</th></tr></thead><tbody>';
        for (var i = 0; i < snapshots.length; i++) {
            var s = snapshots[i];
            var createdDate = new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            var updatedDate = new Date(s.last_updated).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            
            html += '<tr>' +
                '<td>' +
                    '<div class="version-badge">' + (s.version_label || 'v' + s.id) + '</div>' +
                    '<div style="font-size: 0.7em; color: #9aa0a6; margin-top: 6px; line-height: 1.3;">' +
                        '<b>C:</b> ' + createdDate + '<br>' +
                        '<b>U:</b> ' + updatedDate +
                    '</div>' +
                '</td>' +
                '<td>' + s.node_count + '</td>' +
                '<td>' + (s.created_by || 'system') + '</td>' +
                '<td>' + (s.base_graph || 'None') + '</td>' +
                '<td>' +
                    '<div style="display: flex; gap: 5px;">' +
                        '<button class="btn-secondary btn-small" onclick="fetchSnapshotToWorkspace(event, ' + s.id + ')">Fetch to Workspace</button>' +
                        '<button class="btn-danger btn-small" onclick="deleteSnapshot(event, ' + s.id + ')">Delete</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }
        html += '</tbody></table>';
        listDiv.innerHTML = html;
    });
}

function switchTab(tabName) {
    var tabs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    document.getElementById('tab-' + tabName).classList.add('active');

    var sections = document.querySelectorAll('.view-section');
    for (var j = 0; j < sections.length; j++) sections[j].classList.remove('active');
    document.getElementById('view-' + tabName).classList.add('active');

    if (tabName === 'workspace') refreshWorkspace();
    if (tabName === 'database') refreshSnapshots();
}

function fetchSnapshotToWorkspace(event, snapshotId) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    customConfirm('STOP! This will clear your current workspace and load snapshot #' + snapshotId + '. Continue?').then(function(userChoice) {
        if (userChoice === true) {
            api.fetchSnapshot(snapshotId).then(function(snapshot) {
                // Map domains and nodes to local IDs (backend IDs are not used in browser drafts)
                draftDomains = snapshot.domains.map(function(d) {
                    return {
                        local_id: d.local_id,
                        title: d.title,
                        description: d.description,
                        collapsed: d.collapsed,
                        parent_id: d.parent_id ? snapshot.domains.find(pd => pd.id === d.parent_id).local_id : null
                    };
                });

                draftNodes = snapshot.nodes.map(function(n) {
                    return {
                        local_id: n.local_id,
                        title: n.title,
                        description: n.description,
                        prerequisite: n.prerequisite,
                        sources: n.sources,
                        domain_id: n.domain_id ? snapshot.domains.find(pd => pd.id === n.domain_id).local_id : null
                    };
                });

                currentSnapshotLabel = snapshot.version_label || ('v' + snapshot.id);
                baseGraphLabel = currentSnapshotLabel; // The original graph it was based on
                localStorage.setItem('currentSnapshotLabel', currentSnapshotLabel);
                localStorage.setItem('baseGraphLabel', baseGraphLabel);
                
                // Update toggle and label
                var overwriteToggle = document.getElementById('overwrite-toggle');
                if (overwriteToggle) {
                    overwriteToggle.checked = true;
                    handleOverwriteToggle();
                }
                
                persistDraft();
                switchTab('workspace');
            }).catch(function(err) {
                customAlert('Error fetching snapshot: ' + err.message);
            });
        }
    });
}

function deleteSnapshot(event, snapshotId) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    customConfirm('PERMANENT DELETE! Are you sure you want to remove snapshot #' + snapshotId + ' from the database?').then(function(confirmed) {
        if (confirmed) {
            api.deleteSnapshot(snapshotId).then(function(res) {
                if (res.ok) refreshSnapshots();
                else customAlert('Error deleting snapshot');
            });
        }
    });
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

function saveSnapshot() {
    if (draftNodes.length === 0 && draftDomains.length === 0) {
        customAlert('Cannot save an empty graph.');
        return;
    }
    var label = document.getElementById('version-label').value;
    var overwriteToggle = document.getElementById('overwrite-toggle').checked;

    var performSave = function(isOverwrite) {
        var payload = {
            version_label: label || null,
            base_graph: baseGraphLabel || null,
            nodes: draftNodes,
            domains: draftDomains,
            overwrite: isOverwrite
        };
        api.postSaveSnapshot(payload).then(function(res) {
            if (res.ok) {
                customAlert('Saved!');
                document.getElementById('version-label').value = '';
                
                // Keep baseGraphLabel consistent - this is what we are "Working on"
                // If we saved with a new label, that becomes the new base for future edits
                if (label) {
                    baseGraphLabel = label;
                    localStorage.setItem('baseGraphLabel', baseGraphLabel);
                }
                
                currentSnapshotLabel = null;
                localStorage.removeItem('currentSnapshotLabel');
                
                // Refresh the toggle state and display
                var toggle = document.getElementById('overwrite-toggle');
                if (toggle) {
                    toggle.checked = true; // After saving, we are effectively working on the saved version
                    handleOverwriteToggle();
                }

                switchTab('database');
            } else {
                res.json().then(function(data) {
                    if (data.detail && data.detail.indexOf("Confirm overwrite") !== -1) {
                        customConfirm(data.detail + "\n\nNote: The original 'Created By' attribute will be preserved. To be credited as the creator, please turn off 'Overwrite' and provide a new name for your graph.").then(function(confirmed) {
                            if (confirmed) performSave(true);
                        });
                    } else {
                        customAlert('Error: ' + (data.detail || 'Could not save snapshot'));
                    }
                });
            }
        });
    };

    if (overwriteToggle && label && label === baseGraphLabel) {
        performSave(true);
    } else {
        customConfirm('Save workspace as snapshot?').then(function(confirmed) {
            if (confirmed) {
                performSave(overwriteToggle);
            }
        });
    }
}

function addNode() {
    var domainLocalId = parseInt(document.getElementById('node-parent-domain').value);
    var localId = parseInt(document.getElementById('node-id').value);
    var title = document.getElementById('node-title').value;
    var desc = document.getElementById('node-desc').value;
    var pre = document.getElementById('node-pre').value;
    var sources = newNodeSources.join(',');

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
        sources: sources,
        domain_id: resolvedDomainId
    });

    persistDraft();
    document.getElementById('node-id').value = '';
    document.getElementById('node-title').value = '';
    document.getElementById('node-desc').value = '';
    document.getElementById('node-pre').value = '';
    newNodeSources = [];
    renderSources('new');
    refreshWorkspace();
}

function openEditModal(node) {
    document.getElementById('edit-node-id-display').innerText = '#' + node.local_id;
    document.getElementById('edit-node-id').value = node.local_id;
    document.getElementById('edit-node-title').value = node.title;
    document.getElementById('edit-node-desc').value = node.description || '';
    document.getElementById('edit-node-pre').value = node.prerequisite || '';
    editNodeSources = node.sources ? node.sources.split(',') : [];
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
    var sources = editNodeSources.join(',');

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
    node.sources = sources;

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

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == document.getElementById('editModal')) closeEditModal();
    if (event.target == document.getElementById('editDomainModal')) closeEditDomainModal();
    if (event.target == document.getElementById('createDomainModal')) closeCreateDomainModal();
};

// --- Graph Visualization Logic ---
var network = null;

function toggleGraph(btn) {
    var visualizer = document.getElementById('graph-visualizer');
    var button = btn || document.querySelector('[onclick^="toggleGraph"]');
    if (visualizer.style.display === 'none') {
        visualizer.style.display = 'block';
        document.getElementById('graph-container').style.display = 'block';
        if (button) button.innerText = 'Hide Graph Visualizer';
        renderGraph(draftNodes, draftDomains);
    } else {
        visualizer.style.display = 'none';
        if (button) button.innerText = 'Show Graph Visualizer';
    }
}

function renderGraph(nodes, domains) {
    var container = document.getElementById('graph-container');
    var visNodes = [];
    var visEdges = [];
    var addedEdges = new Set();
    var domainMap = {};
    domains.forEach(function(d) { domainMap[d.local_id] = d; });

    function getVisibleParent(localId, isNode) {
        var currentDomainId = isNode ? nodes.find(n => n.local_id === localId).domain_id : domainMap[localId].parent_id;
        if (!currentDomainId) return null;
        var visibleId = null;
        var tempId = currentDomainId;
        while (tempId && domainMap[tempId]) {
            if (domainMap[tempId].collapsed) visibleId = tempId;
            tempId = domainMap[tempId].parent_id;
        }
        return visibleId ? 'domain_' + visibleId : null;
    }

    nodes.forEach(function(node) {
        var visibleParentId = getVisibleParent(node.local_id, true);
        if (!visibleParentId) {
            visNodes.push({
                id: node.local_id,
                label: '<b>' + node.local_id + '</b>\n' + node.title,
                title: node.description || 'No description',
                shape: 'box',
                font: { multi: 'html' }
            });
        }
    });

    domains.forEach(function(d) {
        if (d.collapsed) {
            var visibleParentId = getVisibleParent(d.local_id, false);
            if (!visibleParentId) {
                visNodes.push({
                    id: 'domain_' + d.local_id,
                    label: '<b>' + d.title + '</b>\n(Domain)',
                    shape: 'folder',
                    color: '#e8f0fe',
                    font: { multi: 'html', bold: true }
                });
            }
        }
    });

    nodes.forEach(function(node) {
        if (node.prerequisite) {
            var prereqs = node.prerequisite.match(/\d+/g);
            if (prereqs) {
                var visibleTarget = getVisibleParent(node.local_id, true) || node.local_id;
                prereqs.forEach(function(p) {
                    var sourceId = parseInt(p);
                    var sourceNode = nodes.find(n => n.local_id === sourceId);
                    if (!sourceNode) return;
                    var visibleSource = getVisibleParent(sourceId, true) || sourceId;
                    if (visibleSource !== visibleTarget) {
                        var edgeKey = visibleSource + '->' + visibleTarget;
                        if (!addedEdges.has(edgeKey)) {
                            visEdges.push({ from: visibleSource, to: visibleTarget, arrows: 'to' });
                            addedEdges.add(edgeKey);
                        }
                    }
                });
            }
        }
    });

    var data = { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) };
    var options = {
        nodes: { font: { face: 'Segoe UI' } },
        edges: { arrows: { to: { enabled: true } }, smooth: { type: 'continuous' }, color: { inherit: 'both' } },
        physics: { enabled: false },
        interaction: { hover: true, navigationButtons: true, keyboard: true }
    };

    if (network) network.destroy();
    network = new vis.Network(container, data, options);
}

function refreshGraph() {
    renderGraph(draftNodes, draftDomains);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', function() {
    refreshWorkspace();
});
