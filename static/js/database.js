// Database Operations: Snapshots Management

var loadedSnapshots = [];
var currentGraphActionSnapshot = null;
var activeRedirects = {}; // Maps old_id -> new_id
var assessableChanges = [];

function prepareSaveVersionTab() {
    var section = document.getElementById('assessable-changes-section');
    var saveBtn = document.getElementById('btn-save-snapshot');
    
    if (!baseGraphLabel) {
        section.style.display = 'none';
        saveBtn.disabled = false;
        return;
    }

    // Fetch the base graph snapshot to compare
    // We search by label because baseGraphLabel is a label
    api.fetchSnapshots().then(function(snapshots) {
        var baseSnapshot = snapshots.find(function(s) { 
            return (s.version_label === baseGraphLabel) || ('#' + s.id === baseGraphLabel); 
        });

        if (!baseSnapshot) {
            console.warn("Base snapshot not found for comparison:", baseGraphLabel);
            section.style.display = 'none';
            saveBtn.disabled = false;
            return;
        }

        // Fetch the full snapshot details (nodes)
        api.fetchSnapshot(baseSnapshot.id).then(function(fullBaseSnapshot) {
            detectAssessableChanges(fullBaseSnapshot);
        });
    });
}

function detectAssessableChanges(baseSnapshot) {
    var baseNodes = baseSnapshot.nodes;
    assessableChanges = [];
    activeRedirects = {};

    var baseAssessableNodes = baseNodes.filter(function(n) { return n.assessable; });
    
    baseAssessableNodes.forEach(function(baseNode) {
        var currentEquivalent = draftNodes.find(function(n) { return n.local_id === baseNode.local_id; });
        
        if (!currentEquivalent) {
            // Node was removed or ID changed
            // Try to find it by title to see if it's an ID change
            var byTitle = draftNodes.find(function(n) { return n.title === baseNode.title; });
            
            if (byTitle) {
                assessableChanges.push({
                    type: 'id_change',
                    old_id: baseNode.local_id,
                    old_title: baseNode.title,
                    new_id: byTitle.local_id,
                    suggested_id: byTitle.local_id
                });
                activeRedirects[baseNode.local_id] = byTitle.local_id;
            } else {
                assessableChanges.push({
                    type: 'removed',
                    old_id: baseNode.local_id,
                    old_title: baseNode.title
                });
            }
        } else if (currentEquivalent.title !== baseNode.title) {
            // Title changed
            assessableChanges.push({
                type: 'title_change',
                old_id: baseNode.local_id,
                old_title: baseNode.title,
                new_title: currentEquivalent.title
            });
        } else if (!currentEquivalent.assessable) {
            // Assessable property toggled off
            assessableChanges.push({
                type: 'assessable_off',
                old_id: baseNode.local_id,
                old_title: baseNode.title
            });
        }
    });

    renderAssessableChanges();
}

