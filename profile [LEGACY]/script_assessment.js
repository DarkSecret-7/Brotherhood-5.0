// --- Assessment Tab Logic ---
let currentGraphLabel = null;
let currentGraphData = null;
let assessments = {}; // node_id -> proof_value
let assessmentNetwork = null;
const graphSearchInput = document.getElementById('graph-search-input');
const graphSearchBtn = document.getElementById('graph-search-btn');
const searchResults = document.getElementById('search-results');
const assessmentGraphContainer = document.getElementById('assessment-graph-container');
const nodeDetailPanel = document.getElementById('node-detail-panel');
const assessmentInputArea = document.getElementById('assessment-input-area');
const selectedNodeTitle = document.getElementById('selected-node-title');
const selectedNodeDesc = document.getElementById('selected-node-desc');
const generateCapabilityBtn = document.getElementById('generate-capability-btn');
const deleteCapabilityBtn = document.getElementById('delete-capability-btn');
const assessmentStatus = document.getElementById('assessment-status');
const assessmentBtns = document.querySelectorAll('.assessment-btn');

const capInfoBox = document.getElementById('latest-capability-info');
const capName = document.getElementById('cap-name');
const capType = document.getElementById('cap-type');
const capVersion = document.getElementById('cap-version');
const capDate = document.getElementById('cap-date');
const capHash = document.getElementById('cap-hash');

// --- Client-Side Assessment Logic ---
async function generateGraphHash(graphData) {
    // Normalize graph data similar to backend logic
    // Sort nodes by local_id and extract relevant fields
    const normalizedNodes = (graphData.nodes || [])
        .map(n => ({
            local_id: n.local_id,
            title: n.title,
            prerequisite: n.prerequisite
        }))
        .sort((a, b) => a.local_id - b.local_id);
        
    const jsonString = JSON.stringify(normalizedNodes);
    
    // Use Web Crypto API for SHA-256
    const msgBuffer = new TextEncoder().encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

function updateCapabilityDisplay(capability, updated = false) {
    if (!capability) {
        capInfoBox.hidden = true;
        generateCapabilityBtn.disabled = false;
        generateCapabilityBtn.textContent = 'Generate Capability';
        deleteCapabilityBtn.disabled = true;
        return;
    }
    capName.textContent = capability.assessment_name || '-';
    capType.textContent = capability.assessment_type || '-';
    capVersion.textContent = capability.version || '-';
    capDate.textContent = new Date(capability.assessment_date).toLocaleString();
    capHash.textContent = capability.graph_hash || '-';
    capInfoBox.hidden = false;
    generateCapabilityBtn.disabled = true;
    generateCapabilityBtn.textContent = 'Update Capability';
    deleteCapabilityBtn.disabled = false;

    if (updated) assessmentStatus.innerHTML = `<strong>Success!</strong> Capability Updated.`;
    else assessmentStatus.innerHTML = `<strong>Success!</strong> Capability Generated.`;
}

async function searchGraphs(query) {
    if (!query) return;
    try {
        const response = await fetch(`/api/v1/snapshots/search?q=${encodeURIComponent(query)}`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Search failed');
        const graphs = await response.json();
        renderSearchResults(graphs);
    } catch (e) {
        console.error(e);
        showNotification("Failed to search graphs", "error");
    }
}

function renderSearchResults(graphs) {
    searchResults.innerHTML = '';
    if (graphs.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No graphs found</div>';
    } else {
        graphs.forEach(g => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `<strong>${sanitize(g.version_label)}</strong> <span style="font-size: 0.8rem; color: #666;">(${g.node_count} nodes)</span>`;
            item.addEventListener('click', () => {
                loadGraphForAssessment(g.version_label);
                searchResults.hidden = true;
                graphSearchInput.value = g.version_label;
            });
            searchResults.appendChild(item);
        });
    }
    searchResults.hidden = false;
}

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
    if (!graphSearchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.hidden = true;
    }
});

