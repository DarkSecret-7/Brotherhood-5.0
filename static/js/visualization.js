// Graph Visualization Logic using Vis.js

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
