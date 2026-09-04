# Self-Assessment Module

A standalone Python package for performing self-assessments against knowledge graphs in The Brotherhood Project.

## Overview

This module provides a flexible assessment system that evaluates user competency against graph nodes. It operates independently from the main application and can be used as a standalone component.

## Files

- **`assessment.py`** - Core assessment logic with `perform_assessment()` function
- **`models.py`** - Pydantic models for data structures (CapabilityObject, Assessment, etc.)
- **`utils.py`** - Utility functions including `generate_graph_hash()` for consistent graph identification
- **`test_assessment.py`** - Integration tests and usage examples
- **`__init__.py`** - Module exports

## Core Functionality

### Main Function: `perform_assessment()`

```python
perform_assessment(
    graph_data: Union[GraphData, Dict[str, Any]],
    proof_inputs: List[ProofInput],
    user_reference: Union[UserData, Dict[str, Any]],
) -> Optional[CapabilityObject]
```

Accepts:
- **Graph data** (Pydantic model, dict, or SQLAlchemy model)
- **Proof inputs** - List of node evaluations (0=not assessed, 1=partial, 2=full)
- **User reference** - User identification data

Returns a `CapabilityObject` containing:
- Assessment metadata (name, type, version, date)
- User information
- Graph UUID
- List of assessed nodes with evaluation scores

## Data Models

- **`CapabilityObject`** - Complete assessment result
- **`GraphData`** - Graph structure with nodes and metadata
- **`NodeData`** - Individual node information (ID, title, description, prerequisites)
- **`Assessment`** - Node evaluation result
- **`ProofInput`** - Input data for node assessment
- **`UserData`** - User identification

## Usage

```python
from self_assessment import perform_assessment, ProofInput

# Create proof inputs
proof_inputs = [
    ProofInput(node_id=1, value=2),  # Full competency
    ProofInput(node_id=2, value=1),  # Partial competency
]

# Perform assessment
result = perform_assessment(
    graph_data=graph_structure,
    proof_inputs=proof_inputs,
    user_reference=user_data
)
```

## Assessment Scoring

- **0** - Not assessed/No competency
- **1** - Partial competency
- **2** - Full competency

## Integration

The module is called by the main application via `/api/v1/self-assessment` endpoint in `app/api/assessments.py`. It maintains separate Pydantic models from the main app schemas for standalone operation.