async function loadGraphForAssessment(graphLabel) {
    try {
        const overlay = document.getElementById('graph-loading-overlay');
        if (overlay) overlay.style.display = 'flex';
        
        console.log(`Loading graph for assessment: ${graphLabel}`);
        const response = await fetch(`/api/v1/snapshots/${graphLabel}/read`, {
            headers: getHeaders(),
            method: 'GET'
        });
        if (!response.ok) throw new Error(`Failed to load graph ${graphLabel}`);
        const data = await response.json();
        
        currentGraphLabel = graphLabel;
        currentGraphData = data;
        assessments = {}; // Reset assessments
        
        renderAssessmentGraph(data);
        
        // Reset button and info
        generateCapabilityBtn.textContent = "Generate Capability";
        updateCapabilityDisplay(null);
        
        // Fetch latest capability for this graph
        try {          
            // For this task, let's assume we implement a generic GET /capabilities endpoint
            const capResponse = await fetch(`/api/v1/self-assessment/${graphLabel}/latest`, {
                headers: getHeaders(),
                method: 'GET'
            });
            if (capResponse.ok) {
                const latestCap = await capResponse.json();
                console.log("Latest self-assessment:", latestCap);
                // It always returns the latest self-assessment for this graph
                applyExistingAssessment(latestCap);
                updateCapabilityDisplay(latestCap);
                assessmentStatus.innerHTML = `Loaded previous assessment from ${new Date(latestCap.assessment_date).toLocaleDateString()}.`;
                generateCapabilityBtn.textContent = "Update Capability";
            }
        } catch (e) {
            console.warn("Failed to fetch previous assessment:", e);
            assessmentStatus.textContent = "Select nodes to assess your knowledge.";
        }
        
        generateCapabilityBtn.disabled = Object.keys(assessments).length === 0;
    } catch (e) {
        console.error(e);
        showNotification("Failed to load graph", "error");
        const overlay = document.getElementById('graph-loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }
}

function renderAssessmentGraph(graphData) {
    const nodes = new vis.DataSet(graphData.nodes.map(n => ({
        id: n.local_id,
        label: n.title,
        title: n.description || n.title,
        color: { background: '#ffffff', border: '#ddd' }
    })));
    const edges = new vis.DataSet([]);
    graphData.nodes.forEach(node => {
        if (node.prerequisite) {
            // Simplified parser for read-only visualization
            const prereqs = node.prerequisite.match(/\d+/g) || [];
            prereqs.forEach(pid => {
                edges.add({ from: parseInt(pid), to: node.local_id, arrows: 'to', color: '#ccc' });
            });
        }
    });
    const options = {
        nodes: {
            shape: 'box',
            margin: 10,
            font: { size: 14 }
        },
        edges: {
            smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.5 }
        },
        interaction: {
            hover: true,
            navigationButtons: true
        },
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed',
                nodeSpacing: 150,
                levelSeparation: 150
            }
        },
        physics: false
    };
    if (assessmentNetwork) assessmentNetwork.destroy();
    assessmentNetwork = new vis.Network(assessmentGraphContainer, { nodes, edges }, options);
    // Hide overlay when stabilization is finished
    assessmentNetwork.on("stabilizationFinished", function () {
        const overlay = document.getElementById('graph-loading-overlay');
        if (overlay) overlay.style.display = 'none';
    });
    // Safety: hide after a short timeout if stabilization takes too long or doesn't trigger
    setTimeout(() => {
        const overlay = document.getElementById('graph-loading-overlay');
        if (overlay && overlay.style.display !== 'none') {
            overlay.style.display = 'none';
        }
    }, 1000);
    assessmentNetwork.on('selectNode', (params) => {
        const nodeId = params.nodes[0];
        const node = graphData.nodes.find(n => n.local_id === nodeId);
        if (node) showNodeAssessment(node);
    });
}

function clearAssessments() {
    const defaultColor = '#ffffff';

    // Reset all nodes to default color
    assessmentNetwork.body.data.nodes.forEach(node => {
        assessmentNetwork.body.data.nodes.update({
            id: node.id,
            color: { background: defaultColor, border: '#ddd' }
        });
    });

    //Refresh network
    //assessmentNetwork.redraw();

    // Clear assessments dictionary
    assessments = {};
}

