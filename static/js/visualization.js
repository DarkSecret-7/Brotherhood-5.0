// Graph Visualization Logic using Vis.js

var network = null;
var edgeDataMap = {}; // Store edge metadata for interactions

function toggleGraph() {
    var visualizer = document.getElementById('graph-visualizer');
    if (visualizer.style.display === 'none') {
        visualizer.style.display = 'block';
        document.getElementById('graph-container').style.display = 'block';

    } else {
        visualizer.style.display = 'none';
    }
}

    // --- Interaction Helpers ---
    var currentDomainHulls = {}; // Stores hulls for hit-testing

    // --- Boolean Logic Parser (DNF) ---
    function parsePrereqToDNF(expression) {
        if (!expression) return [];
        // Tokenize: integers, AND, OR, (, )
        // Case-insensitive match for AND/OR
        var tokens = expression.match(/\d+|AND|OR|\(|\)/gi);
        if (!tokens) return [];
        
        var index = 0;
        
        function parseExpression() {
            var left = parseTerm();
            while (index < tokens.length && tokens[index].toUpperCase() === 'OR') {
                index++;
                var right = parseTerm();
                left = { type: 'OR', left: left, right: right };
            }
            return left;
        }
        
        function parseTerm() {
            var left = parseFactor();
            while (index < tokens.length && tokens[index].toUpperCase() === 'AND') {
                index++;
                var right = parseFactor();
                left = { type: 'AND', left: left, right: right };
            }
            return left;
        }
        
        function parseFactor() {
            if (index >= tokens.length) return { type: 'ID', value: null }; // Safety
            var token = tokens[index++];
            if (token === '(') {
                var expr = parseExpression();
                if (index < tokens.length && tokens[index] === ')') index++;
                return expr;
            }
            // If token is AND/OR unexpectedly, handle gracefully? 
            // Assume it's an ID if not paren or operator (regex guarantees this mostly)
            return { type: 'ID', value: parseInt(token) };
        }
        
        var ast = parseExpression();
        
        // Flatten to DNF: Array of Arrays (OR of ANDs)
        function toDNF(node) {
            if (!node) return [];
            if (node.type === 'ID') {
                return node.value ? [[node.value]] : [];
            }
            if (node.type === 'OR') {
                // Union of pathways
                return toDNF(node.left).concat(toDNF(node.right));
            }
            if (node.type === 'AND') {
                // Cartesian product
                var leftPaths = toDNF(node.left);
                var rightPaths = toDNF(node.right);
                var combined = [];
                if (leftPaths.length === 0) return rightPaths;
                if (rightPaths.length === 0) return leftPaths;
                
                leftPaths.forEach(function(l) {
                    rightPaths.forEach(function(r) {
                        combined.push(l.concat(r));
                    });
                });
                return combined;
            }
            return [];
        }
        
        return toDNF(ast);
    }

    function toggleGraphDomain(domainId) {
        if (typeof draftDomains === 'undefined') {
            console.error("draftDomains is undefined!");
            return;
        }
        var d = draftDomains.find(function(domain) { return String(domain.local_id) === String(domainId); });
        if (d) {
            d.collapsed = !d.collapsed;
            // Use setTimeout to ensure the click event cycle completes before destroying the network
            setTimeout(function() {
                renderGraph(draftNodes, draftDomains);
            }, 0);
        } else {
            console.warn("Domain not found for ID:", domainId);
        }
    }

    function isPointInPolygon(point, vs) {
        var x = point.x, y = point.y;
        var inside = false;
        for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            var xi = vs[i].x, yi = vs[i].y;
            var xj = vs[j].x, yj = vs[j].y;
            var intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function moveDescendants(domainId, dx, dy, allNodes, allDomains) {
        // 1. Move Child Nodes
        allNodes.forEach(function(node) {
            if (node.domain_id === domainId) {
                if (node.x !== null && node.y !== null) {
                    node.x += dx;
                    node.y += dy;
                }
            }
        });

        // 2. Move Child Domains (Recursive)
        allDomains.forEach(function(childDomain) {
            if (childDomain.parent_id === domainId) {
                // If child domain is collapsed, move its position too
                if (childDomain.collapsed) {
                    if (childDomain.last_x !== undefined) childDomain.last_x += dx;
                    if (childDomain.last_y !== undefined) childDomain.last_y += dy;
                }
                
                // Recurse for grandchildren
                moveDescendants(childDomain.local_id, dx, dy, allNodes, allDomains);
            }
        });
    }

    function renderGraph(nodes, domains) {        
        // Sync current visual positions to draftNodes BEFORE destroying network
        if (network) {
            var positions = network.getPositions();
            
            // 1. Sync Node Positions
            nodes.forEach(function(node) {
                if (positions[node.local_id]) {
                    node.x = Math.round(positions[node.local_id].x);
                    node.y = Math.round(positions[node.local_id].y);
                }
            });

            // 2. Sync Collapsed Domain Positions & Move Children
            var movedDomains = [];
            domains.forEach(function(d) {
                if (d.collapsed) {
                     var domPos = positions['domain_' + d.local_id];
                     if (domPos) {
                         // Check if domain moved from its last known position
                         if (d.last_x !== undefined && d.last_y !== undefined) {
                             var dx = Math.round(domPos.x) - d.last_x;
                             var dy = Math.round(domPos.y) - d.last_y;
                             
                             if (dx !== 0 || dy !== 0) {
                                movedDomains.push({ id: d.local_id, dx: dx, dy: dy });
                            }
                        }
                        
                        // Update last known position
                        d.last_x = Math.round(domPos.x);
                        d.last_y = Math.round(domPos.y);
                     }
                } else {
                    d.last_x = undefined;
                    d.last_y = undefined;
                }
            });
            
            // Process movements after iterating to avoid double-counting or recursion issues during iteration
            movedDomains.forEach(function(m) {
                moveDescendants(m.id, m.dx, m.dy, nodes, domains);
            });
        }

        try {
            currentDomainHulls = {}; // Reset hulls
            var container = document.getElementById('graph-container');
            if (!container) {
                console.error("Graph container not found!");
                return;
            }
    var visNodes = [];
    var visEdges = [];
    var addedEdges = new Set();
    // Build hierarchy and domain map for background rendering
    var domainMap = {};
    domains.forEach(function(d) { domainMap[d.local_id] = d; });
    
    var domainHierarchy = {};
    var nodeDomainMap = {};
    
    // Initialize hierarchy
    domains.forEach(function(d) {
        domainHierarchy[d.local_id] = {
            id: d.local_id,
            parent_id: d.parent_id,
            children_domains: [],
            children_nodes: [],
            level: 0
        };
    });

    // Populate hierarchy
    domains.forEach(function(d) {
        if (d.parent_id && domainHierarchy[d.parent_id]) {
            domainHierarchy[d.parent_id].children_domains.push(d.local_id);
        }
    });

    nodes.forEach(function(n) {
        if (n.domain_id && domainHierarchy[n.domain_id]) {
            domainHierarchy[n.domain_id].children_nodes.push(n.local_id);
            nodeDomainMap[n.local_id] = n.domain_id;
        }
    });

    // Calculate levels
    Object.keys(domainHierarchy).forEach(function(id) {
        var level = 0;
        var curr = domainHierarchy[id];
        while (curr && curr.parent_id && domainHierarchy[curr.parent_id]) {
            level++;
            curr = domainHierarchy[curr.parent_id];
        }
        domainHierarchy[id].level = level;
    });

    // --- Domain Clustering Strategy for Initial Positioning ---
    // Identify Root Domains to separate unrelated clusters
    var rootDomainIds = Object.keys(domainHierarchy).filter(function(id) {
        return !domainHierarchy[id].parent_id;
    });
    
    // Assign sectors/centers to Root Domains
    var rootCenters = {};
    var clusterRadius = 2000; // Distance from center
    var angleStep = (2 * Math.PI) / (rootDomainIds.length || 1);
    
    rootDomainIds.forEach(function(id, index) {
        var angle = index * angleStep;
        rootCenters[id] = {
            x: Math.cos(angle) * clusterRadius,
            y: Math.sin(angle) * clusterRadius
        };
    });

    // Helper to find the Root Ancestor of a domain
    function getRootAncestorId(domainId) {
        var curr = domainHierarchy[domainId];
        while (curr && curr.parent_id) {
            curr = domainHierarchy[curr.parent_id];
        }
        return curr ? curr.id : null;
    }

    function getVisibleParent(localId, isNode) {
        var currentDomainId;
        if (isNode) {
            var n = nodes.find(n => n.local_id === localId);
            if (!n) return null;
            currentDomainId = n.domain_id;
        } else {
            if (!domainMap[localId]) return null;
            currentDomainId = domainMap[localId].parent_id;
        }
        
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
            var visNode = {
                id: node.local_id,
                label: '<b>' + node.local_id + '</b>\n' + node.title,
                title: node.description || 'No description',
                shape: 'box',
                font: { multi: 'html' },
                // Use a slightly larger size for better visibility
                margin: 10
            };
            // Safely check for coordinates. If invalid, assign based on Domain Cluster
            // If saved_x/saved_y exists, use that as the primary source of truth if x/y is missing.
            
            var x = node.x;
            var y = node.y;
            
            if ((x === null || x === undefined) && (node.saved_x !== null && node.saved_x !== undefined)) {
                x = node.saved_x;
                y = node.saved_y;
                // Sync working pos
                node.x = x;
                node.y = y;
            }

            if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
                visNode.x = x;
                visNode.y = y;
            } else {
                // Determine cluster center based on Root Domain
                var cx = 0, cy = 0;
                if (node.domain_id) {
                    var rootId = getRootAncestorId(node.domain_id);
                    if (rootId && rootCenters[rootId]) {
                        cx = rootCenters[rootId].x;
                        cy = rootCenters[rootId].y;
                    }
                }
                // Assign random position near cluster center
                // Dynamic spread based on domain hierarchy level
                // Root/Parent domains (Level 0) get MORE spread to contain children.
                // Deeper domains (Higher Level) get LESS spread to keep children tight.
                var spread = 800; // Default
                if (node.domain_id && domainHierarchy[node.domain_id]) {
                    var level = domainHierarchy[node.domain_id].level;
                    // Max spread 1200 at level 0, decreasing by 200 per level, min 400
                    spread = Math.max(400, 1200 - (level * 200));
                } else if (!node.domain_id) {
                    // Nodes without domain are effectively "root"
                    spread = 1200;
                }
                
                var randX = cx + (Math.random() - 0.5) * spread; 
                var randY = cy + (Math.random() - 0.5) * spread;
                
                visNode.x = randX;
                visNode.y = randY;
                
                // PERSIST INITIAL RANDOM POSITION so it doesn't jump next refresh
                node.x = Math.round(randX);
                node.y = Math.round(randY);
            }
            visNodes.push(visNode);
        }
    });

    domains.forEach(function(d) {
        if (d.collapsed) {
            var visibleParentId = getVisibleParent(d.local_id, false);
            if (!visibleParentId) {
                var visDomain = {
                    id: 'domain_' + d.local_id,
                    label: '<b>' + (d.title || 'Untitled Domain') + '</b>\n(Domain)',
                    shape: 'folder',
                    color: '#e8f0fe',
                    font: { multi: 'html', bold: true }
                };
                
                // Assign cluster position for collapsed domains
                var cx = 0, cy = 0;
                var rootId = getRootAncestorId(d.local_id);
                if (rootId && rootCenters[rootId]) {
                    cx = rootCenters[rootId].x;
                    cy = rootCenters[rootId].y;
                }
                
                // Dynamic spread for domains too
                var level = d.level || 0; // Use the domain's own level
                // Actually, if a domain is collapsed, it acts like a node IN its parent domain.
                // So its position should be determined by its PARENT'S level.
                // But d.level is ITS level. Its parent is level - 1.
                // So spread should be based on (level - 1).
                // If it is root (level 0), parent is null, spread is max.
                var parentLevel = level > 0 ? level - 1 : 0;
                var spread = Math.max(400, 1200 - (parentLevel * 200));

                visDomain.x = cx + (Math.random() - 0.5) * spread;
                visDomain.y = cy + (Math.random() - 0.5) * spread;
                
                // Override with Centroid of Child Nodes if available
                var childNodes = nodes.filter(function(n) { return n.domain_id === d.local_id; });
                var validNodes = childNodes.filter(function(n) { 
                    return typeof n.x === 'number' && typeof n.y === 'number' && !isNaN(n.x) && !isNaN(n.y); 
                });

                if (validNodes.length > 0) {
                    var sumX = 0, sumY = 0;
                    validNodes.forEach(function(n) {
                        sumX += n.x;
                        sumY += n.y;
                    });
                    visDomain.x = sumX / validNodes.length;
                    visDomain.y = sumY / validNodes.length;
                } 
                // IF NOT, check if we have a last known position for this domain
                else if (d.last_x !== undefined && d.last_y !== undefined) {
                    visDomain.x = d.last_x;
                    visDomain.y = d.last_y;
                }
                
                // Persist this position so it doesn't jump
                d.last_x = Math.round(visDomain.x);
                d.last_y = Math.round(visDomain.y);

                visNodes.push(visDomain);
            }
        }
    });

    edgeDataMap = {}; // Reset global map

    nodes.forEach(function(node) {
        if (node.prerequisite) {
            // New logic: Parse DNF pathways
            var pathways = parsePrereqToDNF(node.prerequisite);
            
            // If parser fails or returns empty (e.g. invalid string), try fallback to simple regex
            if (!pathways || pathways.length === 0) {
                 var simpleMatches = node.prerequisite.match(/\d+/g);
                 if (simpleMatches) {
                     pathways = [simpleMatches.map(function(m) { return parseInt(m); })];
                 }
            }

            if (pathways && pathways.length > 0) {
                var visibleTarget = getVisibleParent(node.local_id, true) || node.local_id;
                
                // Select ONE pathway to be active (default to first one, index 0)
                var activeIndex = node._activePathwayIndex || 0;
                if (activeIndex >= pathways.length) activeIndex = 0;
                
                var activePathIds = new Set(pathways[activeIndex]); // IDs in the active AND chain
                
                // Collect ALL unique prerequisite IDs involved in ANY pathway
                var allPrereqIds = new Set();
                pathways.forEach(function(path) {
                    path.forEach(function(id) { allPrereqIds.add(id); });
                });
                
                allPrereqIds.forEach(function(sourceId) {
                    var sourceNode = nodes.find(n => n.local_id === sourceId);
                    if (!sourceNode) return;
                    
                    var visibleSource = getVisibleParent(sourceId, true) || sourceId;
                    
                    if (visibleSource !== visibleTarget) {
                        var edgeId = visibleSource + '->' + visibleTarget;
                        
                        if (!edgeDataMap[edgeId]) {
                            edgeDataMap[edgeId] = {
                                id: edgeId,
                                from: visibleSource,
                                to: visibleTarget,
                                dependencies: [],
                                isActive: false
                            };
                        }
                        
                        var isDepActive = activePathIds.has(sourceId);
                        
                        // Add dependency metadata for interaction
                        edgeDataMap[edgeId].dependencies.push({
                            targetNode: node, // The node WITH the prerequisite
                            sourceId: sourceId, // The ID of the prerequisite
                            isActive: isDepActive,
                            pathways: pathways,
                            currentActiveIndex: activeIndex
                        });
                        
                        // If ANY dependency on this edge is active, the edge is visually active
                        if (isDepActive) {
                            edgeDataMap[edgeId].isActive = true;
                        }
                    }
                });
            }
        }
    });

    // Convert edgeDataMap to visEdges
    Object.keys(edgeDataMap).forEach(function(key) {
        var edgeData = edgeDataMap[key];
        var color = edgeData.isActive ? '#2b7ce9' : '#87CEFA'; // Pale Blue for inactive
        var width = edgeData.isActive ? 3 : 2;
        var opacity = edgeData.isActive ? 1.0 : 0.8;
        var dashes = edgeData.isActive ? false : true; // Dashed for inactive
        
        visEdges.push({ 
            id: edgeData.id,
            from: edgeData.from, 
            to: edgeData.to, 
            arrows: 'to',
            color: { color: color, highlight: color, hover: color, opacity: opacity },
            width: width,
            dashes: dashes
        });
    });

    var data = { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) };
    var options = {
        nodes: { font: { face: 'Segoe UI' } },
        edges: { arrows: { to: { enabled: true } }, smooth: { type: 'continuous' }, color: { inherit: 'both' } },
        physics: { enabled: false },
        interaction: { hover: true, navigationButtons: true, keyboard: true }
    };

    var lastPos = null;
    var lastScale = null;
    if (network) {
        lastPos = network.getViewPosition();
        lastScale = network.getScale();
        // Disable interaction to prevent sticky drag states
        try {
            network.setOptions({ interaction: { dragNodes: false, dragView: false } });
        } catch(e) { console.warn("Could not disable interaction:", e); }
        network.destroy();
    }
    // Initialize with empty data to ensure events are registered before drawing
    network = new vis.Network(container, {}, options);
    
    // --- Context Menu for Domains ---
    function showDomainContextMenu(x, y, domainId) {
        // Remove existing context menu if any
        var existingMenu = document.getElementById('domain-context-menu');
        if (existingMenu) existingMenu.remove();

        var domain = draftDomains.find(function(d) { return String(d.local_id) === String(domainId); });
        if (!domain) {
            console.error("Domain not found for context menu:", domainId);
            return;
        }

        var menu = document.createElement('div');
        menu.id = 'domain-context-menu';
        // Ensure position is absolute so left/top works even if CSS fails to load immediately
        menu.style.position = 'absolute'; 
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Option 1: Edit Domain
        var editOption = document.createElement('div');
        editOption.innerText = 'Edit Domain';
        editOption.classList.add('domain-context-option');
        editOption.onclick = function() {
            if (typeof openEditDomainModal === 'function') {
                openEditDomainModal(parseInt(domainId));
            } else {
                console.warn("openEditDomainModal function not found");
            }
            menu.remove();
        };
        menu.appendChild(editOption);

        // Option 2: Collapse/Expand
        var toggleOption = document.createElement('div');
        toggleOption.innerText = domain.collapsed ? 'Expand Domain' : 'Collapse Domain';
        toggleOption.classList.add('domain-context-option');
        toggleOption.onclick = function() {
            toggleGraphDomain(domainId);
            menu.remove();
        };
        menu.appendChild(toggleOption);

        document.body.appendChild(menu);

        // Close menu on click outside
        function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        }
        // Use setTimeout to avoid immediate trigger by the current click event
        setTimeout(function() {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    network.on("click", function (params) {
        // 1. Check for Node Clicks (Priority over edges)
        if (params.nodes.length > 0) {
            var nodeId = params.nodes[0];
            // Check if it's a domain (starts with "domain_")
            if (typeof nodeId === 'string' && nodeId.startsWith('domain_')) {
                var domainId = nodeId.replace('domain_', '');
                // Show context menu instead of direct toggle
                var menuX = params.event.srcEvent.pageX;
                var menuY = params.event.srcEvent.pageY;
                showDomainContextMenu(menuX, menuY, domainId);
            } else {
                // It's a regular node
                if (typeof openEditModal === 'function') {
                    openEditModal(parseInt(nodeId));
                }
            }
            return;
        }

        // 2. Check for Edge Clicks (New Logic)
        if (params.edges.length > 0) {
            var edgeId = params.edges[0];
            
            var edgeData = edgeDataMap[edgeId];
            if (edgeData && edgeData.dependencies) {
                var changed = false;
                
                edgeData.dependencies.forEach(function(dep) {
                    var targetNode = dep.targetNode;
                    var sourceId = dep.sourceId;
                    var pathways = dep.pathways;
                    var currentIndex = dep.currentActiveIndex;
                    var isDepActive = dep.isActive;
                    
                    if (!pathways || pathways.length === 0) return;

                    var newIndex = -1;

                    if (!isDepActive) {
                        // 1. If inactive, find ANY pathway that uses this edge
                        for (var i = 0; i < pathways.length; i++) {
                            if (pathways[i].includes(sourceId)) {
                                newIndex = i;
                                break;
                            }
                        }
                    } else {
                        // 2. If active, cycle to NEXT pathway that uses this edge
                        for (var offset = 1; offset < pathways.length; offset++) {
                            var idx = (currentIndex + offset) % pathways.length;
                            if (pathways[idx].includes(sourceId)) {
                                newIndex = idx;
                                break;
                            }
                        }
                    }

                    if (newIndex !== -1 && newIndex !== currentIndex) {
                        targetNode._activePathwayIndex = newIndex;
                        changed = true;
                    }
                });
                
                if (changed) {
                    renderGraph(draftNodes, draftDomains);
                }
            }
            return; // Stop propagation if edge clicked
        }

        // 3. Check for Domain Hull Clicks (Backgrounds)
        var clickX = params.pointer.canvas.x;
        var clickY = params.pointer.canvas.y;
        var clickPoint = {x: clickX, y: clickY};

        // Sort domains by level DESCENDING (Deepest/Child first)
        var sortedDomains = Object.values(domainHierarchy).sort(function(a, b) {
            return b.level - a.level;
        });

        for (var i = 0; i < sortedDomains.length; i++) {
            var domain = sortedDomains[i];
            var hull = currentDomainHulls[domain.id];
            if (hull && isPointInPolygon(clickPoint, hull)) {
                // Show context menu instead of direct toggle
                var menuX = params.event.srcEvent.pageX;
                var menuY = params.event.srcEvent.pageY;
                showDomainContextMenu(menuX, menuY, domain.id);
                return; // Handle only the top-most domain
            }
        }
    });

    // --- Enhanced Domain Background Rendering ---
    // Uses 'afterDrawing' with 'destination-over' to draw backgrounds behind the graph.
    // Implements Nested Convex Hulls: Parent hulls wrap their children's expanded hulls.
    // Uses an Offscreen Canvas Buffer to render smooth, transparent, non-overlapping blobs.
    network.on("afterDrawing", function(ctx) {
        try {
            var positions = network.getPositions();
            
            if (!positions || Object.keys(positions).length === 0) {
                // Try getting explicit positions for all known nodes
                var allIds = visNodes.map(function(n) { return n.id; });
                positions = network.getPositions(allIds);
            }

            if (!positions || Object.keys(positions).length === 0) {
                return;
            }
            
            // Sort domains by level DESCENDING (Deepest/Child first)
            var sortedDomains = Object.values(domainHierarchy).sort(function(a, b) {
                return b.level - a.level;
            });

            // Calculate Max Level for dynamic expansion
            var maxLevel = 0;
            sortedDomains.forEach(function(d) {
                if (d.level > maxLevel) maxLevel = d.level;
            });
            
            ctx.save();
            // IMPORTANT: destination-over means new pixels are drawn BEHIND existing pixels.
            ctx.globalCompositeOperation = 'destination-over';
            
            // Store calculated hulls to ensure parent domains wrap child domains
            var domainHulls = {};

            sortedDomains.forEach(function(domain) {
                // Collect points from Direct Children (Nodes and Domains)
                var points = [];
                var nodeRadius = 30; // Radius for bounding box around nodes

                function addPointBox(p) {
                    points.push({x: p.x - nodeRadius, y: p.y - nodeRadius});
                    points.push({x: p.x + nodeRadius, y: p.y - nodeRadius});
                    points.push({x: p.x + nodeRadius, y: p.y + nodeRadius});
                    points.push({x: p.x - nodeRadius, y: p.y + nodeRadius});
                }

                // 1. Direct Child Nodes
                if (domain.children_nodes) {
                    domain.children_nodes.forEach(function(nodeId) {
                        var p = positions[nodeId] || positions[String(nodeId)] || positions[parseInt(nodeId)];
                        if (p) {
                            addPointBox(p);
                        }
                    });
                }

                // 2. Direct Child Domains
                if (domain.children_domains) {
                    domain.children_domains.forEach(function(childId) {
                        var childDomain = domainMap[childId];
                        if (!childDomain) return;

                        if (childDomain.collapsed) {
                            // If collapsed, it is represented as a single Node
                            var p = positions['domain_' + childId];
                            if (p) {
                                addPointBox(p);
                            }
                        } else {
                            // If expanded, it has a Hull (calculated previously because we sort by Level Descending)
                            // We wrap the ENTIRE expanded hull of the child
                            // Try multiple key formats to be safe
                            var childHull = domainHulls[childId] || domainHulls[parseInt(childId)] || domainHulls[String(childId)];
                            
                            if (childHull) {
                                points = points.concat(childHull);
                            } else {
                                // Fallback: If child has no hull (maybe empty or skipped), try getting its visible descendants
                                var visibleIds = getVisibleDescendants(childId, domainHierarchy, nodes, domainMap);
                                visibleIds.forEach(function(id) {
                                    var p = positions[id] || positions[String(id)] || positions[parseInt(id)];
                                    if (p) addPointBox(p);
                                });
                            }
                        }
                    });
                }

                if (points.length === 0) return;

                // Calculate Convex Hull
                var hullPoints = getConvexHull(points);
                
                // Expand Hull Points
                if (hullPoints.length > 0) {
                    var centroid = {x: 0, y: 0};
                    hullPoints.forEach(function(p) {
                        centroid.x += p.x;
                        centroid.y += p.y;
                    });
                    centroid.x /= hullPoints.length;
                    centroid.y /= hullPoints.length;

                    // Dynamic expansion: Parents (lower level) get MORE expansion to strictly contain children
                    // Reduced base expansion and increment as node spread is now larger
                    var expansionDistance = 20 + (maxLevel - domain.level) * 10;
                    
                    hullPoints = hullPoints.map(function(p) {
                        var dx = p.x - centroid.x;
                        var dy = p.y - centroid.y;
                        var dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist < 0.1) return p;
                        var scale = (dist + expansionDistance) / dist;
                        return {
                            x: centroid.x + dx * scale,
                            y: centroid.y + dy * scale
                        };
                    });
                    
                    // Store the expanded hull points for parent domains to use
                    domainHulls[domain.id] = hullPoints;
                    currentDomainHulls[domain.id] = hullPoints;
                }
                
                // Calculate color
                var hue = (parseInt(domain.id) * 137.508) % 360; 
                var baseAlpha = 0.15;
                var alpha = Math.min(baseAlpha + (domain.level * 0.10), 0.3);
                
                // Use the Offscreen Canvas Buffer reuse.
                if (!window._visOffscreenCanvas) {
                    window._visOffscreenCanvas = document.createElement('canvas');
                }
                var buffer = window._visOffscreenCanvas;
                var bCtx = buffer.getContext('2d');
                
                // 1. Get current transform.
                var transform = ctx.getTransform();
                
                // 2. Setup buffer (resize only if needed)
                if (buffer.width !== ctx.canvas.width || buffer.height !== ctx.canvas.height) {
                    buffer.width = ctx.canvas.width;
                    buffer.height = ctx.canvas.height;
                } else {
                    // IMPORTANT: Reset transform before clearing to ensure we clear the PHYSICAL buffer
                    bCtx.setTransform(1, 0, 0, 1, 0, 0);
                    bCtx.clearRect(0, 0, buffer.width, buffer.height);
                }
                
                // 3. Apply SAME transform to buffer
                bCtx.setTransform(transform);
                
                // 4. Draw OPAQUE shape to buffer
                bCtx.fillStyle = 'hsl(' + hue + ', 70%, 60%)'; // Opaque
                bCtx.strokeStyle = 'hsl(' + hue + ', 70%, 60%)'; // Opaque
                
                // Dynamic padding based on nestedness
                // Root domains (Level 0) get THICKER padding.
                // Deepest domains get THINNER padding.
                // Base 20 + 10 per level diff.
                var padding = 20 + (maxLevel - domain.level) * 10;
                bCtx.lineWidth = padding;
                bCtx.lineJoin = "round";
                bCtx.lineCap = "round";
                
                bCtx.beginPath();
                drawSmoothHull(bCtx, hullPoints); // Use the new smooth function
                bCtx.closePath();
                bCtx.stroke();
                bCtx.fill();
                
                // 5. Draw buffer to main canvas with globalAlpha
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Identity
                ctx.globalAlpha = alpha;
                ctx.drawImage(buffer, 0, 0);
                ctx.restore(); // Restore transform
            });
            
            ctx.restore();
        } catch (e) {
            console.warn("Error in afterDrawing:", e);
        }
    });

    // Ensure we redraw when physics stops
    network.on("stabilized", function() {
        network.redraw();
    });
    
    // And on drag end - PERSIST POSITIONS
    network.on("dragEnd", function() {
        if (!network) return;
        var positions = network.getPositions();
        
        // Update Nodes in Memory
        if (typeof draftNodes !== 'undefined' && Array.isArray(draftNodes)) {
            draftNodes.forEach(function(node) {
                if (positions[node.local_id]) {
                    node.x = Math.round(positions[node.local_id].x);
                    node.y = Math.round(positions[node.local_id].y);
                }
            });
        }
        
        // Update Domains in Memory (if collapsed) and MOVE DESCENDANTS
        if (typeof draftDomains !== 'undefined' && Array.isArray(draftDomains)) {
            draftDomains.forEach(function(d) {
                var domId = 'domain_' + d.local_id;
                if (d.collapsed && positions[domId]) {
                    var newX = Math.round(positions[domId].x);
                    var newY = Math.round(positions[domId].y);

                    // Check if domain actually moved
                    if (d.last_x !== undefined && d.last_y !== undefined) {
                        var dx = newX - d.last_x;
                        var dy = newY - d.last_y;
                        
                        if (dx !== 0 || dy !== 0) {
                            // Use draftNodes/draftDomains globals if available
                            moveDescendants(d.local_id, dx, dy, draftNodes, draftDomains);
                        }
                    }

                    // Update last known position
                    d.last_x = newX;
                    d.last_y = newY;
                }
            });
        }

        // Persist to LocalStorage (Workspace only)
        if (typeof persistDraft === 'function') {
            persistDraft();
        }

        network.redraw();
    });

    // Set data after registering events
    network.setData(data);
    
    // Restore previous view position if available
    // Moved here to ensure data is loaded before moving view
    if (lastPos && lastScale) {
        try {
            network.moveTo({
                position: lastPos,
                scale: lastScale,
                animation: false
            });
        } catch (posError) {
            console.warn("Failed to restore view position:", posError);
        }
    }

    // Force a redraw to ensure backgrounds appear immediately
    network.redraw();

    function getVisibleDescendants(domainId, hierarchy, allNodes, domainMap) {
        // console.log("getVisibleDescendants called for:", domainId); 
        var ids = [];
        var domain = hierarchy[domainId];
        if (!domain) {
            console.warn("getVisibleDescendants: Domain not found in hierarchy", domainId);
            return ids;
        }

        if (domainMap[domainId].collapsed) {
            // If the domain itself is collapsed, we don't draw a background FOR it.
            // We draw a node representing it.
            return [];
        }

        // Direct nodes
        domain.children_nodes.forEach(function(nid) {
            ids.push(nid);
        });

        // Child domains
        domain.children_domains.forEach(function(childDid) {
            if (domainMap[childDid] && domainMap[childDid].collapsed) {
                ids.push('domain_' + childDid);
            } else {
                ids = ids.concat(getVisibleDescendants(childDid, hierarchy, allNodes, domainMap));
            }
        });
        
        // console.log("getVisibleDescendants result for", domainId, ids);
        return ids;
    }

    // Monotone Chain Convex Hull Algorithm
    function getConvexHull(points) {
        if (points.length < 3) return points;
        
        // Sort by x, then y
        var sorted = points.slice().sort(function(a, b) {
            return a.x - b.x || a.y - b.y;
        });

        var cross = function(o, a, b) {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        };

        var lower = [];
        for (var i = 0; i < sorted.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
                lower.pop();
            }
            lower.push(sorted[i]);
        }

        var upper = [];
        for (var i = sorted.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
                upper.pop();
            }
            upper.push(sorted[i]);
        }

        upper.pop();
        lower.pop();
        return lower.concat(upper);
    }

    // Draw hull (smooth with Quadratic Bezier)
    function drawSmoothHull(ctx, points) {
        if (points.length < 1) return;
        
        // 1 point: Circle (handled by lineCap/Join with zero length line or just arc)
        if (points.length === 1) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[0].x, points[0].y);
            return;
        }
        
        // 2 points: Line (Pill shape)
        if (points.length === 2) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            return;
        }

        // 3+ points: Quadratic Bezier Curve loop
        // Start at the midpoint between the last and first point
        var len = points.length;
        var pLast = points[len - 1];
        var pFirst = points[0];
        var midX = (pLast.x + pFirst.x) / 2;
        var midY = (pLast.y + pFirst.y) / 2;

        ctx.moveTo(midX, midY);

        for (var i = 0; i < len; i++) {
            var p = points[i]; // Control point
            var nextP = points[(i + 1) % len];
            
            // Destination is the midpoint between current and next
            var nextMidX = (p.x + nextP.x) / 2;
            var nextMidY = (p.y + nextP.y) / 2;
            
            ctx.quadraticCurveTo(p.x, p.y, nextMidX, nextMidY);
        }
    }

    } catch (e) {
        console.error("Critical error in renderGraph:", e);
    }
}

