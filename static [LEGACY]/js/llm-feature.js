// LLM Feature Module

function openLLMModal() {
    const modal = document.getElementById('llm-modal');
    if (modal) {
        modal.style.display = 'flex'; // Use flex to center, as per CSS
        const queryInput = document.getElementById('llm-query');
        if (queryInput) queryInput.focus();
    }
}

function closeLLMModal() {
    const modal = document.getElementById('llm-modal');
    if (modal) {
        modal.style.display = 'none';
        const resultsContainer = document.getElementById('llm-results');
        if (resultsContainer) resultsContainer.innerHTML = '';
        const queryInput = document.getElementById('llm-query');
        if (queryInput) queryInput.value = '';
    }
}

async function queryLLM() {
    const queryInput = document.getElementById('llm-query');
    const resultsContainer = document.getElementById('llm-results');
    const loadingIndicator = document.getElementById('llm-loading');
    
    if (!queryInput || !resultsContainer || !loadingIndicator) return;
    
    const prompt = queryInput.value.trim();

    if (!prompt) {
        customAlert("Please enter a prompt.");
        return;
    }

    // Show loading
    loadingIndicator.style.display = 'block';
    resultsContainer.innerHTML = '';
    
    try {
        const token = getCookie('access_token');
        
        // Build context from current nodes
        let context = "";
        if (typeof draftNodes !== 'undefined') {
            context = draftNodes.map(n => `${n.title}: ${n.description}`).join("\n");
        }
        
        // Get Graph Name
        let graphName = "Unknown Graph";
        if (typeof baseGraphLabel !== 'undefined' && baseGraphLabel) {
            graphName = baseGraphLabel;
        } else {
             // Try to find it in the UI if not in global variable
             const labelInput = document.getElementById('version-label');
             if (labelInput && labelInput.value) {
                 graphName = labelInput.value;
             }
        }

        const response = await fetch('/api/v1/llm/suggest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prompt: prompt,
                context: context.substring(0, 2000), // Limit context size
                graph_name: graphName
            })
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        displayLLMResults(data.suggestions);
        
    } catch (error) {
        console.error('LLM Query failed:', error);
        resultsContainer.innerHTML = `<div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">Failed to get suggestions: ${error.message}</div>`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function displayLLMResults(suggestions) {
    const container = document.getElementById('llm-results');
    container.innerHTML = '';
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '<p>No suggestions found.</p>';
        return;
    }

    // Add Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'llm-toolbar';
    toolbar.style.marginBottom = '15px';
    toolbar.style.padding = '10px';
    toolbar.style.backgroundColor = '#f1f3f4';
    toolbar.style.borderRadius = '8px';
    toolbar.style.display = 'flex';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.alignItems = 'center';
    
    toolbar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="llm-select-all" onchange="toggleSelectAllLLM(this)" style="width: auto; margin: 0; cursor: pointer;">
            <label for="llm-select-all" style="margin: 0; font-weight: 600; cursor: pointer;">Select All</label>
        </div>
        <button class="btn-primary btn-small" onclick="importSelectedLLM()">Import Selected</button>
    `;
    container.appendChild(toolbar);

    suggestions.forEach((suggestion, index) => {
        const card = document.createElement('div');
        card.className = 'llm-suggestion-card';
        card.style.border = '1px solid #e0e0e0';
        card.style.borderRadius = '8px';
        card.style.padding = '15px';
        card.style.marginBottom = '10px';
        card.style.backgroundColor = '#f9f9f9';
        
        card.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: flex-start;">
                <div style="padding-top: 4px;">
                    <input type="checkbox" class="llm-suggestion-checkbox" style="width: 18px; height: 18px; cursor: pointer;">
                </div>
                <div style="flex: 1;">
                    <h4 style="margin-top: 0; color: #1a73e8; margin-bottom: 5px;">${escapeHtml(suggestion.title)}</h4>
                    <p style="margin-bottom: 10px; color: #444;">${escapeHtml(suggestion.description)}</p>
                    <button class="btn-secondary btn-small" onclick="useSuggestion(this)">Use This Single</button>
                    <div style="display:none;" class="suggestion-data">
                        <span class="s-title">${escapeHtml(suggestion.title)}</span>
                        <span class="s-desc">${escapeHtml(suggestion.description)}</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function toggleSelectAllLLM(checkbox) {
    const checkboxes = document.querySelectorAll('.llm-suggestion-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

function importSelectedLLM() {
    const checkboxes = document.querySelectorAll('.llm-suggestion-checkbox');
    let selectedCount = 0;
    const newNodes = [];

    // Calculate starting ID
    let nextId = 1;
    if (typeof draftNodes !== 'undefined' && draftNodes.length > 0) {
        const maxId = Math.max(...draftNodes.map(n => n.local_id));
        nextId = maxId + 1;
    }

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const card = cb.closest('.llm-suggestion-card');
            const title = card.querySelector('.s-title').innerText;
            const desc = card.querySelector('.s-desc').innerText;
            
            newNodes.push({
                local_id: nextId++,
                title: title,
                description: desc,
                prerequisite: "",
                source_items: [],
                domain_id: null // Root level by default
            });
            selectedCount++;
        }
    });

    if (selectedCount === 0) {
        customAlert("Please select at least one suggestion to import.");
        return;
    }

    if (typeof draftNodes !== 'undefined') {
        // Add to draftNodes
        newNodes.forEach(node => draftNodes.push(node));
        
        // Persist and Refresh
        if (typeof persistDraft === 'function') persistDraft();
        if (typeof refreshWorkspace === 'function') refreshWorkspace();
        
        // Close modal
        closeLLMModal();
        
        // Notify user
        customAlert(`Successfully imported ${selectedCount} nodes.`);
    } else {
        customAlert("Error: Workspace not initialized.");
    }
}

function useSuggestion(btn) {
    const parent = btn.parentElement;
    const title = parent.querySelector('.s-title').innerText;
    const desc = parent.querySelector('.s-desc').innerText;
    
    // Populate the "Add New Node" form
    const titleInput = document.getElementById('node-title');
    const descInput = document.getElementById('node-desc');
    
    if (titleInput) titleInput.value = title;
    if (descInput) descInput.value = desc;
    
    // Close modal
    closeLLMModal();
    
    // Scroll to form
    const formHeader = document.querySelector('.add-node-header');
    if (formHeader) formHeader.scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return "";
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('llm-modal');
    if (event.target == modal) {
        closeLLMModal();
    }
});