function applyExistingAssessment(capability) {
    const invalid = !capability || !capability.assessed_nodes || capability.assessed_nodes.length === 0 || assessments.length === 0 || !assessments;
    if (invalid) {
        // Clear all nodes
        console.log("Clearing all nodes...");
        clearAssessments();
        return;
    };
        
    const colors = { 0: '#ffcdd2', 1: '#fff9c4', 2: '#c8e6c9' };
        
    capability.assessed_nodes.forEach(node => {
        // Convert node from json dictionary to object
        const id = node.node_id;
        const val = node.evaluation["value"];
        if (val !== undefined) {
            assessments[id] = val;
            
            // Update graph visualization if node exists
            if (assessmentNetwork.body.data.nodes.get(id)) {
                assessmentNetwork.body.data.nodes.update({ 
                    id: id, 
                    color: { background: colors[val] } 
                });
            }
        }
    });
    
    generateCapabilityBtn.disabled = Object.keys(assessments).length === 0;
}

function showNodeAssessment(node) {
    if (node == null) {
        selectedNodeDesc.textContent = "";
        selectedNodeTitle.textContent = "";
        assessmentInputArea.hidden = true;
        return;
    }

    selectedNodeTitle.textContent = node.title;
    selectedNodeDesc.textContent = node.description || "No description available.";
    assessmentInputArea.hidden = false;
    
    // Update active button
    const currentValue = assessments[node.local_id];
    assessmentBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-value') === String(currentValue));
    });
}

// API Functions
async function generateCapability() {
    if (!currentGraphLabel || Object.keys(assessments).length === 0) return;
    
    try {
        generateCapabilityBtn.disabled = true;
        assessmentStatus.textContent = "Generating capability certificate...";
        currentUser = getCurrentUser();
        
        //Use backend SelfAssessmentRequest for processing

        // 1. Format proof_inputs for SelfAssessmentRequest
        const proofInputs = Object.entries(assessments).map(([id, val]) => ({
            node_id: parseInt(id),
            value: val
        }));
        
        const payload = JSON.stringify({
            graph_label: currentGraphLabel,
            proof_inputs: proofInputs
        })
        console.log(payload)
        // 2. Construct Capability Object through backend
        const capabilityPayload = await fetch('/api/v1/self-assessment', {
            method: 'POST',
            headers: getHeaders(),
            body: payload
        });
        
        if (!capabilityPayload.ok) throw new Error('Failed to save capability');
        
        const capability = await capabilityPayload.json();
        const isUpdate = generateCapabilityBtn.textContent === "Update Capability";
        const actionText = isUpdate ? "updated" : "generated";
        showNotification(`Capability certificate ${actionText} and saved successfully!`, "success");
        
        updateCapabilityDisplay(capability, isUpdate);  
    } catch (e) {
        console.error(e);
        showNotification("Failed to generate capability certificate", "error");
        generateCapabilityBtn.disabled = false;
        assessmentStatus.textContent = "Error occurred. Please try again.";
    }
};

async function deleteCapability() {
    
    if (!currentGraphLabel) return;
    
    try {
        // 1. Delete Capability Object through backend
        const response = await fetch(`/api/v1/self-assessment/${currentGraphLabel}/delete`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to delete capability');
        
        showNotification("Capability certificate deleted successfully!", "success");
        
        // Clear UI
        applyExistingAssessment(null);
        showNodeAssessment(null);
        updateCapabilityDisplay(null);
        assessmentStatus.innerHTML = `<strong>Success!</strong> Capability deleted.`;
        generateCapabilityBtn.textContent = "Generate Capability"; // Reset button text, updateCapabilityDisplay can NOT handle delete for now
        
    } catch (e) {
        console.error(e);
        showNotification("Failed to delete capability certificate", "error");
    }
}

function gatherProofs(btn) {
    if (!assessmentNetwork) return;
    const selectedNodes = assessmentNetwork.getSelectedNodes();
    if (selectedNodes.length === 0) return;
    
    const nodeId = parseInt(selectedNodes[0]);
    const value = parseInt(btn.getAttribute('data-value'));
    
    assessments[nodeId] = value;
    
    // Update UI
    assessmentBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update node color in graph
    const colors = { 0: '#ffcdd2', 1: '#fff9c4', 2: '#c8e6c9' };
    assessmentNetwork.body.data.nodes.update({ id: nodeId, color: { background: colors[value] } });
    
    // Check if we can generate capability (at least one node assessed)
    generateCapabilityBtn.disabled = Object.keys(assessments).length === 0;
    assessmentStatus.textContent = `${Object.keys(assessments).length} nodes assessed.`;
};

graphSearchBtn.addEventListener('click', () => searchGraphs(graphSearchInput.value));
graphSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchGraphs(graphSearchInput.value);
});
// --- Input Sanitization ---
function sanitize(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}