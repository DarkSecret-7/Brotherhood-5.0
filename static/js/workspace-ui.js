// --- Workspace Rendering & UI State ---

function refreshWorkspace() {
    updateVersionDisplay();
    renderWorkspace();
    handleOverwriteToggle();
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

function handleOverwriteToggle() {
    var toggle = document.getElementById('overwrite-toggle');
    if (!toggle) return;
    
    var labelInput = document.getElementById('version-label');
    var currentUser = getCurrentUser();
    var baseCreator = localStorage.getItem('baseGraphCreator');
    
    // Allowed if baseCreator is unknown/empty or matches current user
    // AND workspace is not empty
    var isWorkspaceEmpty = (draftNodes.length === 0 && draftDomains.length === 0);
    // OPEN ACCESS: If baseCreator is null/empty OR "Unknown", anyone can overwrite
    var canOverwrite = (!baseCreator || baseCreator === 'Unknown' || baseCreator === currentUser) && !isWorkspaceEmpty;
    
    var container = toggle.parentNode;
    if (container && container.classList.contains('form-group')) {
        if (canOverwrite) {
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
            toggle.checked = false;
        }
    }
    
    if (toggle.checked) {
        if (baseGraphLabel) {
            labelInput.value = baseGraphLabel;
        }
        labelInput.readOnly = true;
        labelInput.style.backgroundColor = '#f1f3f4';
    } else {
        labelInput.readOnly = false;
        labelInput.style.backgroundColor = '';
    }
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
    if (document.getElementById('graph-visualizer') && document.getElementById('graph-visualizer').style.display === 'block') {
        if (typeof renderGraph === 'function') renderGraph(nodes, domains);
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

function updateGroupButtonVisibility() {
    var btn = document.getElementById('btn-group-domain');
    if (!btn) return;
    if (selectedNodes.size > 0 || selectedDomains.size > 0) {
        btn.innerText = 'Group under Domain';
    } else {
        btn.innerText = 'Add Domain';
    }
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

// Source Management for Forms
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
