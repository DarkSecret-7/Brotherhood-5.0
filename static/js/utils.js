// --- Authentication & UI Helpers ---

function getCurrentUser() {
    var token = localStorage.getItem('access_token');
    if (!token) return null;
    try {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        var payload = JSON.parse(jsonPayload);
        if (!payload || !payload.sub) return null;
        if (payload.exp && Date.now() >= payload.exp * 1000) return null;
        return payload.sub;
    } catch (e) {
        return null;
    }
}

function requireAuth() {
    var user = getCurrentUser();
    if (!user) {
        localStorage.removeItem('access_token');
        window.location.replace('/login');
        return false;
    }
    return true;
}

function extractIdsFromExpression(expression) {
    if (!expression) return [];
    var matches = expression.match(/\b\d+\b/g);
    if (!matches) return [];
    return matches.map(function(m) { return parseInt(m, 10); });
}

function getReachability(nodesDeps) {
    var reachability = {};

    function getAncestors(nodeId, visited) {
        if (reachability[nodeId]) return reachability[nodeId];
        if (visited.has(nodeId)) return new Set();
        visited.add(nodeId);
        var ancestors = new Set();
        var deps = nodesDeps[nodeId] || [];
        deps.forEach(function(preId) {
            ancestors.add(preId);
            var more = getAncestors(preId, new Set(visited));
            more.forEach(function(x) { ancestors.add(x); });
        });
        reachability[nodeId] = ancestors;
        return ancestors;
    }

    Object.keys(nodesDeps).forEach(function(k) {
        getAncestors(parseInt(k, 10), new Set());
    });

    return reachability;
}

function IdNode(idVal) {
    this.idVal = idVal;
}
IdNode.prototype.simplify = function() { return this; };
IdNode.prototype.toStr = function() { return String(this.idVal); };
IdNode.prototype.getAllIds = function() { return new Set([this.idVal]); };

function OpNode(op, children) {
    this.op = String(op || '').toUpperCase();
    this.children = children || [];
}
OpNode.prototype.getAllIds = function() {
    var ids = new Set();
    this.children.forEach(function(child) {
        if (!child) return;
        child.getAllIds().forEach(function(x) { ids.add(x); });
    });
    return ids;
};
OpNode.prototype.simplify = function(reachability) {
    var op = this.op;
    var newChildren = this.children.map(function(c) { return c && c.simplify ? c.simplify(reachability) : c; }).filter(Boolean);

    var flattened = [];
    newChildren.forEach(function(child) {
        if (child && child instanceof OpNode && child.op === op) {
            flattened = flattened.concat(child.children);
        } else {
            flattened.push(child);
        }
    });

    var finalChildren = [];
    for (var i = 0; i < flattened.length; i++) {
        var childI = flattened[i];
        var isRedundant = false;
        var idsI = childI.getAllIds();

        for (var j = 0; j < flattened.length; j++) {
            if (i === j) continue;
            var childJ = flattened[j];
            var idsJ = childJ.getAllIds();

            if (op === 'AND') {
                var allCovered = true;
                idsI.forEach(function(idI) {
                    var covered = false;
                    idsJ.forEach(function(idJ) {
                        var anc = reachability[idJ];
                        if (idI === idJ || (anc && anc.has(idI))) covered = true;
                    });
                    if (!covered) allCovered = false;
                });
                if (allCovered) {
                    isRedundant = true;
                    break;
                }
            } else {
                var allCoveredOr = true;
                idsJ.forEach(function(idJ) {
                    var coveredOr = false;
                    idsI.forEach(function(idI) {
                        var anc2 = reachability[idI];
                        if (idJ === idI || (anc2 && anc2.has(idJ))) coveredOr = true;
                    });
                    if (!coveredOr) allCoveredOr = false;
                });
                if (allCoveredOr) {
                    isRedundant = true;
                    break;
                }
            }
        }

        if (!isRedundant) finalChildren.push(childI);
    }

    if (!finalChildren.length) return flattened.length ? flattened[0] : null;
    if (finalChildren.length === 1) return finalChildren[0];
    return new OpNode(op, finalChildren);
};
OpNode.prototype.toStr = function() {
    var op = this.op;
    var parts = this.children.map(function(child) {
        if (!child) return '';
        var s = child.toStr();
        if (child instanceof OpNode && child.op !== op) return '(' + s + ')';
        return s;
    }).filter(function(s) { return s; });
    return parts.join(' ' + op + ' ');
};