function refreshGraph() {
    renderGraph(draftNodes, draftDomains);
}

function fixPositions() {
    if (!network) return;
    var positions = network.getPositions();
    
    var updatedCount = 0;
    
    // 1. Update Visible Nodes
    draftNodes.forEach(function(node) {
        // network.getPositions() returns object with keys as IDs
        // Our node IDs in vis.js are just the local_id (integer)
        if (positions[node.local_id]) {
            node.x = Math.round(positions[node.local_id].x);
            node.y = Math.round(positions[node.local_id].y);
            // Also update the "saved" positions, so Reset Layout restores to this new fixed state
            node.saved_x = node.x;
            node.saved_y = node.y;
            updatedCount++;
        }
    });

    // 2. Handle Collapsed Domains (Nodes hidden inside)
    draftDomains.forEach(function(d) {
        if (d.collapsed) {
            var domainPos = positions['domain_' + d.local_id];
            if (domainPos) {
                var childNodes = draftNodes.filter(function(n) { return n.domain_id === d.local_id; });
                
                if (childNodes.length > 0) {
                    // Check if children ALREADY have saved positions relative to each other?
                    // If they have explicit X/Y, we should just shift them to match the new domain center.
                    // If they have NO X/Y (newly added), then we randomize.
                    
                    // Calculate current centroid of child nodes (if they have positions)
                    var currentSumX = 0;
                    var currentSumY = 0;
                    var countWithPos = 0;
                    
                    childNodes.forEach(function(n) {
                        if (n.x !== null && n.y !== null) {
                            currentSumX += n.x;
                            currentSumY += n.y;
                            countWithPos++;
                        }
                    });
                    
                    if (countWithPos === childNodes.length) {
                        // All have positions. Just shift them to center on the domainPos.
                        var currentCenterX = currentSumX / countWithPos;
                        var currentCenterY = currentSumY / countWithPos;
                        
                        var dx = domainPos.x - currentCenterX;
                        var dy = domainPos.y - currentCenterY;
                        
                        childNodes.forEach(function(n) {
                            n.x = Math.round(n.x + dx);
                            n.y = Math.round(n.y + dy);
                            n.saved_x = n.x;
                            n.saved_y = n.y;
                            updatedCount++;
                        });
                        
                    } else {
                        // Some missing positions (or all). Fallback to randomization strategy.
                        var spread = 300; // Reasonable spread around domain
                        var sumX = 0;
                        var sumY = 0;
                        
                        // Randomize all EXCEPT the last one
                        for (var i = 0; i < childNodes.length - 1; i++) {
                            var n = childNodes[i];
                            // Only randomize if missing position? Or force re-layout?
                            // User says: "they should not get ranodmised at every refresh"
                            // So if they have pos, keep it (relative). If not, random.
                            
                            if (n.x === null || n.y === null) {
                                var offsetX = (Math.random() - 0.5) * spread;
                                var offsetY = (Math.random() - 0.5) * spread;
                                n.x = Math.round(domainPos.x + offsetX);
                                n.y = Math.round(domainPos.y + offsetY);
                            } 
                            // If it has pos, we'll adjust it in the final shift step if needed, 
                            // but here we are mixing random and fixed.
                            // Simplest: If ANY missing, just randomize ALL to be safe? 
                            // No, user wants persistence.
                            
                            // Let's just do the random strategy for NOW if we are in this block,
                            // BUT... if we already have saved_x/saved_y, we should use that?
                            // This block runs when we click FIX POSITIONS.
                            // So we are defining NEW positions.
                            
                            // If they are hidden, they are not in 'positions' object.
                            // So we must infer their position from the domain.
                            
                            // Correct Logic:
                            // If nodes have saved_x/saved_y, preserve their relative layout and just move centroid.
                            // If nodes DO NOT have saved_x/saved_y, randomize them around domain.
                            
                             if (n.saved_x !== undefined && n.saved_y !== undefined && n.saved_x !== null) {
                                 // Has saved pos. Use it temporarily, will shift later.
                                 n.x = n.saved_x;
                                 n.y = n.saved_y;
                             } else {
                                 // No saved pos. Randomize.
                                 var offsetX = (Math.random() - 0.5) * spread;
                                 var offsetY = (Math.random() - 0.5) * spread;
                                 n.x = Math.round(domainPos.x + offsetX);
                                 n.y = Math.round(domainPos.y + offsetY);
                             }

                            sumX += n.x;
                            sumY += n.y;
                        }
                        
                        // Handle last node
                        var lastNode = childNodes[childNodes.length - 1];
                         if (lastNode.saved_x !== undefined && lastNode.saved_y !== undefined && lastNode.saved_x !== null) {
                             lastNode.x = lastNode.saved_x;
                             lastNode.y = lastNode.saved_y;
                         } else {
                             // Temporary random for calculation
                             var offsetX = (Math.random() - 0.5) * spread;
                             var offsetY = (Math.random() - 0.5) * spread;
                             lastNode.x = Math.round(domainPos.x + offsetX);
                             lastNode.y = Math.round(domainPos.y + offsetY);
                         }
                         sumX += lastNode.x;
                         sumY += lastNode.y;

                        // Now calculate centroid of this new configuration
                        var centerX = sumX / childNodes.length;
                        var centerY = sumY / childNodes.length;
                        
                        // Shift all to match domainPos
                        var shiftX = domainPos.x - centerX;
                        var shiftY = domainPos.y - centerY;
                        
                        childNodes.forEach(function(n) {
                            n.x = Math.round(n.x + shiftX);
                            n.y = Math.round(n.y + shiftY);
                            n.saved_x = n.x;
                            n.saved_y = n.y;
                            updatedCount++;
                        });
                    }
                }
            }
        }
    });
    
    console.log('Fixed positions for ' + updatedCount + ' nodes.');
    persistDraft(); // Auto-save to local storage
    customAlert('Positions recorded! Please save the snapshot to persist these coordinates.');
}

