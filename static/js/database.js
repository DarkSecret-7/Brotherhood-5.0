// Database Operations: Snapshots Management

var loadedSnapshots = [];
var currentGraphActionSnapshot = null;

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
            source_items: n.source_items,
            domain_id: n.domain_id ? snapshot.domains.find(pd => pd.id === n.domain_id).local_id : null,
            x: n.x,
            y: n.y
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
    
    // Redirect to the workspace page
    window.location.href = '/';
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
        }).catch(function(err) {
            customAlert('Error saving snapshot: ' + err.message);
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
    loadedSnapshots = snapshots;
    var listDiv = document.getElementById('snapshots-list');
    var currentUser = getCurrentUser();
    var html = '<table><thead><tr><th>Version</th><th>Nodes</th><th>Created By</th><th>Based On</th><th>Actions</th></tr></thead><tbody>';
    for (var i = 0; i < snapshots.length; i++) {
        var s = snapshots[i];
        var createdDate = new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        var updatedDate = new Date(s.last_updated).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        
        html += '<tr>' +
            '<td style="cursor: pointer; color: #1a73e8; font-weight: 500;" onclick="openGraphActionModal(loadedSnapshots[' + i + '])">' +
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
                '</div>' +
            '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    listDiv.innerHTML = html;
}

// --- Graph Management Modal ---

function openGraphActionModal(snapshot) {
    currentGraphActionSnapshot = snapshot;
    
    // Set Graph Name
    document.getElementById('graph-action-label-input').value = snapshot.version_label || ('v' + snapshot.id);
    
    // Set Info
    document.getElementById('graph-action-created').textContent = new Date(snapshot.created_at).toLocaleString();
    document.getElementById('graph-action-updated').textContent = new Date(snapshot.last_updated).toLocaleString();
    document.getElementById('graph-action-nodes').textContent = snapshot.node_count;
    
    // Set Public Toggle
    document.getElementById('graph-action-public-toggle').checked = snapshot.is_public || false;
    
    document.getElementById('import-file-input').value = '';
    
    document.getElementById('graphActionModal').style.display = 'block';
}

function saveGraphChanges() {
    if (!currentGraphActionSnapshot) return;
    
    var newLabel = document.getElementById('graph-action-label-input').value;
    var isPublic = document.getElementById('graph-action-public-toggle').checked;
    
    if (!newLabel || newLabel.trim() === "") {
        customAlert("Graph name cannot be empty");
        return;
    }
    
    var payload = {
        version_label: newLabel,
        is_public: isPublic
    };
    
    api.patchSnapshot(currentGraphActionSnapshot.id, payload)
        .then(function(updatedSnapshot) {
            if (updatedSnapshot.error || updatedSnapshot.detail) {
                customAlert("Error saving changes: " + (updatedSnapshot.detail || updatedSnapshot.error));
                return;
            }
            
            // Update local state
            currentGraphActionSnapshot = updatedSnapshot;
            
            // Refresh list
            refreshSnapshots(true);
            
            customAlert("Changes saved successfully!");
            closeGraphActionModal();
        })
        .catch(function(err) {
            customAlert("Error saving changes: " + (err.detail || err.message));
        });
}

function closeGraphActionModal() {
    document.getElementById('graphActionModal').style.display = 'none';
    currentGraphActionSnapshot = null;
}

function triggerExportGraph() {
    if (!currentGraphActionSnapshot) return;
    
    var snapshotId = currentGraphActionSnapshot.id;
    var label = currentGraphActionSnapshot.version_label || ('graph_' + snapshotId);
    
    api.exportSnapshot(snapshotId).then(function(blob) {
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = label + '.knw';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }).catch(function(err) {
        customAlert('Export failed: ' + err.message);
    });
}

function triggerImportGraph() {
    var fileInput = document.getElementById('import-file-input');
    
    if (fileInput.files.length === 0) {
        customAlert('Please select a .knw file.');
        return;
    }
    
    var file = fileInput.files[0];
    
    customConfirm('WARNING: This will completely replace the current graph with the imported file. Are you sure?').then(function(confirmed) {
        if (confirmed) {
            api.importSnapshot(file, true).then(function(res) {
                if (res.error || res.detail) {
                    customAlert('Import failed: ' + (res.detail || res.error));
                } else {
                    customAlert('Graph overwritten successfully!');
                    closeGraphActionModal();
                    refreshSnapshots(true);
                }
            }).catch(function(err) {
                customAlert('Import error: ' + err.message);
            });
        }
    });
}

function triggerDeleteGraph() {
    if (!currentGraphActionSnapshot) return;
    
    var snapshotId = currentGraphActionSnapshot.id;
    
    customConfirm('PERMANENT DELETE! Are you sure you want to remove this graph?').then(function(confirmed) {
        if (confirmed) {
            api.deleteSnapshot(snapshotId).then(function(res) {
                if (res.ok) {
                    localStorage.removeItem('cachedSnapshots');
                    refreshSnapshots(true);
                    closeGraphActionModal();
                }
                else customAlert('Error deleting snapshot');
            });
        }
    });
}

// --- Global Import Modal ---

function openGlobalImportModal() {
    document.getElementById('global-import-file').value = '';
    document.getElementById('global-import-overwrite').checked = false;
    document.getElementById('globalImportModal').style.display = 'block';
}

function closeGlobalImportModal() {
    document.getElementById('globalImportModal').style.display = 'none';
}

function submitGlobalImport() {
    var fileInput = document.getElementById('global-import-file');
    var overwrite = document.getElementById('global-import-overwrite').checked;

    if (fileInput.files.length === 0) {
        customAlert('Please select a .knw file.');
        return;
    }

    var file = fileInput.files[0];
    
    api.importSnapshot(file, overwrite).then(function(res) {
        if (res.error || res.detail) {
             if (res.detail && typeof res.detail === 'string' && res.detail.indexOf("Confirm overwrite") !== -1) {
                customConfirm(res.detail).then(function(confirmed) {
                    if (confirmed) {
                         api.importSnapshot(file, true).then(function(retryRes) {
                             if (retryRes.error || retryRes.detail) {
                                 customAlert('Import failed: ' + (retryRes.detail || retryRes.error));
                             } else {
                                 customAlert('Graph imported successfully!');
                                 closeGlobalImportModal();
                                 refreshSnapshots(true);
                             }
                         });
                    }
                });
            } else {
                customAlert('Import failed: ' + (res.detail || res.error));
            }
        } else {
            customAlert('Graph imported successfully!');
            closeGlobalImportModal();
            refreshSnapshots(true);
        }
    }).catch(function(err) {
        customAlert('Import error: ' + err.message);
    });
}