function parsePrerequisiteExpression(expression) {
    var tokens = (expression || '').match(/\(|\)|AND|OR|,|\d+/gi) || [];
    var pos = 0;

    function parseOr() {
        var node = parseAnd();
        while (pos < tokens.length && String(tokens[pos]).toUpperCase() === 'OR') {
            pos += 1;
            var right = parseAnd();
            if (node instanceof OpNode && node.op === 'OR') {
                node.children.push(right);
            } else {
                node = new OpNode('OR', [node, right]);
            }
        }
        return node;
    }

    function parseAnd() {
        var node = parsePrimary();
        while (pos < tokens.length && (String(tokens[pos]).toUpperCase() === 'AND' || tokens[pos] === ',')) {
            pos += 1;
            var right = parsePrimary();
            if (node instanceof OpNode && node.op === 'AND') {
                node.children.push(right);
            } else {
                node = new OpNode('AND', [node, right]);
            }
        }
        return node;
    }

    function parsePrimary() {
        if (pos >= tokens.length) return null;
        var token = tokens[pos];
        if (token === '(') {
            pos += 1;
            var node = parseOr();
            if (pos < tokens.length && tokens[pos] === ')') pos += 1;
            return node;
        }
        if (/^\d+$/.test(token)) {
            pos += 1;
            return new IdNode(parseInt(token, 10));
        }
        pos += 1;
        return parsePrimary();
    }

    try {
        return parseOr();
    } catch (e) {
        return null;
    }
}

function simplifyPrerequisiteExpression(expression, reachability) {
    if (!expression) return '';
    var tree = parsePrerequisiteExpression(expression);
    if (!tree) return expression;
    var simplifiedTree = tree.simplify(reachability || {});
    if (!simplifiedTree) return '';
    return simplifiedTree.toStr();
}

function simplifyPrerequisitesInBrowser(expression, currentNodeId, contextNodes) {
    var nodesDeps = {};
    (contextNodes || []).forEach(function(node) {
        if (!node || node.local_id == null) return;
        if (currentNodeId && node.local_id === currentNodeId) return;
        nodesDeps[node.local_id] = extractIdsFromExpression(node.prerequisite || '');
    });
    var reachability = getReachability(nodesDeps);
    return simplifyPrerequisiteExpression(expression, reachability);
}

async function logout() {
    console.log('Logging out...');
    // Post backend request to invalidate token
    await handleLogout().then(() => {
        // On success, clear local storage and cookies
        localStorage.removeItem('access_token');
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=lax;";
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=strict;";
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        window.location.replace('/login');
    });
}

async function handleLogout() {
    try {
        const response = await fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Log out failed');
        return await response.json();
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
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

window.customAlert = function(msg) {
    return showDialog({ type: 'alert', title: 'Alert', message: msg });
};
window.customConfirm = function(msg) {
    return showDialog({ type: 'confirm', title: 'Confirm', message: msg });
};
window.customPrompt = function(msg, def) {
    return showDialog({ type: 'prompt', title: 'Prompt', message: msg, defaultValue: def });
};

function switchTab(tabName) {
    var tabBtn = document.getElementById('tab-' + tabName);
    var viewSection = document.getElementById('view-' + tabName);
    
    if (tabBtn && viewSection) {
        var tabs = document.querySelectorAll('.tab-btn');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
        tabBtn.classList.add('active');

        var sections = document.querySelectorAll('.view-section');
        for (var j = 0; j < sections.length; j++) sections[j].classList.remove('active');
        viewSection.classList.add('active');
    }

    if (tabName === 'workspace') {
        if (typeof refreshWorkspace === 'function') refreshWorkspace();
    }
    if (tabName === 'save') {
        if (typeof prepareSaveVersionTab === 'function') prepareSaveVersionTab();
    }
    // Use cached snapshots by default when switching tabs
    if (tabName === 'database') {
        if (typeof refreshSnapshots === 'function') refreshSnapshots(false);
    }
}