function randomisePositions() {
    customConfirm('Randomize all node positions? This will clear current layout.').then(function(confirmed) {
        if (confirmed) {
            
            // 1. Destroy network FIRST to stop any event listeners or syncing
            if (network) {
                network.destroy();
                network = null;
            }

            draftNodes.forEach(function(node) {
                // Randomize positions explicitly to override saved positions
                node.x = Math.round((Math.random() - 0.5) * 4000);
                node.y = Math.round((Math.random() - 0.5) * 4000);
                // Clear saved positions so this random layout is treated as 'unsaved'
                node.saved_x = null;
                node.saved_y = null;
            });
            
            // Persist the "cleared" state to local storage
            persistDraft();
            
            refreshGraph();
        }
    });
}

function restoreSavedPositions() {
    customConfirm('Reset to last saved database positions? Unsaved layout changes will be lost.').then(function(confirmed) {
        if (confirmed) {
            
            // 1. Destroy network FIRST to stop any event listeners or syncing
            if (network) {
                network.destroy();
                network = null;
            }

            var restoredCount = 0;
            draftNodes.forEach(function(node) {
                if (node.saved_x !== undefined && node.saved_y !== undefined && node.saved_x !== null && node.saved_y !== null) {
                    node.x = node.saved_x;
                    node.y = node.saved_y;
                    restoredCount++;
                } else {
                    // If no saved pos, randomize (null)
                    node.x = null; 
                    node.y = null;
                }
            });
            console.log("Restored positions for " + restoredCount + " nodes.");
            
            // 2. Persist to localStorage so the refresh picks up the new 'draftNodes' state
            //    Otherwise, if we refresh page, it might revert? 
            //    Actually, refreshGraph uses global 'draftNodes'.
            //    But if we don't persist, a reload would lose this reset.
            //    Let's NOT persist automatically, let user decide to save?
            //    Wait, "Reset Layout" usually means "Put it back to how it was".
            //    If we don't save to draft, the next action might revert it if it pulls from LS?
            //    Actually, globals.js loads from LS on page load. 
            //    If we modify draftNodes in memory, refreshGraph works.
            //    But let's persist to be safe so it sticks.
            persistDraft();

            refreshGraph();
        }
    });
}
