// --- Configuration & Global State ---
var API_BASE = '/api/v1';
var currentSnapshotLabel = localStorage.getItem('currentSnapshotLabel') || null;
var baseGraphLabel = localStorage.getItem('baseGraphLabel') || null;
var newNodeSources = [];
var editNodeSources = [];

// Domain State (Now handled entirely by browser localStorage)
var draftDomains = JSON.parse(localStorage.getItem('draftDomains')) || [];
var draftNodes = JSON.parse(localStorage.getItem('draftNodes')) || [];

var selectedNodes = new Set();
var selectedDomains = new Set();

// Helper to persist state to localStorage
function persistDraft() {
    localStorage.setItem('draftDomains', JSON.stringify(draftDomains));
    localStorage.setItem('draftNodes', JSON.stringify(draftNodes));
    if (currentSnapshotLabel) localStorage.setItem('currentSnapshotLabel', currentSnapshotLabel);
    if (baseGraphLabel) localStorage.setItem('baseGraphLabel', baseGraphLabel);
}
