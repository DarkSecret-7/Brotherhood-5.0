import re
import os
from datetime import datetime, timedelta
from typing import List, Set, Dict, Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext

# Auth configuration
SECRET_KEY = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
ALGORITHM = "HS256"
# Set expiration to 2 days (2 * 24 * 60 minutes)
ACCESS_TOKEN_EXPIRE_MINUTES = 2 * 24 * 60 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Try a fallback if it's a version mismatch or similar
        try:
            import bcrypt
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except:
            return False

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def extract_ids(expression: str) -> List[int]:
    """Extract all integer IDs from a prerequisite expression."""
    if not expression:
        return []
    return [int(match) for match in re.findall(r'\b\d+\b', expression)]

def get_reachability(nodes_deps: Dict[int, List[int]]) -> Dict[int, Set[int]]:
    """
    Compute reachability for all nodes.
    nodes_deps: {node_id: [list of prerequisite_ids]}
    Returns: {node_id: {set of all reachable ancestor ids}}
    """
    reachability = {}
    
    def get_ancestors(node_id: int, visited: Set[int]) -> Set[int]:
        if node_id in reachability:
            return reachability[node_id]
        
        if node_id in visited:
            return set()
        
        visited.add(node_id)
        ancestors = set()
        for pre_id in nodes_deps.get(node_id, []):
            ancestors.add(pre_id)
            ancestors.update(get_ancestors(pre_id, visited.copy()))
        
        reachability[node_id] = ancestors
        return ancestors

    for node_id in nodes_deps:
        get_ancestors(node_id, set())
        
    return reachability

def check_circularity(nodes_deps: Dict[int, List[int]], start_node_id: int, new_prerequisites: List[int]) -> Optional[List[int]]:
    """
    Check if adding new_prerequisites to start_node_id creates a cycle.
    Returns the cycle path if found, else None.
    """
    # Temporarily update the dependencies
    temp_deps = nodes_deps.copy()
    temp_deps[start_node_id] = new_prerequisites
    
    visited = set()
    stack = []
    path = []

    def visit(node_id: int):
        if node_id in stack:
            # Cycle detected
            cycle_start_idx = stack.index(node_id)
            return stack[cycle_start_idx:] + [node_id]
        
        if node_id in visited:
            return None
        
        visited.add(node_id)
        stack.append(node_id)
        
        for neighbor in temp_deps.get(node_id, []):
            cycle = visit(neighbor)
            if cycle:
                return cycle
        
        stack.pop()
        return None

    # We only need to check cycles reachable from the start_node_id
    return visit(start_node_id)

# --- Boolean Expression Parser ---

class Node:
    def simplify(self, reachability: Dict[int, Set[int]]) -> 'Node':
        return self
    def to_str(self) -> str:
        return ""
    def get_all_ids(self) -> Set[int]:
        return set()

class IdNode(Node):
    def __init__(self, id_val: int):
        self.id_val = id_val
    def to_str(self) -> str:
        return str(self.id_val)
    def get_all_ids(self) -> Set[int]:
        return {self.id_val}

class OpNode(Node):
    def __init__(self, op: str, children: List[Node]):
        self.op = op.upper() # AND or OR
        self.children = children

    def get_all_ids(self) -> Set[int]:
        ids = set()
        for child in self.children:
            ids.update(child.get_all_ids())
        return ids

    def simplify(self, reachability: Dict[int, Set[int]]) -> Node:
        # 1. Simplify children first
        new_children = [child.simplify(reachability) for child in self.children]
        
        # 2. Flatten nested operators of the same type
        flattened = []
        for child in new_children:
            if isinstance(child, OpNode) and child.op == self.op:
                flattened.extend(child.children)
            else:
                flattened.append(child)
        
        # 3. Transitive reduction among children
        # For AND: if A implies B (A is deeper in graph), B is redundant.
        # For OR: if A implies B (A is deeper in graph), A is redundant.
        
        final_children = []
        for i, child_i in enumerate(flattened):
            is_redundant = False
            ids_i = child_i.get_all_ids()
            
            for j, child_j in enumerate(flattened):
                if i == j: continue
                ids_j = child_j.get_all_ids()
                
                # Check if child_i is redundant because of child_j
                if self.op == 'AND':
                    # In AND, if child_j implies child_i, child_i is redundant
                    # child_j implies child_i if ALL ids in child_i are reachable from ids in child_j
                    if all(any(id_i == id_j or id_i in reachability.get(id_j, set()) 
                               for id_j in ids_j) 
                           for id_i in ids_i):
                        is_redundant = True
                        break
                else: # OR
                    # In OR, if child_i implies child_j, child_i is redundant
                    if all(any(id_j == id_i or id_j in reachability.get(id_i, set()) 
                               for id_i in ids_i) 
                           for id_j in ids_j):
                        is_redundant = True
                        break
            
            if not is_redundant:
                final_children.append(child_i)

        if not final_children:
            return flattened[0] if flattened else None
        if len(final_children) == 1:
            return final_children[0]
            
        return OpNode(self.op, final_children)

    def to_str(self) -> str:
        parts = []
        for child in self.children:
            s = child.to_str()
            if isinstance(child, OpNode) and child.op != self.op:
                parts.append(f"({s})")
            else:
                parts.append(s)
        return f" {self.op} ".join(parts)

