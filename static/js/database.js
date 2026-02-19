// Database Operations: Snapshots Management

function loadSnapshotIntoWorkspace(snapshot) {
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
    localStorage.setItem('baseGraphCreator', snapshot.created_by || '');
    
    // Update toggle and label
    var overwriteToggle = document.getElementById('overwrite-toggle');
    if (overwriteToggle) {
        overwriteToggle.checked = true;
    }
    handleOverwriteToggle();
    
    // Clear version label on fresh load
    var labelInput = document.getElementById('version-label');
    if (labelInput) labelInput.value = '';
    
    persistDraft();
    switchTab('workspace');
}

function fetchSnapshotToWorkspace(event, snapshotId) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    customConfirm('STOP! This will clear your current workspace and load snapshot #' + snapshotId + '. Continue?').then(function(userChoice) {
        if (userChoice === true) {
            api.fetchSnapshot(snapshotId).then(function(snapshot) {
                loadSnapshotIntoWorkspace(snapshot);
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
                if (res.ok) {
                    localStorage.removeItem('cachedSnapshots');
                    refreshSnapshots(true);
                }
                else customAlert('Error deleting snapshot');
            });
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
            created_by: getCurrentUser(),
            nodes: draftNodes,
            domains: draftDomains,
            overwrite: isOverwrite
        };
        api.postSaveSnapshot(payload).then(function(res) {
            if (res.ok) {
                res.json().then(function(savedData) {
                    customAlert('Saved!');
                    document.getElementById('version-label').value = '';

                    // Invalidate cache and refresh list (background)
                    localStorage.removeItem('cachedSnapshots');
                    refreshSnapshots(true);
                    
                    // Fetch and load the new snapshot to ensure sync
                    // If savedData contains full graph (nodes/domains), use it. Otherwise fetch it by ID.
                    var promise = (savedData.nodes && savedData.domains) 
                        ? Promise.resolve(savedData) 
                        : api.fetchSnapshot(savedData.id);
                        
                    promise.then(function(snapshot) {
                        loadSnapshotIntoWorkspace(snapshot);
                    }).catch(function(err) {
                        console.error('Error reloading snapshot after save:', err);
                        customAlert('Saved, but failed to reload workspace: ' + err.message);
                    });
                });
            } else {
                    // Try to parse as JSON, fallback to text
                    var contentType = res.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        res.json().then(function(data) {
                            if (data.detail && typeof data.detail === 'string' && data.detail.indexOf("Confirm overwrite") !== -1) {
                                customConfirm(data.detail).then(function(confirmed) {
                                    if (confirmed) performSave(true);
                                });
                            } else {
                                customAlert('Error: ' + (data.detail || data.error || 'Could not save snapshot'));
                            }
                        });
                    } else {
                        res.text().then(function(text) {
                            customAlert('Error saving snapshot (Server Error): ' + text);
                        });
                    }
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

function refreshSnapshots(force) {
    var listDiv = document.getElementById('snapshots-list');
    
    // Cache Check: If force is false/undefined, try to load from localStorage
    if (!force) {
        var cached = localStorage.getItem('cachedSnapshots');
        if (cached) {
            try {
                var cachedData = JSON.parse(cached);
                // Simple cache validation: check if it's an array and not too old (e.g., < 1 hour) - skipping time for now for simplicity
                if (Array.isArray(cachedData)) {
                    renderSnapshots(cachedData);
                    return;
                }
            } catch (e) {
                console.error('Cache parse error', e);
            }
        }
    }

    listDiv.innerHTML = '<p>Loading snapshots...</p>';
    
    api.fetchSnapshots().then(function(snapshots) {
        if (snapshots.length === 0) {
            listDiv.innerHTML = '<p class="empty-state">No snapshots found in database.</p>';
            localStorage.removeItem('cachedSnapshots');
            return;
        }

        // Cache the new data
        localStorage.setItem('cachedSnapshots', JSON.stringify(snapshots));
        renderSnapshots(snapshots);
    });
}

function renderSnapshots(snapshots) {
    var listDiv = document.getElementById('snapshots-list');
    var currentUser = getCurrentUser();
    var html = '<table><thead><tr><th>Version</th><th>Nodes</th><th>Created By</th><th>Based On</th><th>Actions</th></tr></thead><tbody>';
    for (var i = 0; i < snapshots.length; i++) {
        var s = snapshots[i];
        var createdDate = new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        var updatedDate = new Date(s.last_updated).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        
        // OPEN ACCESS: If created_by is null/empty OR "Unknown", anyone can delete
        var isCreator = !s.created_by || s.created_by === 'Unknown' || s.created_by === currentUser;
        
        var deleteBtn = isCreator ? '<button class="btn-danger btn-small" onclick="deleteSnapshot(event, ' + s.id + ')">Delete</button>' : '';

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
                    deleteBtn +
                '</div>' +
            '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    listDiv.innerHTML = html;
}
