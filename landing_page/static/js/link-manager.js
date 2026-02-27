document.addEventListener('DOMContentLoaded', () => {
    // Initialize all elements with data-api-path attribute
    const dynamicLinks = document.querySelectorAll('[data-api-path]');
    
    dynamicLinks.forEach(element => {
        const path = element.getAttribute('data-api-path');
        if (path) {
            // Ensure path starts with /
            const cleanPath = path.startsWith('/') ? path : '/' + path;
            
            // If it's an anchor tag, set href
            if (element.tagName === 'A') {
                element.href = cleanPath;
            } 
            // If it's a form, set action
            else if (element.tagName === 'FORM') {
                element.action = cleanPath;
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
