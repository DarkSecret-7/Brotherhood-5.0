# Brotherhood Curator Lab - Frontend

A modern, layered frontend architecture for Brotherhood Curator Lab workspace with strict separation of concerns.

## Architecture Overview

The frontend follows a strict separation of concerns pattern with clear data flow:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Transformers   │───▶│  State Manager  │◀───│   Operations    │
│                 │    │                 │    │   Controller    │
│ Backend ↔ Frontend│    │ Single Source   │    │                 │
│ Data Format      │    │ of Truth        │    │ User Actions    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   UI Controller │
                       │                 │
                       │ Pure Display    │
                       └─────────────────┘
```

### Core Principles

1. **Strict Data Flow**: Transformers → State Manager → UI Controller
2. **Operations Separation**: User actions flow through Operations Controller → State Manager
3. **Single Responsibility**: Each component has one clear purpose
4. **No Direct State Access**: UI never modifies state directly
5. **Centralized State**: All state managed by State Manager only

## File Structure

```
frontend/
├── api/                    # API Layer - Backend communication
│   ├── base-api-service.js    # Core HTTP client
│   ├── auth/                   # Authentication endpoints
│   ├── snapshots/              # Snapshot CRUD (UUID-based)
│   ├── assessments/            # Assessment capabilities
│   └── users/                  # User management
├── transformer/            # Transformer Layer - Data conversion
│   ├── auth/                   # User data transformation
│   └── snapshots/              # Graph data transformation
├── state/                 # State Layer - Single source of truth
│   └── lab-state-manager.js     # Centralized state management
├── ui/                     # UI Layer - Display and operations
│   └── lab/
│       ├── workspace-ui-controller.js  # Pure display logic
│       └── workspace-ops-controller.js  # Business operations
├── css/                   # Stylesheets
├── templates/             # HTML templates
│   └── lab/
│       └── workspace.html       # Main workspace page
├── index.html            # Entry point with redirect
└── test-frontend.js     # Testing utilities
```

## Features

- **Strict Separation of Concerns**: Clear boundaries between display, operations, and state
- **Unidirectional Data Flow**: Predictable data flow prevents bugs
- **Single Source of Truth**: All state managed centrally
- **UUID-based Communication**: All backend communication uses UUIDs and hashes
- **Persistent State**: Auto-saves to localStorage every 60 seconds
- **Backward Compatibility**: Original HTML/CSS preserved exactly
- **Modern State Management**: React-like state patterns without framework dependencies
- **Robust Error Handling**: Comprehensive error handling and user feedback
- **Testing Built-in**: Automatic testing of all components

## Quick Start

### Using Docker (Recommended)

1. **Start both frontend and backend:**
   ```bash
   cd frontend
   docker-compose up
   ```

2. **Start only frontend:**
   ```bash
   cd frontend
   docker-compose up frontend
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Workspace: http://localhost:3000/templates/lab/workspace.html

### Manual Setup

1. **Install dependencies:**
   ```bash
   npm install -g http-server
   ```

2. **Start the frontend:**
   ```bash
   cd frontend
   ./start-frontend.sh
   ```

3. **Or start directly:**
   ```bash
   cd frontend
   http-server -p 3000 -c-1 --cors
   ```

## Configuration

### API Configuration

The API base URL is configured in `api/base-api-service.js`:
```javascript
this.baseURL = 'http://localhost:8000/api/v1';
```

### Backend Requirements

The frontend expects the backend to be running at `http://localhost:8000` with the following endpoints:
- Authentication: `/api/v1/auth/*`
- Snapshots: `/api/v1/snapshots/*` (UUID-based)
- Assessments: `/api/v1/assessments/*`
- Users: `/api/v1/users/*`

## Component Responsibilities

### State Manager (`state/lab-state-manager.js`)
**Single Source of Truth** - Manages all application state

✅ **What it does:**
- Maintains complete application state
- Handles localStorage persistence
- Manages modal and form states
- Provides state mutation methods
- Notifies subscribers of state changes
- Initializes data from localStorage

❌ **What it NEVER does:**
- Call transformers (transformers call it)
- Direct DOM manipulation
- Handle user input validation
- Make API calls

### UI Controller (`ui/lab/workspace-ui-controller.js`)
**Pure Display** - Only renders what the state contains

✅ **What it does:**
- Renders UI based on state manager data
- Handles visual updates and animations
- Manages DOM element references
- Delegates user actions to operations controller
- Updates display based on state changes

❌ **What it NEVER does:**
- Modify state directly (always through state manager)
- Handle business logic
- Validate forms
- Make API calls
- Store local state

### Operations Controller (`ui/lab/workspace-ops-controller.js`)
**Business Logic** - Handles all user operations

✅ **What it does:**
- Processes user input and validates forms
- Executes business operations
- Calls state manager methods to mutate state
- Handles error scenarios and user feedback
- Manages form submissions and validations

❌ **What it NEVER does:**
- Direct DOM manipulation
- Store state locally
- Handle UI rendering
- Access localStorage directly

### Transformers (`transformer/snapshots/snapshots-transformer.js`)
**Data Transformation** - Converts between backend and frontend formats

✅ **What it does:**
- Transforms backend data to frontend format
- Transforms frontend data to backend format
- Validates data structures
- Calls state manager with transformed data

❌ **What it NEVER does:**
- Get called by state manager
- Handle UI operations
- Store application state
- Access DOM elements

## Data Flow Rules

### Loading Data (Backend → Frontend)
1. **Backend API** returns raw data
2. **Transformer** converts to frontend format
3. **Transformer** calls `stateManager.loadSnapshot(transformedData)`
4. **State Manager** updates state and notifies subscribers
5. **UI Controller** receives state change and updates display

