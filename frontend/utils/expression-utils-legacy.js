/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project Developers
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Expression Utilities - Handles DNF transformation and prerequisite parsing
 * Provides utilities for working with logical expressions in graph data structures
 */

class ExpressionUtils {
    /**
     * Extract node IDs from prerequisite expression
     * @param {string} prerequisites - Prerequisite expression
     * @returns {Array} Array of node IDs
     */
    static extractNodeIdsFromPrerequisites(prerequisites) {
        if (!prerequisites) {
            return [];
        }
        const parsed = this.parsePrerequisites(prerequisites);
        return parsed.isValid ? parsed.nodeIds : [];
    }

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
        if (!expression || expression.trim() === '') return [];

        try {
            // Parse string to tree, then extract pathways from tree
            // This ensures consistent handling between backend (tree) and frontend (string)
            const tree = this.parsePrerequisiteToTree(expression);
            if (!tree) return [];
            return this.extractPathwaysFromTreeAST(tree);
        } catch (error) {
            console.warn('Failed to convert to DNF:', error);
            return [];
        }
    }

    /**
     * Extract DNF pathways directly from a tree structure (backend format)
     * Works with tree structures like: {node: 1}, {and: [{node: 1}, {node: 2}]}, {or: [...]}
     * @param {Object} tree - Tree structure from backend (JSONB)
     * @returns {Array} Array of pathways (each pathway is array of node IDs)
     */
    static extractPathwaysFromTree(tree) {
        if (!tree) return [];

        // Leaf node: {node: id}
        if (tree.node !== undefined) {
            return [[tree.node]];
        }

        // AND operation: {and: [left, right]}
        if (tree.and && Array.isArray(tree.and)) {
            // Start with single empty pathway
            let combinedPathways = [[]];

            for (const part of tree.and) {
                const partPathways = this.extractPathwaysFromTree(part);
                // Cartesian product: combine each existing pathway with each part pathway
                const newPathways = [];
                for (const existingPath of combinedPathways) {
                    for (const partPath of partPathways) {
                        newPathways.push([...existingPath, ...partPath]);
                    }
                }
                combinedPathways = newPathways;
            }
            return combinedPathways;
        }

        // OR operation: {or: [left, right]}
        if (tree.or && Array.isArray(tree.or)) {
            const allPathways = [];
            for (const part of tree.or) {
                const partPathways = this.extractPathwaysFromTree(part);
                allPathways.push(...partPathways);
            }
            return allPathways;
        }

        return [];
    }

    static extractPathwaysFromTreeAST(tree) {
        if (!tree) return [];
        // Auto-detect AST
        if (tree instanceof IdNode) return [[tree.idVal]];
        if (tree instanceof OpNode) {
            if (tree.op === 'AND') {
                let combined = [[]];
                for (const child of tree.children) {
                    const childPaths = this.extractPathwaysFromTreeAST(child);
                    const newCombined = [];
                    for (const existing of combined) {
                        for (const part of childPaths) {
                            newCombined.push([...existing, ...part]);
                        }
                    }
                    combined = newCombined;
                }
                return combined;
            } else if (tree.op === 'OR') {
                const all = [];
                for (const child of tree.children) {
                    all.push(...this.extractPathwaysFromTreeAST(child));
                }
                return all;
            }
        }
    }

    /**
     * Convert DNF pathways to logical expression in CNF format
     * @param {Array} pathways - Array of DNF pathways (each pathway is an array of node IDs)
     * @returns {string} Logical CNF expression string
     */
    static convertPathwaysToExpression(pathways) {
        /**
         * Helper function that recursively computes all minimal hitting sets of a collection of sets.
         * Each set is an array of node IDs. Returns an array of arrays (minimal hitting sets).
         */
        function minimalHittingSets(sets) {
            // Base case: no sets left → empty hitting set
            if (sets.length === 0) return [[]];

            // Sort by length to branch on the smallest set first (efficiency)
            const sorted = [...sets].sort((a, b) => a.length - b.length);
            const first = sorted[0];
            const rest = sorted.slice(1);

            const results = [];

            for (const elem of first) {
                // Keep only pathways that are NOT already hit by 'elem'
                const remaining = rest.filter(s => !s.includes(elem));
                const subResults = minimalHittingSets(remaining);

                for (const sub of subResults) {
                results.push([...sub, elem]);
                }
            }

            // Remove duplicates and non‑minimal sets
            const unique = [];
            for (const hs of results) {
                // Sort for a canonical representation
                const sortedHs = [...hs].sort();

                // Check if this exact set already exists
                const isDuplicate = unique.some(u =>
                u.length === sortedHs.length && u.every((v, i) => v === sortedHs[i])
                );
                if (isDuplicate) continue;

                // Check if there exists a strict subset that is also a hitting set
                const hasStrictSubset = results.some(other => {
                if (other === hs) return false; // skip itself
                const sortedOther = [...other].sort();
                // strict subset: shorter and every element is in hs
                return sortedOther.length < sortedHs.length &&
                        sortedOther.every(v => sortedHs.includes(v));
                });

                if (!hasStrictSubset) {
                unique.push(sortedHs);
                }
            }

            return unique;
        }

        // Edge cases
        if (pathways.length === 0) return "";
        if (pathways.some(p => p.length === 0)) return "";

        // Remove duplicates and empty sets, prepare for the hitting‑set algorithm
        const uniqueSets = [];
        const seen = new Set();
        for (const p of pathways) {
            if (p.length === 0) continue;
            const key = [...p].sort().join('|');
            if (!seen.has(key)) {
            seen.add(key);
            uniqueSets.push([...p]);
            }
        }

        // If after cleaning there are no sets, the formula is True (empty disjunction)
        if (uniqueSets.length === 0) return "";

        const hittingSets = minimalHittingSets(uniqueSets);

        // If any hitting set is empty, the CNF has no clauses → always True
        if (hittingSets.some(hs => hs.length === 0)) return "";

        // Build the CNF string
        const clauses = hittingSets.map(hs => {
            const sorted = [...hs].sort();
            return `(${sorted.join(" OR ")})`;
        });
        
        return clauses.join(" AND ");
    }

    /**
     * Extract node IDs from a tree structure
     * @param {Object} tree - Tree structure from backend
     * @returns {Set} Set of node IDs
     */
    static extractNodeIdsFromTree(tree) {
        const ids = new Set();
        if (!tree) return ids;

        if (tree.node !== undefined) {
            ids.add(tree.node);
        }

        if (tree.and && Array.isArray(tree.and)) {
            for (const part of tree.and) {
                const partIds = this.extractNodeIdsFromTree(part);
                partIds.forEach(id => ids.add(id));
            }
        }

        if (tree.or && Array.isArray(tree.or)) {
            for (const part of tree.or) {
                const partIds = this.extractNodeIdsFromTree(part);
                partIds.forEach(id => ids.add(id));
            }
        }

        return ids;
    }

    /**
     * Split expression by operator while respecting parentheses
     * @param {string} expression - Expression to parse
     * @param {string} operator - Operator to split by
     * @returns {Array} Parts of the expression
     */
    static splitByOperator(expression, operator) {
        const parts = [];
        let current = '';
        let depth = 0;

        const tokens = expression.split(/\s+/);

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            // Track parentheses depth BEFORE processing the token
            // This handles cases where parentheses are attached to tokens like "(1" or "2)"
            let tokenDepthChange = 0;
            for (const char of token) {
                if (char === '(') tokenDepthChange++;
                else if (char === ')') tokenDepthChange--;
            }

            // Check if this token is the operator at top level (depth === 0 before any changes)
            // The operator must be a standalone token (not part of a larger token with parens)
            if (token === operator && depth === 0 && tokenDepthChange === 0) {
                // Found operator at top level - split here
                if (current.trim()) {
                    parts.push(current.trim());
                }
                current = '';
            } else {
                current += (current ? ' ' : '') + token;
            }

            // Update depth after processing
            depth += tokenDepthChange;
        }

        if (current.trim()) {
            parts.push(current.trim());
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
     * Get set of all prerequisite node IDs for a node
     * @param {Object} node - Node object
     * @returns {Set} Set of prerequisite node IDs
     */
    static getPrerequisiteSet(node) {
        const prereqs = new Set();
        if (node.prerequisites) {
            const parsed = this.parsePrerequisites(node.prerequisites);
            parsed.nodeIds.forEach(id => prereqs.add(id));
        }
        return prereqs;
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
     * Build a robust reachability map from node pathways generated from the graphstate
     * @param {Object} nodePathways - Node ID to array of DNF pathways
     * @returns {Object} - Reachability map
     */
    static getReachabilityFromPathways(nodePathways) {
        const reachability = {};

        // For each node, compute the intersection of all its pathways.
        // Any ID that appears in every pathway is implied by the node.
        for (const [nodeId, pathways] of Object.entries(nodePathways)) {
            if (!pathways || pathways.length === 0) {
                reachability[nodeId] = new Set();
                continue;
            }
            // Start with the first pathway as the set of candidates
            let implied = new Set(pathways[0]);
            for (let i = 1; i < pathways.length; i++) {
                const currentSet = new Set(pathways[i]);
                implied = new Set([...implied].filter(id => currentSet.has(id)));
                if (implied.size === 0) break;
            }
            reachability[nodeId] = implied;
        }

        // Compute transitive closure: if A implies B and B implies C, then A implies C.
        let changed = true;
        while (changed) {
            changed = false;
            for (const [nodeId, impliedSet] of Object.entries(reachability)) {
                const additional = new Set();
                for (const impliedId of impliedSet) {
                    if (reachability[impliedId]) {
                        for (const id of reachability[impliedId]) {
                            if (!impliedSet.has(id)) {
                                additional.add(id);
                            }
                        }
                    }
                }
                if (additional.size > 0) {
                    additional.forEach(id => impliedSet.add(id));
                    changed = true;
                }
            }
        }

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

    static simplifyPrerequisiteExpression(expression, reachability, nodePathways) {
        if (!expression) return '';

        let processedExpr = expression;

        // Step 1: Expand disjunctive nodes (nodes with multiple pathways)
        if (nodePathways) {
            for (const [id, pathways] of Object.entries(nodePathways)) {
                if (pathways.length > 1) {
                    const orParts = pathways.map(p => 
                        p.length === 1 ? String(p[0]) : '(' + p.join(' AND ') + ')'
                    );
                    const replacement = orParts.join(' OR ');
                    processedExpr = processedExpr.replace(
                        new RegExp('\\b' + id + '\\b', 'g'), 
                        '(' + replacement + ')'
                    );
                }
            }
        }

        // Step 2: Build reachability from conjunctive nodes only
        let reach = reachability;
        if (nodePathways && !reach) {
            const conjunctive = {};
            for (const [id, paths] of Object.entries(nodePathways)) {
                if (paths.length === 1) {
                    conjunctive[id] = paths;
                }
            }
            reach = this.getReachabilityFromPathways(conjunctive);
        }

        // Step 3: Parse, simplify, return
        const normalized = this.normalizeExpression(processedExpr);
        const tree = this.parsePrerequisiteExpression(normalized);
        if (!tree) return expression;
        const simplified = tree.simplify(reach || {});
        if (!simplified) return expression;
        return simplified.toStr() || expression;
    }
    
    /**
     * Simplify expression using full DNF expansion with pathway definitions.
     * @param {string} expression - The expression to simplify.
     * @param {Object} nodePathways - Map nodeId -> array of pathways (each pathway is array of IDs).
     * @returns {string} Simplified expression.
     */
    static simplifyWithDNF(expression, nodePathways) {
        if (!expression) return '';
        // 1. Convert expression to DNF (list of pathways)
        const tree = this.parsePrerequisiteExpression(this.normalizeExpression(expression));
        if (!tree) return expression;
        let pathways = this.extractPathwaysFromTreeAST(tree); // need AST-aware version

        // 2. Expand each pathway: for any ID that has pathways, replace it with all its alternatives
        //    This is like substituting definitions.
        const expanded = [];
        for (const path of pathways) {
            let current = [path];
            for (let i = 0; i < current.length; i++) {
                const p = current[i];
                // Find first ID in p that has a definition
                let found = false;
                for (let j = 0; j < p.length; j++) {
                    const id = p[j];
                    if (nodePathways[id] && nodePathways[id].length > 0) {
                        // Replace this ID with its pathways (each as a conjunction)
                        const defs = nodePathways[id];
                        const newPaths = [];
                        for (const def of defs) {
                            // combine p without id with def
                            const combined = [...p.slice(0, j), ...def, ...p.slice(j+1)];
                            newPaths.push(combined);
                        }
                        // Replace current p with newPaths
                        current.splice(i, 1, ...newPaths);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    // No more expandable IDs in this path
                    expanded.push(p);
                }
            }
        }

        // 3. Simplify each pathway: remove duplicates and apply reachability (intersection)
        //    For each pathway, remove any ID that is implied by another in the same pathway.
        const simplifiedPaths = expanded.map(path => {
            const unique = [...new Set(path)];
            const result = [];
            for (let i = 0; i < unique.length; i++) {
                const idI = unique[i];
                let redundant = false;
                for (let j = 0; j < unique.length; j++) {
                    if (i === j) continue;
                    const idJ = unique[j];
                    // If idJ implies idI (according to reachability), idI is redundant.
                    // We need reachability from expanded paths? Actually we can compute on the fly.
                    // For simplicity, we just remove duplicates and rely on later step.
                    // We'll use a simple rule: if idJ === idI, skip (already handled).
                }
                result.push(idI);
            }
            return result;
        });

        // 4. Remove redundant pathways (if one implies another)
        const minimal = [];
        for (let i = 0; i < simplifiedPaths.length; i++) {
            const p = simplifiedPaths[i];
            let redundant = false;
            for (let j = 0; j < simplifiedPaths.length; j++) {
                if (i === j) continue;
                const q = simplifiedPaths[j];
                // Check if q is a subset of p (since each pathway is a conjunction)
                // If q is a subset of p, then q implies p, so p is redundant in OR.
                // (Actually in OR, if q ⇒ p, then q∨p = p, so p is redundant? Wait: if q ⇒ p, then q∨p = p, so q is redundant, not p.
                // So if q implies p, we keep p, remove q.
                // We'll remove any p that is a superset of another q.
                if (q.every(id => p.includes(id)) && p.length > q.length) {
                    redundant = true;
                    break;
                }
            }
            if (!redundant) minimal.push(p);
        }

        // 5. Convert minimal DNF back to string
        if (minimal.length === 0) return '';
        if (minimal.length === 1) {
            const p = minimal[0];
            return p.length === 1 ? String(p[0]) : p.join(' AND ');
        }
        return minimal.map(p => {
            if (p.length === 1) return String(p[0]);
            return '(' + p.join(' AND ') + ')';
        }).join(' OR ');
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
     * Simplify prerequisites using node pathways
     * @param {string} expression - Prerequisite expression
     * @param {number} currentNodeId - Current node ID (to exclude from analysis)
     * @param {Object} nodePathways - Node ID to array of DNF pathways
     * @returns {string} Simplified expression
     */
    static simplifyPrerequisitesWithPathways(expression, currentNodeId, nodePathways) {
        if (!expression) return '';
        // Convert nodePathways object in the correct shape first
        const mappedPathways = dict(nodePathways.map(node => [node.id, node.pathways]));
        // Exclude the current node's own pathways (to avoid self‑dependencies)
        const filteredPathways = { ...mappedPathways };
        if (currentNodeId !== undefined && filteredPathways[currentNodeId]) {
            delete filteredPathways[currentNodeId];
        }
        const reachability = this.getReachabilityFromPathways(filteredPathways);
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

    /**
     * Parse prerequisite string into tree structure with logic gates
     * @param {string} expression - Prerequisite expression (e.g., "1 AND 2")
     * @returns {Object|null} Tree structure with logic gates
     */
    static parsePrerequisiteToTree(expression) {
        if (!expression || expression.trim() === '') return null;
        
        const cleaned = this.normalizeExpression(expression);
        
        // Check if it's a simple node ID (just a number)
        if (/^\d+$/.test(cleaned)) {
            return { node: parseInt(cleaned) };
        }
        
        // Parse complex expressions
        return this.parseExpressionToTree(cleaned);
    }

    /**
     * Parse expression recursively into tree structure
     * @param {string} expression - Expression to parse
     * @returns {Object} Tree structure
     */
    static parseExpressionToTree(expression) {
        expression = expression.trim();
        
        // Handle parentheses
        if (expression.startsWith('(') && expression.endsWith(')')) {
            const inner = expression.slice(1, -1).trim();
            if (this.isParenthesesBalanced(inner)) {
                return this.parseExpressionToTree(inner);
            }
        }
        
        // Split by OR (lowest precedence)
        const orParts = this.splitByOperator(expression, 'OR');
        if (orParts.length > 1) {
            return {
                or: orParts.map(part => this.parseExpressionToTree(part))
            };
        }
        
        // Split by AND (higher precedence)
        const andParts = this.splitByOperator(expression, 'AND');
        if (andParts.length > 1) {
            return {
                and: andParts.map(part => this.parseExpressionToTree(part))
            };
        }
        
        // Base case: single node ID
        if (/^\d+$/.test(expression)) {
            return { node: parseInt(expression) };
        }
        
        // Fallback: return as-is if can't parse
        return { expression: expression };
    }

    /**
     * Check if parentheses are balanced
     * @param {string} expression - Expression to check
     * @returns {boolean} Whether parentheses are balanced
     */
    static isParenthesesBalanced(expression) {
        let depth = 0;
        for (const char of expression) {
            if (char === '(') depth++;
            if (char === ')') depth--;
            if (depth < 0) return false;
        }
        return depth === 0;
    }

    /**
     * Convert tree structure back to prerequisite string
     * @param {Object} tree - Tree structure
     * @param {string} parentOp - Parent operator (for parentheses handling)
     * @returns {string} Prerequisite expression string
     */
    static treeToPrerequisiteString(tree, parentOp = null) {
        if (!tree) return '';

        if (tree.node !== undefined) {
            return String(tree.node);
        }

        if (tree.expression) {
            return tree.expression;
        }

        if (tree.and && Array.isArray(tree.and)) {
            const parts = tree.and.map(part => this.treeToPrerequisiteString(part, 'and'));
            const result = parts.join(' AND ');
            // Wrap in parens if parent is OR (different operator needs parens)
            return parentOp === 'or' ? `(${result})` : result;
        }

        if (tree.or && Array.isArray(tree.or)) {
            const parts = tree.or.map(part => this.treeToPrerequisiteString(part, 'or'));
            const result = parts.join(' OR ');
            // Wrap in parens if parent is AND (different operator needs parens)
            return parentOp === 'and' ? `(${result})` : result;
        }

        return '';
    }
}

// The new classes for arbitrary ASTs
class IdNode {
    constructor(idVal) {
        this.idVal = idVal;
    }

    // Recursively simplify – already a leaf
    simplify() { return this; }

    toStr() { return String(this.idVal); }

    // Keep for other uses
    getAllIds() { return new Set([this.idVal]); }

    /**
     * Does this node logically imply 'other' under the given reachability?
     * reachability: map nodeId -> Set of ancestor nodeIds (dependencies).
     */
    implies(other, reachability) {
        if (other instanceof IdNode) {
            // same ID, or this depends on other
            return this.idVal === other.idVal ||
                   (reachability[this.idVal] && reachability[this.idVal].has(other.idVal));
        }
        if (other instanceof OpNode) {
            if (other.op === 'AND') {
                // this implies AND if it implies every child
                return other.children.every(child => this.implies(child, reachability));
            }
            if (other.op === 'OR') {
                // this implies OR if it implies at least one child
                return other.children.some(child => this.implies(child, reachability));
            }
        }
        return false;
    }
}

class OpNode {
    constructor(op, children) {
        this.op = String(op || '').toUpperCase();
        this.children = children || [];
    }

    getAllIds() {
        const ids = new Set();
        this.children.forEach(child => {
            if (!child) return;
            child.getAllIds().forEach(id => ids.add(id));
        });
        return ids;
    }

    /**
     * Does this node logically imply 'other' under the given reachability?
     */
    implies(other, reachability) {
        if (other instanceof IdNode) {
            if (this.op === 'AND') {
                // AND implies id if any child implies id
                return this.children.some(child => child.implies(other, reachability));
            }
            if (this.op === 'OR') {
                // OR implies id only if ALL children imply id
                return this.children.every(child => child.implies(other, reachability));
            }
        }
        if (other instanceof OpNode) {
            if (other.op === 'AND') {
                if (this.op === 'AND') {
                    // AND1 implies AND2 if for every child of AND2,
                    // there is a child of AND1 that implies it
                    return other.children.every(child2 =>
                        this.children.some(child1 => child1.implies(child2, reachability))
                    );
                }
                if (this.op === 'OR') {
                    // OR implies AND if OR implies each child of AND
                    return other.children.every(child => this.implies(child, reachability));
                }
            }
            if (other.op === 'OR') {
                if (this.op === 'AND') {
                    // AND implies OR if it implies any child of OR
                    return other.children.some(child => this.implies(child, reachability));
                }
                // OR implies OR is hard; we skip to avoid wrong conclusions
                // (could be expanded with a more sophisticated check)
            }
        }
        return false;
    }

    simplify(reachability) {
        // 1. Simplify children
        let children = this.children
            .map(c => c && c.simplify ? c.simplify(reachability) : c)
            .filter(Boolean);

        // 2. Flatten nested same-operator nodes
        let flat = [];
        for (const child of children) {
            if (child instanceof OpNode && child.op === this.op) {
                flat.push(...child.children);
            } else {
                flat.push(child);
            }
        }

        // 3. DISTRIBUTION: if this is AND and any child is OR,
        //    distribute to expose conjunctive implications.
        if (this.op === 'AND') {
            const orChildIndex = flat.findIndex(c => c instanceof OpNode && c.op === 'OR');
            if (orChildIndex !== -1) {
                const orChild = flat[orChildIndex];
                // Collect the other children (not the OR)
                const otherChildren = flat.filter((_, i) => i !== orChildIndex);
                // Create new OR node: for each child of the OR, combine it with the other children
                const distributed = new OpNode('OR',
                    orChild.children.map(orSub => {
                        const andChildren = [...otherChildren, orSub];
                        // If only one child, just return it, else wrap in AND
                        return andChildren.length === 1 ? andChildren[0] : new OpNode('AND', andChildren);
                    })
                );
                // Recursively simplify the new OR node (which may further simplify)
                return distributed.simplify(reachability);
            }
        }

        // 4. Remove duplicate IdNode children
        const unique = [];
        const seenIds = new Set();
        for (const child of flat) {
            if (child instanceof IdNode) {
                if (!seenIds.has(child.idVal)) {
                    seenIds.add(child.idVal);
                    unique.push(child);
                }
            } else {
                unique.push(child);
            }
        }

        // 5. Remove redundant children based on implication
        const result = [];
        for (let i = 0; i < unique.length; i++) {
            const childI = unique[i];
            let redundant = false;
            for (let j = 0; j < unique.length; j++) {
                if (i === j) continue;
                const childJ = unique[j];
                if (this.op === 'AND') {
                    if (childJ.implies(childI, reachability)) {
                        redundant = true;
                        break;
                    }
                } else { // OR
                    if (childI.implies(childJ, reachability)) {
                        redundant = true;
                        break;
                    }
                }
            }
            if (!redundant) result.push(childI);
        }

        if (result.length === 0) return null;
        if (result.length === 1) return result[0];
        return new OpNode(this.op, result);
    }

    toStr() {
        if (!this.children || this.children.length === 0) return '';
        const parts = this.children.map(child => {
            if (!child) return '';
            const s = child.toStr();
            // Add parentheses if child is a different operator
            if (child instanceof OpNode && child.op !== this.op) {
                return '(' + s + ')';
            }
            return s;
        }).filter(Boolean);
        return parts.join(' ' + this.op + ' ');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpressionUtils;
} else {
    window.ExpressionUtils = ExpressionUtils;
}
