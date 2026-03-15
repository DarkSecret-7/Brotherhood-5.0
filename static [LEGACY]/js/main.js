// Main Initialization and Event Listeners

document.addEventListener('DOMContentLoaded', function() {
    if (typeof requireAuth === 'function' && !requireAuth()) return;
    var overwriteToggle = document.getElementById('overwrite-toggle');
    if (overwriteToggle) {
        // If we have a base graph (loaded or just saved), turn overwrite on
        // Otherwise (new workspace), turn it off
        if (baseGraphLabel) {
            overwriteToggle.checked = true;
        } else {
            overwriteToggle.checked = false;
        }
        // Don't call handleOverwriteToggle here because refreshWorkspace() at the end will call it
    }
    
    refreshWorkspace();
});

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == document.getElementById('editModal')) closeEditModal();
    if (event.target == document.getElementById('editDomainModal')) closeEditDomainModal();
    if (event.target == document.getElementById('createDomainModal')) closeCreateDomainModal();

};


