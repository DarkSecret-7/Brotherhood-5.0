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
        return JSON.parse(jsonPayload).sub;
    } catch (e) {
        return null;
    }
}

function logout() {
    localStorage.removeItem('access_token');
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=lax;";
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=strict;";
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.replace('/login');
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
    // Use cached snapshots by default when switching tabs
    if (tabName === 'database') {
        if (typeof refreshSnapshots === 'function') refreshSnapshots(false);
    }
}
