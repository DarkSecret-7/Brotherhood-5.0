
// --- Public Gallery Logic ---

// Ensure globals are cleared initially to avoid showing local storage data
// globals.js runs before this script and populates them from localStorage
window.draftNodes = [];
window.draftDomains = [];

// --- Sidebar Logic ---
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    
    // Toggle header visibility
    var hidden = sidebar.classList.contains('collapsed') ? 'none' : 'flex';
    sidebar.querySelector('.sidebar-header').setAttribute('style', `display: ${hidden} !important`);
}

// --- API Calls ---
async function fetchPublicSnapshots() {
    try {
        const response = await fetch('/api/v1/public/snapshots');
        if (!response.ok) throw new Error('Failed to fetch graphs');
        const snapshots = await response.json();
        renderGraphList(snapshots);
    } catch (err) {
        const list = document.getElementById('graph-list');
        if (list) list.innerHTML = `<p style="color: #d93025; padding: 10px;">Error: ${err.message}</p>`;
    }
}

async function loadGraph(label) {
    try {
        // Show loading state (optional)
        // document.getElementById('graph-container').innerHTML = '<p style="text-align: center; padding-top: 100px;">Loading graph...</p>';
        
        const response = await fetch(`/api/v1/public/snapshots/${label}`);
        if (!response.ok) throw new Error('Failed to fetch graph details');
        const snapshot = await response.json();
        
        // Map to format expected by visualizer
        // DB ID -> Local ID mapping for domains
        const domainDbToLocal = {};
        snapshot.domains.forEach(d => {
            domainDbToLocal[d.id] = d.local_id;
        });
        
        // Update GLOBAL variables
        window.draftDomains = snapshot.domains.map(d => ({
            local_id: d.local_id,
            title: d.title,
            description: d.description,
            // FORCE EXPAND: Public gallery should show the content, not folders
            collapsed: false, 
            // Ensure parent_id is mapped to Local ID, or null if root
            parent_id: d.parent_id ? domainDbToLocal[d.parent_id] : null
        }));

        window.draftNodes = snapshot.nodes.map(n => ({
            local_id: n.local_id,
            title: n.title,
            description: n.description,
            prerequisite: n.prerequisite,
            source_items: n.source_items,
            domain_id: n.domain_id ? domainDbToLocal[n.domain_id] : null,
            x: n.x,
            y: n.y,
            saved_x: n.x,
            saved_y: n.y
        }));
        
        if (typeof renderGraph === 'function') {
            // Destroy existing network to prevent position syncing from previous graph
            if (window.network) {
                try {
                    window.network.destroy();
                    window.network = null;
                } catch (e) {
                    console.warn("Error destroying network:", e);
                }
            }
            
            renderGraph(window.draftNodes, window.draftDomains);
            
            // Force redraw to ensure backgrounds appear
            setTimeout(() => {
                if (window.network) {
                    window.network.redraw();
                    window.network.fit();
                }
            }, 500);
        } else {
            console.error("renderGraph function is not defined. Ensure visualization.js is loaded.");
            alert("Error: Visualization logic not loaded.");
        }
        
        // Highlight active item
        document.querySelectorAll('.graph-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.graph-item[onclick="loadGraph('${label}')"]`);
        if (activeItem) activeItem.classList.add('active');
        
    } catch (err) {
        console.error("Error loading graph:", err);
        alert('Error loading graph: ' + err.message);
    }
}

function renderGraphList(snapshots) {
    const container = document.getElementById('graph-list');
    if (!container) return;
    
    if (snapshots.length === 0) {
        container.innerHTML = '<p style="padding: 10px; color: #5f6368;">No public graphs available.</p>';
        return;
    }
    
    let html = '';
    snapshots.forEach(s => {
        const date = new Date(s.last_updated).toLocaleDateString();
        html += `
            <div class="graph-item" onclick="loadGraph('${s.version_label}')">
                <div class="graph-title">${s.version_label || 'v' + s.label}</div>
                <div class="graph-meta">
                    ${s.node_count} nodes • Updated ${date}<br>
                    By ${s.created_by || 'Unknown'}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// --- Interaction ---
// Override openEditModal from visualization.js
// Since this is read-only, we show details but don't allow editing
window.openEditModal = function(nodeId) {
    const node = window.draftNodes.find(n => n.local_id === nodeId);
    if (!node) return;
    
    const titleEl = document.getElementById('detail-title');
    const metaEl = document.getElementById('detail-meta');
    const descEl = document.getElementById('detail-desc');
    const sourcesContainer = document.getElementById('detail-sources');
    const panel = document.getElementById('node-details');

    if (titleEl) titleEl.textContent = node.title;
    if (metaEl) metaEl.textContent = `ID: ${node.local_id}`;
    if (descEl) descEl.textContent = node.description || 'No description provided.';
    
    // Sources
    if (sourcesContainer) {
        // Reset header
        const sourcesHeader = sourcesContainer.previousElementSibling;
        if (sourcesHeader && sourcesHeader.tagName === 'H4') {
            sourcesHeader.textContent = 'Sources';
        }

        sourcesContainer.innerHTML = '';
        if (node.source_items && node.source_items.length > 0) {
            node.source_items.forEach(s => {
                const div = document.createElement('div');
                div.className = 'source-item-row';
                div.style.marginBottom = '8px';
                div.style.cursor = 'default';
                div.innerHTML = `
                    <div class="source-icon">📄</div>
                    <div class="source-main-info">
                        <div class="source-title" title="${s.title}">${s.title}</div>
                        <div class="source-meta-info">
                            ${s.author ? `<span>👤 ${s.author}</span>` : ''}
                            ${s.year ? `<span>📅 ${s.year}</span>` : ''}
                        </div>
                        ${s.url ? `<a href="${s.url}" target="_blank" style="font-size: 0.85em; color: #1a73e8;">Open Link &nearr;</a>` : ''}
                    </div>
                `;
                sourcesContainer.appendChild(div);
            });
        } else {
            sourcesContainer.innerHTML = '<span style="color: #9aa0a6; font-size: 0.9em;">No sources linked.</span>';
        }
    }
    
    if (panel) panel.style.display = 'block';
};

// --- Domain Details Logic ---
window.openDomainDetails = function(domainId) {
    const domain = window.draftDomains.find(d => String(d.local_id) === String(domainId));
    if (!domain) return;

    const titleEl = document.getElementById('detail-title');
    const metaEl = document.getElementById('detail-meta');
    const descEl = document.getElementById('detail-desc');
    const sourcesContainer = document.getElementById('detail-sources');
    const panel = document.getElementById('node-details');

    if (titleEl) titleEl.textContent = domain.title || "Untitled Domain";
    if (metaEl) metaEl.textContent = `Domain • Level ${domain.level || '?'}`;
    if (descEl) descEl.textContent = domain.description || 'No description provided.';
    
    // Clear sources for domains as they don't have source items
    if (sourcesContainer) {
        // Change header to "Actions"
        const sourcesHeader = sourcesContainer.previousElementSibling;
        if (sourcesHeader && sourcesHeader.tagName === 'H4') {
            sourcesHeader.textContent = 'Actions';
        }

        sourcesContainer.innerHTML = '';

        // Add Expand/Collapse Button
        const btn = document.createElement('button');
        // Simple inline style to match theme
        btn.style.width = '100%';
        btn.style.padding = '10px';
        btn.style.background = '#f1f3f4';
        btn.style.border = '1px solid #dadce0';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = '500';
        btn.style.color = '#3c4043';
        btn.style.transition = 'background 0.2s';
        
        btn.onmouseover = function() { btn.style.background = '#e8eaed'; };
        btn.onmouseout = function() { btn.style.background = '#f1f3f4'; };

        btn.textContent = domain.collapsed ? 'Expand Domain' : 'Collapse Domain';
        
        btn.onclick = function() {
            toggleGraphDomain(domainId);
            // Update button text after toggle (state changes in memory)
            const updatedDomain = window.draftDomains.find(d => String(d.local_id) === String(domainId));
            if (updatedDomain) {
                btn.textContent = updatedDomain.collapsed ? 'Expand Domain' : 'Collapse Domain';
            }
        };
        sourcesContainer.appendChild(btn);
    }

    if (panel) panel.style.display = 'block';
};

window.closeNodeDetails = function() {
    const panel = document.getElementById('node-details');
    if (panel) panel.style.display = 'none';
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    fetchPublicSnapshots();
});