function renderAssessableChanges() {
    var section = document.getElementById('assessable-changes-section');
    var listDiv = document.getElementById('assessable-changes-list');
    var saveBtn = document.getElementById('btn-save-snapshot');
    var overwriteToggle = document.getElementById('overwrite-toggle');
    var versionLabelInput = document.getElementById('version-label');
    
    // An overwrite is happening if the toggle is checked OR if the label manually matches the base graph
    var isOverwrite = (overwriteToggle && overwriteToggle.checked) || 
                      (versionLabelInput && baseGraphLabel && versionLabelInput.value === baseGraphLabel);

    if (assessableChanges.length === 0) {
        section.style.display = 'none';
        saveBtn.disabled = false;
        return;
    }

    section.style.display = 'block';
    
    // Add explanation about mandatory vs optional redirects
    var explanationHtml = '<div style="background: #e8f0fe; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 0.9em; color: #1a73e8; border: 1px solid #d2e3fc;">' +
        '<strong>Capability Trail Protection:</strong> ' + 
        (isOverwrite 
            ? 'Since you are <strong>overwriting</strong> the base graph, redirects are <strong>mandatory</strong> to ensure stability. Redirect targets must themselves be assessable nodes.' 
            : 'Since you are saving a <strong>new version</strong>, redirects are <strong>optional</strong> but recommended. If provided, targets must be assessable nodes.') +
        '</div>';
    
    var html = explanationHtml;

    assessableChanges.forEach(function(change, index) {
        var typeLabel = '';
        var color = '#d93025';
        var desc = '';

        if (change.type === 'id_change') {
            typeLabel = 'ID CHANGED';
            desc = 'Node "' + change.old_title + '" (#' + change.old_id + ') ID changed to #' + change.new_id;
        } else if (change.type === 'removed') {
            typeLabel = 'REMOVED';
            desc = 'Node "' + change.old_title + '" (#' + change.old_id + ') was removed.';
        } else if (change.type === 'title_change') {
            typeLabel = 'TITLE CHANGED';
            desc = 'Node #' + change.old_id + ' title changed from "' + change.old_title + '" to "' + change.new_title + '"';
        } else if (change.type === 'assessable_off') {
            typeLabel = 'ASSESSABLE OFF';
            desc = 'Node "' + change.old_title + '" (#' + change.old_id + ') is no longer assessable.';
        }

        html += '<div class="assessable-change-item">' +
            '<div class="assessable-change-header">' +
                '<span class="assessable-change-title">' + typeLabel + '</span>' +
                '<span class="assessable-change-id">#' + change.old_id + '</span>' +
            '</div>' +
            '<div style="font-size: 0.9em; margin-bottom: 10px;">' + desc + '</div>' +
            '<div class="redirect-selector">' +
                '<label style="margin-bottom: 2px;">Redirect to Node ID:</label>' +
                '<div class="redirect-option">' +
                    '<input type="number" class="redirect-input" id="redirect-' + change.old_id + '" ' +
                    'value="' + (activeRedirects[change.old_id] || '') + '" ' +
                    'oninput="updateRedirect(' + change.old_id + ', this.value)" placeholder="Enter target Node ID">' +
                    '<span id="redirect-status-' + change.old_id + '" class="redirect-status"></span>' +
                '</div>' +
            '</div>' +
        '</div>';
    });

    listDiv.innerHTML = html;
    validateAllRedirects();
}

function updateRedirect(oldId, newIdStr) {
    var newId = parseInt(newIdStr);
    if (!isNaN(newId)) {
        activeRedirects[oldId] = newId;
    } else {
        delete activeRedirects[oldId];
    }
    validateAllRedirects();
}

function validateAllRedirects() {
    var allValid = true;
    var saveBtn = document.getElementById('btn-save-snapshot');
    var overwriteToggle = document.getElementById('overwrite-toggle');
    var versionLabelInput = document.getElementById('version-label');
    
    // An overwrite is happening if the toggle is checked OR if the label manually matches the base graph
    var isOverwrite = (overwriteToggle && overwriteToggle.checked) || 
                      (versionLabelInput && baseGraphLabel && versionLabelInput.value === baseGraphLabel);

    assessableChanges.forEach(function(change) {
        var statusSpan = document.getElementById('redirect-status-' + change.old_id);
        var targetId = activeRedirects[change.old_id];
        
        // Check if targetId exists in draftNodes
        var targetNode = draftNodes.find(function(n) { return n.local_id === targetId; });

        if (targetNode) {
            // Target exists, now check if it is assessable
            if (targetNode.assessable) {
                statusSpan.innerText = '✓ Valid (Assessable)';
                statusSpan.className = 'redirect-status status-valid';
            } else {
                statusSpan.innerText = '✗ Target must be assessable';
                statusSpan.className = 'redirect-status status-invalid';
                allValid = false;
            }
        } else if (targetId === undefined || isNaN(targetId)) {
            // Field is empty
            if (isOverwrite) {
                statusSpan.innerText = '✗ Mandatory for Overwrite';
                statusSpan.className = 'redirect-status status-invalid';
                allValid = false;
            } else {
                statusSpan.innerText = '○ Optional (New Version)';
                statusSpan.className = 'redirect-status';
            }
        } else {
            // targetId is provided but does NOT exist
            statusSpan.innerText = '✗ Target ID #' + targetId + ' not found';
            statusSpan.className = 'redirect-status status-invalid';
            allValid = false;
        }
    });

    saveBtn.disabled = !allValid;
    if (!allValid) {
        saveBtn.title = isOverwrite ? 'Redirection is mandatory when overwriting.' : 'One or more redirect targets do not exist.';
        saveBtn.style.opacity = '0.5';
        saveBtn.style.cursor = 'not-allowed';
    } else {
        saveBtn.title = '';
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
    }
}

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
            assessable: n.assessable || false,
            x: n.x,
            y: n.y,
            saved_x: n.x, // Store initial DB coordinate for reset
            saved_y: n.y
        };
    });

    currentSnapshotLabel = snapshot.version_label || ('#' + snapshot.id);
    baseGraphLabel = currentSnapshotLabel; // The original graph it was based on
    localStorage.setItem('currentSnapshotLabel', currentSnapshotLabel);
    localStorage.setItem('baseGraphLabel', baseGraphLabel);
    localStorage.setItem('baseGraphCreator', snapshot.created_by || '');
    
    persistDraft();
    
    // Redirect to the workspace page
    window.location.href = '/';
}

