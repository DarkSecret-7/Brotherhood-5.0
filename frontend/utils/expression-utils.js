/**
 * Expression Utilities - Handles DNF transformation and prerequisite parsing
 * Provides utilities for working with logical expressions in graph data structures
 */

class ExpressionUtils {
    /**
     * Parse prerequisite expression to extract node IDs and validate structure
     * @param {string} expression - Prerequisite expression (e.g., "(1 AND 2) OR 3")
     * @returns {Object} Parsed expression with node IDs and structure
     */
    static parsePrerequisites(expression) {
        if (!expression || typeof expression !== 'string') {
            return { nodeIds: [], structure: null, isValid: false };
        }

        // Normalize the expression - handle case insensitivity and operator variations
        const cleaned = this.normalizeExpression(expression);
        
        // Extract all node IDs (numbers) from the expression
        const nodeIds = this.extractNodeIds(cleaned);
        
        // Basic validation
        const isValid = this.validateExpression(cleaned, nodeIds);
        
        return {
            nodeIds,
            structure: cleaned,
            isValid,
            originalExpression: expression
        };
    }

    /**
     * Normalize expression by handling case insensitivity and operator variations
     * @param {string} expression - Raw expression
     * @returns {string} Normalized expression
     */
    static normalizeExpression(expression) {
        return expression
            .trim()
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/([()\[\]])/g, ' $1 ') // Add spaces around brackets/parentheses
            .replace(/(and|AND|And|aNd|&&|&)/g, ' AND ') // Various AND operators (add spaces)
            .replace(/(or|OR|Or|oR|\|\|)/g, ' OR ') // Various OR operators (add spaces)
            .replace(/,/g, ' AND ') // Comma as AND
            .replace(/\s+/g, ' ') // Clean up extra spaces
            .trim();
    }

    /**
     * Extract node IDs from expression using regex
     * @param {string} expression - Expression to parse
     * @returns {Array} Array of node IDs
     */
    static extractNodeIds(expression) {
        const matches = expression.match(/\b\d+\b/g);
        if (!matches) return [];
        
        // Convert to integers and remove duplicates while preserving order
        const uniqueIds = [];
        const seen = new Set();
        
        for (const match of matches) {
            const id = parseInt(match);
            if (!seen.has(id)) {
                seen.add(id);
                uniqueIds.push(id);
            }
        }
        
        return uniqueIds;
    }

    /**
     * Validate expression structure
     * @param {string} expression - Expression to validate (should be normalized)
     * @param {Array} nodeIds - Node IDs found in expression
     * @returns {boolean} Whether expression is valid
     */
    static validateExpression(expression, nodeIds) {
        if (!expression || nodeIds.length === 0) {
            return false;
        }

        // Check for balanced parentheses and brackets
        const parentheses = expression.match(/[()]/g) || [];
        const brackets = expression.match(/[\[\]]/g) || [];
        let parenBalance = 0;
        let bracketBalance = 0;
        
        // Check parentheses balance
        for (const char of parentheses) {
            if (char === '(') parenBalance++;
            else parenBalance--;
            if (parenBalance < 0) return false; // Unbalanced
        }
        if (parenBalance !== 0) return false; // Unbalanced
        
        // Check brackets balance
        for (const char of brackets) {
            if (char === '[') bracketBalance++;
            else bracketBalance--;
            if (bracketBalance < 0) return false; // Unbalanced
        }
        if (bracketBalance !== 0) return false; // Unbalanced

        // Check for valid operators (expression should already be normalized)
        const tokens = expression.split(/\s+/).filter(token => 
            token && !['(', ')', '[', ']', ','].includes(token)
        );

        // Basic structure validation
        let expectingOperand = true;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (expectingOperand) {
                // Should be a number or opening bracket/parenthesis
                if (token === '(' || token === '[') {
                    continue; // Skip brackets/parentheses in token-level validation
                } else if (/^\d+$/.test(token)) {
                    expectingOperand = false;
                } else {
                    return false; // Unexpected operator
                }
            } else {
                // Should be an operator or closing bracket/parenthesis
                if (token === ')' || token === ']') {
                    continue;
                } else if (['AND', 'OR'].includes(token)) {
                    expectingOperand = true;
                } else {
                    return false; // Unexpected operand
                }
            }
        }

        return true;
    }

    /**
     * Convert expression to Disjunctive Normal Form (DNF)
     * @param {string} expression - Logical expression
     * @returns {Array} Array of DNF pathways (each pathway is an array of node IDs)
     */
    static convertToDNF(expression) {
        if (!expression) return [];
        
        try {
            // This is a simplified DNF conversion
            // In a full implementation, you'd use proper logical expression parsing
            const pathways = this.extractDNFPathways(expression);
            return pathways;
        } catch (error) {
            console.warn('Failed to convert to DNF:', error);
            return [];
        }
    }

    /**
     * Extract DNF pathways from expression
     * @param {string} expression - Expression to process
     * @returns {Array} Array of pathways
     */
    static extractDNFPathways(expression) {
        const pathways = [];
        
        // Handle simple cases first
        if (!expression.includes('OR') && !expression.includes('AND')) {
            // Single node
            const nodeId = parseInt(expression.trim());
            if (!isNaN(nodeId)) {
                pathways.push([nodeId]);
            }
            return pathways;
        }

        // Split by OR to get main pathways
        const orParts = this.splitByOperator(expression, 'OR');
        
        for (const orPart of orParts) {
            const trimmedOrPart = orPart.trim();
            
            if (!trimmedOrPart) continue;
            
            // Handle AND within each OR part
            if (trimmedOrPart.includes('AND')) {
                const andParts = this.splitByOperator(trimmedOrPart, 'AND');
                const pathway = [];
                
                for (const andPart of andParts) {
                    const trimmedAndPart = andPart.trim().replace(/[()]/g, '');
                    const nodeId = parseInt(trimmedAndPart);
                    if (!isNaN(nodeId)) {
                        pathway.push(nodeId);
                    }
                }
                
                if (pathway.length > 0) {
                    pathways.push(pathway);
                }
            } else {
                // Single node in this OR part
                const nodeId = parseInt(trimmedOrPart.replace(/[()]/g, ''));
                if (!isNaN(nodeId)) {
                    pathways.push([nodeId]);
                }
            }
        }
        
        return pathways;
    }

    /**
     * Split expression by operator while respecting parentheses
     * @param {string} expression - Expression to split
     * @param {string} operator - Operator to split by ('AND' or 'OR')
     * @returns {Array} Array of parts
     */
    static splitByOperator(expression, operator) {
        const parts = [];
        let currentPart = '';
        let parenthesesDepth = 0;
        const tokens = expression.split(/\s+/);
        
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (token === '(') {
                parenthesesDepth++;
                currentPart += (currentPart ? ' ' : '') + token;
            } else if (token === ')') {
                parenthesesDepth--;
                currentPart += (currentPart ? ' ' : '') + token;
            } else if (token === operator && parenthesesDepth === 0) {
                // Split point found
                if (currentPart.trim()) {
                    parts.push(currentPart.trim());
                }
                currentPart = '';
            } else {
                currentPart += (currentPart ? ' ' : '') + token;
            }
        }
        
        if (currentPart.trim()) {
            parts.push(currentPart.trim());
        }
        
        return parts;
    }

    /**
     * Build graph edges from DNF pathways
     * @param {Array} pathways - Array of DNF pathways
     * @returns {Array} Array of edge objects
     */
    static buildEdgesFromPathways(pathways) {
        const edges = [];
        const edgeKeySet = new Set(); // To avoid duplicate edges
        
        for (const pathway of pathways) {
            if (pathway.length < 2) continue; // No edges for single-node pathways
            
            // Create edges from each prerequisite to the dependent node
            // In a pathway like [1, 2, 3], edges are 1->3 and 2->3 (3 depends on 1 and 2)
            const dependentNode = pathway[pathway.length - 1];
            const prerequisites = pathway.slice(0, -1);
            
            for (const prereqNode of prerequisites) {
                const edgeKey = `${prereqNode}-${dependentNode}`;
                if (!edgeKeySet.has(edgeKey)) {
                    edges.push({
                        from: prereqNode,
                        to: dependentNode,
                        arrows: 'to',
                        pathway: pathway.join(' AND ') // Track which pathway this edge belongs to
                    });
                    edgeKeySet.add(edgeKey);
                }
            }
        }
        
        return edges;
    }

    /**
     * Detect cycles in graph using DFS
     * @param {Array} nodes - Array of node objects
     * @param {Array} edges - Array of edge objects
     * @returns {Array} Array of cycles found
     */
    static detectCycles(nodes, edges) {
        const cycles = [];
        const visited = new Set();
        const recursionStack = new Set();
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        
        // Build adjacency list
        const adjacencyList = new Map();
        nodes.forEach(node => adjacencyList.set(node.id, []));
        edges.forEach(edge => {
            if (adjacencyList.has(edge.from)) {
                adjacencyList.get(edge.from).push(edge.to);
            }
        });
        
        // DFS cycle detection
        const dfs = (nodeId, path) => {
            if (recursionStack.has(nodeId)) {
                // Cycle detected
                const cycleStart = path.indexOf(nodeId);
                const cycle = path.slice(cycleStart);
                cycles.push(cycle);
                return;
            }
            
            if (visited.has(nodeId)) return;
            
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);
            
            const neighbors = adjacencyList.get(nodeId) || [];
            for (const neighbor of neighbors) {
                dfs(neighbor, [...path]);
            }
            
            recursionStack.delete(nodeId);
        };
        
        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                dfs(node.id, []);
            }
        });
        
        return cycles;
    }

    /**
     * Perform transitive reduction on graph edges
     * @param {Array} nodes - Array of node objects
     * @param {Array} edges - Array of edge objects
     * @returns {Array} Reduced edges
     */
    static transitiveReduction(nodes, edges) {
        const nodeIds = new Set(nodes.map(n => n.id));
        const edgeSet = new Set();
        
        // Build adjacency matrix for reachability
        const reachability = new Map();
        nodes.forEach(node => {
            reachability.set(node.id, new Set());
        });
        
        // Initialize direct edges
        edges.forEach(edge => {
            if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
                reachability.get(edge.from).add(edge.to);
            }
        });
        
        // Compute transitive closure using Floyd-Warshall
        for (const k of nodes) {
            for (const i of nodes) {
                for (const j of nodes) {
                    if (reachability.get(i.id).has(k.id) && 
                        reachability.get(k.id).has(j.id)) {
                        reachability.get(i.id).add(j.id);
                    }
                }
            }
        }
        
        // Keep only direct edges (remove transitive edges)
        const reducedEdges = [];
        edges.forEach(edge => {
            if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
                // Check if this is a direct edge (no intermediate node)
                let isDirect = true;
                const fromReachable = reachability.get(edge.from);
                
                for (const intermediate of nodes) {
                    if (intermediate.id !== edge.from && 
                        intermediate.id !== edge.to &&
                        fromReachable.has(intermediate.id) &&
                        reachability.get(intermediate.id).has(edge.to)) {
                        isDirect = false;
                        break;
                    }
                }
                
                if (isDirect) {
                    reducedEdges.push(edge);
                }
            }
        });
        
        return reducedEdges;
    }

    /**
     * Generate default positions for nodes using simple layout
     * @param {Array} nodes - Array of node objects
     * @param {Object} options - Layout options
     * @returns {Map} Map of node ID to position object
     */
    static generateDefaultPositions(nodes, options = {}) {
        const positions = new Map();
        const { 
            width = 800, 
            height = 600, 
            margin = 50,
            layout = 'hierarchical' 
        } = options;
        
        if (layout === 'hierarchical') {
            // Simple hierarchical layout based on node IDs
            const sortedNodes = [...nodes].sort((a, b) => a.id - b.id);
            const levels = this.calculateLevels(sortedNodes);
            const maxLevel = Math.max(...Object.values(levels));
            
            sortedNodes.forEach(node => {
                const level = levels[node.id];
                const nodesInLevel = sortedNodes.filter(n => levels[n.id] === level);
                const indexInLevel = nodesInLevel.indexOf(node);
                
                const x = margin + (indexInLevel + 1) * (width - 2 * margin) / (nodesInLevel.length + 1);
                const y = margin + (level + 1) * (height - 2 * margin) / (maxLevel + 2);
                
                positions.set(node.id, { x, y });
            });
        } else {
            // Simple grid layout
            const cols = Math.ceil(Math.sqrt(nodes.length));
            const rows = Math.ceil(nodes.length / cols);
            
            nodes.forEach((node, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                
                const x = margin + (col + 1) * (width - 2 * margin) / (cols + 1);
                const y = margin + (row + 1) * (height - 2 * margin) / (rows + 1);
                
                positions.set(node.id, { x, y });
            });
        }
        
        return positions;
    }

    /**
     * Calculate hierarchical levels for nodes based on prerequisites
     * @param {Array} nodes - Array of node objects
     * @returns {Object} Map of node ID to level
     */
    static calculateLevels(nodes) {
        const levels = {};
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const inDegree = new Map();
        
        // Initialize in-degrees
        nodes.forEach(node => {
            inDegree.set(node.id, 0);
            levels[node.id] = 0;
        });
        
        // Calculate in-degrees from prerequisites
        nodes.forEach(node => {
            if (node.prerequisites) {
                const parsed = this.parsePrerequisites(node.prerequisites);
                parsed.nodeIds.forEach(prereqId => {
                    if (inDegree.has(prereqId)) {
                        inDegree.set(node.id, inDegree.get(node.id) + 1);
                    }
                });
            }
        });
        
        // Topological sort to assign levels
        const queue = [];
        nodes.forEach(node => {
            if (inDegree.get(node.id) === 0) {
                queue.push(node.id);
                levels[node.id] = 0;
            }
        });
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentLevel = levels[currentId];
            
            // Find nodes that depend on current
            nodes.forEach(node => {
                if (node.prerequisites) {
                    const parsed = this.parsePrerequisites(node.prerequisites);
                    if (parsed.nodeIds.includes(currentId)) {
                        levels[node.id] = Math.max(levels[node.id], currentLevel + 1);
                        inDegree.set(node.id, inDegree.get(node.id) - 1);
                        if (inDegree.get(node.id) === 0) {
                            queue.push(node.id);
                        }
                    }
                }
            });
        }
        
        return levels;
    }

    /**
     * Build reachability map from node dependencies
     * @param {Object} nodesDeps - Node dependencies mapping
     * @returns {Object} Reachability map
     */
    static getReachability(nodesDeps) {
        const reachability = {};

        function getAncestors(nodeId, visited) {
            if (reachability[nodeId]) return reachability[nodeId];
            if (visited.has(nodeId)) return new Set();
            visited.add(nodeId);
            const ancestors = new Set();
            const deps = nodesDeps[nodeId] || [];
            deps.forEach(function(preId) {
                ancestors.add(preId);
                const more = getAncestors(preId, new Set(visited));
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

    /**
     * Parse prerequisite expression into AST (for compatibility with legacy utils)
     * @param {string} expression - Prerequisite expression (should be normalized)
     * @returns {Object|null} Parsed AST or null if invalid
     */
    static parsePrerequisiteExpression(expression) {
        if (!expression) return null;
        
        // Use normalized tokens - expression should already be normalized
        const tokens = (expression || '').match(/\(|\)|\[|\]|\bAND\b|\bOR\b|,|\d+/gi) || [];
        let pos = 0;

        function parseOr() {
            let node = parseAnd();
            while (pos < tokens.length && String(tokens[pos]).toUpperCase() === 'OR') {
                pos += 1;
                const right = parseAnd();
                if (node instanceof OpNode && node.op === 'OR') {
                    node.children.push(right);
                } else {
                    node = new OpNode('OR', [node, right]);
                }
            }
            return node;
        }

        function parseAnd() {
            let node = parsePrimary();
            while (pos < tokens.length && (String(tokens[pos]).toUpperCase() === 'AND' || tokens[pos] === ',')) {
                pos += 1;
                const right = parsePrimary();
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
            const token = tokens[pos];
            if (token === '(' || token === '[') {
                pos += 1;
                const node = parseOr();
                // Expect matching closing bracket or parenthesis
                if (pos < tokens.length && 
                    ((token === '(' && tokens[pos] === ')') || 
                     (token === '[' && tokens[pos] === ']'))) {
                    pos += 1;
                }
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

    /**
     * Simplify prerequisite expression using reachability analysis
     * @param {string} expression - Prerequisite expression
     * @param {Object} reachability - Reachability map
     * @returns {string} Simplified expression
     */
    static simplifyPrerequisiteExpression(expression, reachability) {
        if (!expression) return '';
        const normalizedExpression = this.normalizeExpression(expression);
        const tree = this.parsePrerequisiteExpression(normalizedExpression);
        if (!tree) return expression;
        const simplifiedTree = tree.simplify(reachability || {});
        if (!simplifiedTree) return expression;
        return simplifiedTree.toStr();
    }

    /**
     * Simplify prerequisites in browser context
     * @param {string} expression - Prerequisite expression
     * @param {number} currentNodeId - Current node ID (to exclude from analysis)
     * @param {Array} contextNodes - Context nodes for dependency analysis
     * @returns {string} Simplified expression
     */
    static simplifyPrerequisitesInBrowser(expression, currentNodeId, contextNodes) {
        const nodesDeps = {};
        (contextNodes || []).forEach(function(node) {
            if (!node || node.id == null) return;
            if (currentNodeId && node.id === currentNodeId) return;
            nodesDeps[node.id] = this.extractNodeIds(node.prerequisites || '');
        }.bind(this));
        
        const reachability = this.getReachability(nodesDeps);
        return this.simplifyPrerequisiteExpression(expression, reachability);
    }

    /**
     * Check if expression contains references to non-existent nodes
     * @param {string} expression - Prerequisite expression
     * @param {Array} contextNodes - Context nodes to check against
     * @returns {Object} Object with hasNonExistentNodes boolean and missingNodes array
     */
    static checkForNonExistentNodes(expression, contextNodes) {
        const nodeIds = this.extractNodeIds(expression);
        const existingNodeIds = new Set((contextNodes || []).map(node => node.id));
        const missingNodes = nodeIds.filter(id => !existingNodeIds.has(id));
        
        return {
            hasNonExistentNodes: missingNodes.length > 0,
            missingNodes: missingNodes
        };
    }

    /**
     * Validate expression and check for non-existent nodes
     * @param {string} expression - Prerequisite expression
     * @param {Array} contextNodes - Context nodes to check against
     * @returns {Object} Validation result with detailed information
     */
    static validatePrerequisitesWithNodeCheck(expression, contextNodes) {
        const basicValidation = this.parsePrerequisites(expression);
        
        if (!basicValidation.isValid) {
            return {
                isValid: false,
                error: 'Invalid expression syntax',
                nodeIds: basicValidation.nodeIds,
                hasNonExistentNodes: false,
                missingNodes: []
            };
        }
        
        const nodeCheck = this.checkForNonExistentNodes(expression, contextNodes);
        
        return {
            isValid: !nodeCheck.hasNonExistentNodes,
            error: nodeCheck.hasNonExistentNodes ? 
                `References to non-existent nodes: ${nodeCheck.missingNodes.join(', ')}` : null,
            nodeIds: basicValidation.nodeIds,
            hasNonExistentNodes: nodeCheck.hasNonExistentNodes,
            missingNodes: nodeCheck.missingNodes,
            structure: basicValidation.structure
        };
    }
}

/**
 * ID Node - represents a single node ID in prerequisite expression
 */
class IdNode {
    constructor(idVal) {
        this.idVal = idVal;
    }
    
    simplify() { return this; }
    
    toStr() { return String(this.idVal); }
    
    getAllIds() { return new Set([this.idVal]); }
}

/**
 * Operation Node - represents AND/OR operations
 */
class OpNode {
    constructor(op, children) {
        this.op = String(op || '').toUpperCase();
        this.children = children || [];
    }
    
    getAllIds() {
        const ids = new Set();
        this.children.forEach(function(child) {
            if (!child) return;
            child.getAllIds().forEach(function(x) { ids.add(x); });
        });
        return ids;
    }
    
    simplify(reachability) {
        const op = this.op;
        const newChildren = this.children.map(function(c) { 
            return c && c.simplify ? c.simplify(reachability) : c; 
        }).filter(Boolean);

        const flattened = [];
        newChildren.forEach(function(child) {
            if (child && child instanceof OpNode && child.op === op) {
                flattened = flattened.concat(child.children);
            } else {
                flattened.push(child);
            }
        });

        const finalChildren = [];
        for (let i = 0; i < flattened.length; i++) {
            const childI = flattened[i];
            let isRedundant = false;
            const idsI = childI.getAllIds();

            for (let j = 0; j < flattened.length; j++) {
                if (i === j) continue;
                const childJ = flattened[j];
                const idsJ = childJ.getAllIds();

                if (op === 'AND') {
                    let allCovered = true;
                    idsI.forEach(function(idI) {
                        let covered = false;
                        idsJ.forEach(function(idJ) {
                            const anc = reachability[idJ];
                            if (idI === idJ || (anc && anc.has(idI))) covered = true;
                        });
                        if (!covered) allCovered = false;
                    });
                    if (allCovered) {
                        isRedundant = true;
                        break;
                    }
                } else {
                    let allCoveredOr = true;
                    idsJ.forEach(function(idJ) {
                        let coveredOr = false;
                        idsI.forEach(function(idI) {
                            const anc2 = reachability[idI];
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
    }
    
    toStr() {
        const op = this.op;
        const parts = this.children.map(function(child) {
            if (!child) return '';
            const s = child.toStr();
            // For simplicity, always use parentheses in output (brackets are normalized to parentheses)
            if (child instanceof OpNode && child.op !== op) return '(' + s + ')';
            return s;
        }).filter(function(s) { return s; });
        return parts.join(' ' + op + ' ');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpressionUtils;
} else {
    window.ExpressionUtils = ExpressionUtils;
}
