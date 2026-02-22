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
    
    return '<tr class="' + rowClass + '" onclick="openEditModal(' + node.local_id + ')">' +
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

function getSourceIcon(type) {
    switch (type) {
        case 'PDF': return '📄';
        case 'Video': return '🎥';
        default: return '🔗';
    }
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
var currentSourceModalType = null; // 'new' or 'edit'
var currentSourceIndex = null; // Index of source being edited

function openSourceModal(type, index) {
    currentSourceModalType = type;
    currentSourceIndex = (typeof index === 'number') ? index : null;
    
    var modalTitle = document.getElementById('source-modal-title');
    var deleteBtn = document.getElementById('btn-delete-source');
    
    // Clear or populate fields
    if (currentSourceIndex !== null) {
        if (modalTitle) modalTitle.innerText = 'Edit Source';
        if (deleteBtn) deleteBtn.style.display = 'block';
        
        var sourcesList = type === 'new' ? newNodeSources : editNodeSources;
        var source = sourcesList[currentSourceIndex];
        console.log('Opening source modal for:', source);
        
        if (source) {
            document.getElementById('source-title').value = source.title || '';
            document.getElementById('source-type').value = source.source_type || 'Other';
            document.getElementById('source-author').value = source.author || '';
            document.getElementById('source-year').value = source.year || '';
            document.getElementById('source-url').value = source.url || '';
            document.getElementById('source-start').value = source.fragment_start || '';
            document.getElementById('source-end').value = source.fragment_end || '';
        }
    } else {
        if (modalTitle) modalTitle.innerText = 'Add Source';
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        document.getElementById('source-title').value = '';
        document.getElementById('source-author').value = '';
        document.getElementById('source-year').value = '';
        document.getElementById('source-url').value = '';
        document.getElementById('source-start').value = '';
        document.getElementById('source-end').value = '';
        document.getElementById('source-type').value = 'Other';
    }
    
    document.getElementById('sourceModal').style.display = 'flex';
}

function closeSourceModal() {
    document.getElementById('sourceModal').style.display = 'none';
    currentSourceModalType = null;
    currentSourceIndex = null;
}

function submitSource() {
    if (!currentSourceModalType) return;
    
    var title = document.getElementById('source-title').value;
    if (!title) {
        customAlert('Title is required');
        return;
    }
    
    var source = {
        title: title,
        source_type: document.getElementById('source-type').value,
        author: document.getElementById('source-author').value || null,
        year: document.getElementById('source-year').value ? parseInt(document.getElementById('source-year').value) : null,
        url: document.getElementById('source-url').value || null,
        fragment_start: document.getElementById('source-start').value || null,
        fragment_end: document.getElementById('source-end').value || null
    };
    
    var sourcesList = currentSourceModalType === 'new' ? newNodeSources : editNodeSources;
    
    if (currentSourceIndex !== null) {
        // Update existing
        if (sourcesList[currentSourceIndex].id) {
            source.id = sourcesList[currentSourceIndex].id;
        }
        sourcesList[currentSourceIndex] = source;
    } else {
        // Add new
        sourcesList.push(source);
    }
    
    renderSources(currentSourceModalType);
    closeSourceModal();
}

function deleteCurrentSource() {
    if (!currentSourceModalType || currentSourceIndex === null) return;
    
    var sourcesList = currentSourceModalType === 'new' ? newNodeSources : editNodeSources;
    sourcesList.splice(currentSourceIndex, 1);
    
    renderSources(currentSourceModalType);
    closeSourceModal();
}

function renderSources(type) {
    var containerId = type === 'new' ? 'new-node-sources' : 'edit-node-sources';
    var sourcesList = type === 'new' ? newNodeSources : editNodeSources;
    var container = document.getElementById(containerId);
    
    var html = '';
    if (sourcesList.length === 0) {
        html = '<p style="color: #888; font-style: italic; font-size: 0.9em;">No sources added.</p>';
    } else {
        for (var i = 0; i < sourcesList.length; i++) {
            var s = sourcesList[i];
            // Handle legacy strings if any slip through
            if (typeof s === 'string') {
                 html += '<span class="source-tag">' + 
                    '<a href="' + s + '" target="_blank" class="source-link">' + s + '</a>' +
                    '<span class="remove-source" onclick="removeSource(\'' + type + '\', ' + i + ')">&times;</span>' +
                    '</span>';
            } else {
                var icon = getSourceIcon(s.source_type);
                // Make the row clickable to edit
                html += '<div class="source-item-row" onclick="openSourceModal(\'' + type + '\', ' + i + ')">' + 
                        '<div class="source-icon">' + icon + '</div>' +
                        '<div class="source-main-info">' + 
                            '<div class="source-title">' + s.title + '</div>' + 
                        '</div>' +
                        '<div class="source-meta-info">' +
                            (s.author ? '<span class="meta-item meta-author">' + s.author + '</span>' : '') +
                            (s.year ? '<span class="meta-item meta-year">' + s.year + '</span>' : '') +
                            '<span class="meta-item meta-type">' + s.source_type + '</span>' +
                        '</div>' +
                        '<div class="source-actions">' +
                            (s.url ? '<a href="' + s.url + '" target="_blank" class="btn-goto" onclick="event.stopPropagation()">Go to ↗</a>' : '') +
                        '</div>' +
                        '<div class="source-arrow">›</div>' +
                        '</div>';
            }
        }
    }
    container.innerHTML = html;
}

function openViewSourceModal(nodeId, sourceIndex) {
    var node = draftNodes.find(function(n) { return n.local_id === nodeId; });
    if (!node || !node.source_items || !node.source_items[sourceIndex]) return;
    
    var s = node.source_items[sourceIndex];
    
    var html = '<div class="view-source-details">' +
               '<div class="detail-row"><span class="label">Type:</span> <span>' + getSourceIcon(s.source_type) + ' ' + s.source_type + '</span></div>' +
               '<div class="detail-row"><span class="label">Title:</span> <strong>' + s.title + '</strong></div>' +
               (s.author ? '<div class="detail-row"><span class="label">Author:</span> <span>' + s.author + '</span></div>' : '') +
               (s.year ? '<div class="detail-row"><span class="label">Year:</span> <span>' + s.year + '</span></div>' : '') +
               (s.url ? '<div class="detail-row"><span class="label">URL:</span> <a href="' + s.url + '" target="_blank">' + s.url + '</a></div>' : '') +
               ((s.fragment_start || s.fragment_end) ? 
                    '<div class="detail-row"><span class="label">Fragment:</span> <span>' + 
                    (s.fragment_start ? 'Start: ' + s.fragment_start : '') + 
                    (s.fragment_start && s.fragment_end ? ' - ' : '') + 
                    (s.fragment_end ? 'End: ' + s.fragment_end : '') + 
                    '</span></div>' : '') +
               '</div>';
               
    document.getElementById('view-source-content').innerHTML = html;
    document.getElementById('viewSourceModal').style.display = 'flex';
}

function closeViewSourceModal() {
    document.getElementById('viewSourceModal').style.display = 'none';
}