### User Actions (Frontend → Backend)
1. **User Interaction** captured by UI Controller
2. **UI Controller** delegates to Operations Controller
3. **Operations Controller** validates and processes action
4. **Operations Controller** calls State Manager methods
5. **State Manager** updates state and notifies subscribers
6. **UI Controller** updates display based on new state
7. **Operations Controller** may call Transformer for backend communication

### Saving Data (Frontend → Backend)
1. **Operations Controller** triggers save process
2. **State Manager** exports raw data via `exportWorkspace()`
3. **Operations Controller** passes data to Transformer
4. **Transformer** transforms data and sends to backend

## Strict Architecture Rules

### 🚫 **FORBIDDEN PATTERNS**

- ❌ State manager calling transformer methods
- ❌ UI controller directly modifying state
- ❌ Operations controller storing local state
- ❌ Duplicate business logic across controllers
- ❌ Modal state managed outside state manager
- ❌ Form validation in UI controller

### ✅ **REQUIRED PATTERNS**

- ✅ All state changes go through State Manager
- ✅ UI Controller only displays State Manager data
- ✅ Operations Controller handles all business logic
- ✅ Transformers only handle data format conversion
- ✅ Modal and form states in State Manager only
- ✅ Clear delegation from UI to Operations

## Development Guidelines

### Adding New Features

1. **State Changes**: Add new state properties to `lab-state-manager.js`
2. **UI Elements**: Add rendering logic to `workspace-ui-controller.js`
3. **User Actions**: Add business logic to `workspace-ops-controller.js`
4. **Data Transformation**: Add transformation logic to appropriate transformer

### Modal Implementation Pattern

```javascript
// State Manager - Add modal state
state.modals.newModal = false;

// Operations Controller - Handle opening
openNewModal() {
    this.stateManager.toggleModal('newModal', true);
}

// UI Controller - Handle display
updateModalDisplay() {
    const { modals } = this.stateManager.state;
    this.elements.modals.newModal.style.display = modals.newModal ? 'block' : 'none';
}
```

### Form Implementation Pattern

```javascript
// State Manager - Add form state
state.forms.newForm = { field1: '', field2: '' };

// Operations Controller - Handle submission
submitForm() {
    const form = this.stateManager.state.forms.newForm;
    // Validate and process
    this.stateManager.updateForm('newForm', { field1: 'newValue' });
}

// UI Controller - Handle display (read-only)
updateFormDisplay() {
    const form = this.stateManager.state.forms.newForm;
    this.elements.form.field1.value = form.field1;
}
```

## Migration Checklist

When modifying existing code, ensure:

- [ ] No transformer calls in state manager
- [ ] All modal/form state managed by state manager only
- [ ] UI controller only displays, never modifies state
- [ ] Operations controller handles all business logic
- [ ] No duplicate methods across controllers
- [ ] Clear delegation pattern from UI to operations
- [ ] Proper error handling at each layer
- [ ] No direct DOM manipulation in operations controller

## Benefits of This Architecture

1. **Maintainability**: Clear separation makes code easier to understand and modify
2. **Testability**: Each layer can be tested independently
3. **Debugging**: Clear data flow makes issues easier to trace
4. **Scalability**: New features can be added without breaking existing architecture
5. **Consistency**: Enforced patterns prevent architectural drift
6. **Predictability**: Unidirectional data flow prevents unexpected side effects
7. **Collaboration**: Clear boundaries allow multiple developers to work safely

## Troubleshooting

### Architecture Violations

The following patterns indicate violations:

- 🚨 State manager calling transformer methods
- 🚨 UI controller directly modifying state
- 🚨 Operations controller storing local state
- 🚨 Duplicate business logic across controllers
- 🚨 Modal state managed outside state manager
- 🚨 Form validation in UI controller

### Common Issues

1. **CORS Errors**: Ensure backend has CORS enabled
2. **Authentication Failures**: Check that backend is running and accessible
3. **404 Errors**: Verify all file paths are correct in HTML templates
4. **State Not Persisting**: Check localStorage is enabled in browser
5. **UI Not Updating**: Verify state changes trigger notifications
6. **Modal Not Showing**: Check modal state in state manager

### Debug Mode

Enable debug logging by opening browser console and running:
```javascript
localStorage.setItem('debug', 'true');
```

## Testing

Run built-in tests:
```javascript
// In browser console
testFrontendArchitecture()
testSnapshotLoading()
```

## Contributing

### Architecture Compliance

When adding new features, you MUST:

1. **Follow strict data flow**: Transformers → State → UI, Operations → State
2. **Maintain separation**: Each component has one responsibility only
3. **Use state manager**: All state changes go through state manager
4. **Delegate properly**: UI controller delegates to operations controller
5. **Avoid duplication**: No duplicate logic across controllers
6. **Test boundaries**: Ensure each layer can be tested independently

### Pull Request Checklist

- [ ] Architecture rules followed
- [ ] No forbidden patterns detected
- [ ] Clear data flow maintained
- [ ] State properly centralized
- [ ] UI controller only displays
- [ ] Operations controller handles business logic
- [ ] Tests updated for new functionality
- [ ] Documentation updated

### Code Review Guidelines

Reviewers should check:
- Data flow directionality
- State management compliance
- Separation of concerns
- Duplicate code elimination
- Proper error handling
- Test coverage

---

**⚠️ IMPORTANT**: This architecture is designed to prevent the common issues that lead to "spaghetti code". Strict adherence to these patterns is **essential** for long-term maintainability. Violations will be rejected in code review.

## License

This project is part of Brotherhood Curator Lab ecosystem.
