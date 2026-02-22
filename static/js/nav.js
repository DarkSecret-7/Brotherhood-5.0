// Side Panel Navigation Logic

function openSidePanel() {
    var panel = document.getElementById('side-panel');
    var overlay = document.getElementById('side-panel-overlay');
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('show');
}

function closeSidePanel() {
    var panel = document.getElementById('side-panel');
    var overlay = document.getElementById('side-panel-overlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

// Close panel when clicking outside (overlay)
document.addEventListener('click', function(event) {
    if (event.target.matches('.side-panel-overlay')) {
        closeSidePanel();
    }
});

// Logout function (global)
function logout() {
    // For now, just reload or redirect to home as there's no real auth yet
    window.location.href = '/';
}