function fetchSnapshotToWorkspace(event, snapshotId, label) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    var confirmMsg = 'STOP! This will clear your current workspace and load snapshot "' + (label || '#' + snapshotId) + '". Continue?';
    
    customConfirm(confirmMsg).then(function(userChoice) {
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
    // 1. Sync latest visual positions from Network if active
    // This ensures that drag-and-drop changes are captured even if 'renderGraph' wasn't called
    if (typeof network !== 'undefined' && network) {
        try {
            var currentPositions = network.getPositions();
            draftNodes.forEach(function(node) {
                if (currentPositions[node.local_id]) {
                    node.x = Math.round(currentPositions[node.local_id].x);
                    node.y = Math.round(currentPositions[node.local_id].y);
                }
            });
        } catch (e) {
            console.warn("Could not sync network positions before save:", e);
        }
    }

    // 2. Auto-fix removed. We only save explicit 'saved_x'/'saved_y' to the database.
    // The working coordinates (x, y) are kept in localStorage (via persistDraft below) but NOT sent to DB unless fixed.
    
    // Persist these updates to localStorage so they survive a reload
    persistDraft();

    if (draftNodes.length === 0 && draftDomains.length === 0) {
        customAlert('Cannot save an empty graph.');
        return;
    }
    var label = document.getElementById('version-label').value;
    var overwriteToggle = document.getElementById('overwrite-toggle').checked;

    var performSave = function(isOverwrite) {
        // Use saved_x/saved_y for the database, preserving working x/y in local draft
        var nodesForDb = draftNodes.map(function(n) {
             return Object.assign({}, n, {
                 x: n.saved_x,
                 y: n.saved_y
             });
        });

        var payload = {
            version_label: label || null,
            base_graph: baseGraphLabel || null,
            created_by: getCurrentUser(),
            nodes: nodesForDb,
            domains: draftDomains,
            overwrite: isOverwrite,
            redirects: activeRedirects
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
    if (!listDiv) return; // Exit if element doesn't exist on current page
    
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
    if (!listDiv) return; // Exit if element doesn't exist on current page
    
    var html = '<table><thead><tr><th>Version</th><th>Nodes</th><th>Assessable</th><th>Created By</th><th>Based On</th><th>Actions</th></tr></thead><tbody>';
    for (var i = 0; i < snapshots.length; i++) {
        var s = snapshots[i];
        var createdDate = new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        var updatedDate = new Date(s.last_updated).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        var versionLabel = s.version_label || '#' + s.id;
        
        html += '<tr>' +
            '<td style="cursor: pointer; color: #1a73e8; font-weight: 500;" onclick="openGraphActionModal(loadedSnapshots[' + i + '])">' +
                '<div class="version-badge">' + (s.version_label || 'v' + s.id) + '</div>' +
                '<div style="font-size: 0.7em; color: #9aa0a6; margin-top: 6px; line-height: 1.3;">' +
                    '<b>C:</b> ' + createdDate + '<br>' +
                    '<b>U:</b> ' + updatedDate +
                '</div>' +
            '</td>' +
            '<td>' + s.node_count + '</td>' +
            '<td>' + (s.assessable_node_count || 0) + '</td>' +
            '<td>' + (s.created_by || 'system') + '</td>' +
            '<td>' + (s.base_graph || 'None') + '</td>' +
            '<td>' +
                '<div style="display: flex; gap: 5px;">' +
                    '<button class="btn-secondary btn-small" onclick="fetchSnapshotToWorkspace(event, ' + s.id + ', \'' + versionLabel.replace(/'/g, "\\'") + '\')">Fetch to Workspace</button>' +
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
