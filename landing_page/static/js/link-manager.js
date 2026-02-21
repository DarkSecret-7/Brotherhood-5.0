document.addEventListener('DOMContentLoaded', () => {
    // Get the base API/App URL from configuration
    const config = window.AppConfig || {};
    const appUrl = config.APP_URL || 'http://localhost:8000';
    
    // Clean URL to ensure no trailing slash for consistent concatenation
    const cleanAppUrl = appUrl.replace(/\/$/, '');
    
    // Initialize all elements with data-api-path attribute
    const dynamicLinks = document.querySelectorAll('[data-api-path]');
    
    dynamicLinks.forEach(element => {
        const path = element.getAttribute('data-api-path');
        if (path) {
            // Ensure path starts with /
            const cleanPath = path.startsWith('/') ? path : '/' + path;
            const fullUrl = `${cleanAppUrl}${cleanPath}`;
            
            // If it's an anchor tag, set href
            if (element.tagName === 'A') {
                element.href = fullUrl;
            } 
            // If it's a form, set action
            else if (element.tagName === 'FORM') {
                element.action = fullUrl;
            }
        }
    });

    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            const nav = document.getElementById('main-nav');
            if (nav) nav.classList.toggle('active');
        });
    }
});
