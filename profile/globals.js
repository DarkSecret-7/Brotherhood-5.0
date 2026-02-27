const API_BASE = '/api/v1/auth';

// --- Sidebar Navigation ---
const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
const sections = document.querySelectorAll('.view-section');
sidebarNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const sectionId = item.getAttribute('data-section');
        
        // Switch active nav item
        sidebarNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Switch visible section
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(sectionId).classList.add('active');
    });
});
const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');
if (logoutBtnSidebar) {
    logoutBtnSidebar.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    });
}

// --- API Headers ---
function getHeaders() {
    const token = localStorage.getItem('access_token');
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}