def parse_expression(expression: str) -> Node:
    """Simple parser for boolean expressions."""
    # Tokenize
    tokens = re.findall(r'\(|\)|AND|OR|,|\d+', expression, re.IGNORECASE)
    pos = 0

    def parse_or() -> Node:
        nonlocal pos
        node = parse_and()
        while pos < len(tokens) and tokens[pos].upper() == 'OR':
            pos += 1
            right = parse_and()
            if isinstance(node, OpNode) and node.op == 'OR':
                node.children.append(right)
            else:
                node = OpNode('OR', [node, right])
        return node

    def parse_and() -> Node:
        nonlocal pos
        node = parse_primary()
        while pos < len(tokens) and (tokens[pos].upper() == 'AND' or tokens[pos] == ','):
            pos += 1
            right = parse_primary()
            if isinstance(node, OpNode) and node.op == 'AND':
                node.children.append(right)
            else:
                node = OpNode('AND', [node, right])
        return node

    def parse_primary() -> Node:
        nonlocal pos
        if pos >= len(tokens):
            return None
        
        token = tokens[pos]
        if token == '(':
            pos += 1
            node = parse_or()
            if pos < len(tokens) and tokens[pos] == ')':
                pos += 1
            return node
        elif token.isdigit():
            pos += 1
            return IdNode(int(token))
        else:
            # Skip unknown tokens
            pos += 1
            return parse_primary()

    try:
        result = parse_or()
        return result
    except Exception:
        return None

def simplify_expression(expression: str, reachability: Dict[int, Set[int]]) -> str:
    """
    Simplify the expression using a proper parser and tree-based reduction.
    """
    if not expression:
        return ""
        
    tree = parse_expression(expression)
    if not tree:
        return expression # Fallback to original if parsing fails
        
    simplified_tree = tree.simplify(reachability)
    if not simplified_tree:
        return ""
        
    return simplified_tree.to_str()

def remove_id_from_expression(expression: str, id_to_remove: int) -> str:
    """
    Remove a specific ID from a boolean expression and simplify the result.
    e.g., "1 AND 2", remove 1 -> "2"
    e.g., "1 OR 2", remove 1 -> "2"
    """
    if not expression:
        return ""
        
    tree = parse_expression(expression)
    if not tree:
        return expression
        
    def remove_node(node: Node) -> Optional[Node]:
        if isinstance(node, IdNode):
            if node.id_val == id_to_remove:
                return None
            return node
        elif isinstance(node, OpNode):
            new_children = []
            for child in node.children:
                new_child = remove_node(child)
                if new_child:
                    new_children.append(new_child)
            
            if not new_children:
                return None
            if len(new_children) == 1:
                return new_children[0]
            return OpNode(node.op, new_children)
        return node

    new_tree = remove_node(tree)
    if not new_tree:
        return ""
    
    # Also run a basic simplify to clean up nested ops
    return new_tree.simplify({}).to_str()

def rename_id_in_expression(expression: str, old_id: int, new_id: int) -> str:
    """
    Rename a specific ID in a boolean expression.
    e.g., "1 AND 2", rename 1 to 10 -> "10 AND 2"
    """
    if not expression:
        return ""
        
    tree = parse_expression(expression)
    if not tree:
        # Fallback to simple regex if parser fails for some reason
        return re.sub(rf'\b{old_id}\b', str(new_id), expression)
        
    def rename_node(node: Node) -> Node:
        if isinstance(node, IdNode):
            if node.id_val == old_id:
                return IdNode(new_id)
            return node
        elif isinstance(node, OpNode):
            new_children = [rename_node(child) for child in node.children]
            return OpNode(node.op, new_children)
        return node

    new_tree = rename_node(tree)
    return new_tree.to_str()
