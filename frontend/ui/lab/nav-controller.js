/*
 * Navigation Controller
 * Manages navigation between different sections
 */
class NavController {
    constructor() {
        // Only initialize if elements exist and controller hasn't been created
        if (NavController.instance || !document.getElementById('side-panel')) {
            return NavController.instance;
        }
        
        this.initializeElements();
        this.bindEventListeners();
        NavController.instance = this;
    }

    initializeElements() {
        this.elements = {
            sidePanel: document.getElementById('side-panel'),
            sidePanelOverlay: document.getElementById('side-panel-overlay'),
            hamburgerBtn: document.querySelector('.hamburger-btn')
        };
    }

    bindEventListeners() {
        // Close panel when clicking outside (overlay)
        if (this.elements.sidePanelOverlay) {
            this.elements.sidePanelOverlay.addEventListener('click', () => this.closeSidePanel());
        }
        
        // Close panel when clicking close button
        const closeBtn = document.querySelector('.side-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSidePanel());
        }
        
        // Open panel when clicking hamburger menu
        if (this.elements.hamburgerBtn) {
            this.elements.hamburgerBtn.addEventListener('click', () => this.openSidePanel());
        }
        
        // Close panel on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isSidePanelOpen()) {
                this.closeSidePanel();
            }
        });
    }
    
    // Side Panel Navigation Logic

    openSidePanel() {
        if (this.elements.sidePanel) {
            this.elements.sidePanel.classList.add('open');
        }
        if (this.elements.sidePanelOverlay) {
            this.elements.sidePanelOverlay.classList.add('show');
        }
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeSidePanel() {
        if (this.elements.sidePanel) {
            this.elements.sidePanel.classList.remove('open');
        }
        if (this.elements.sidePanelOverlay) {
            this.elements.sidePanelOverlay.classList.remove('show');
        }
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    isSidePanelOpen() {
        return this.elements.sidePanel && this.elements.sidePanel.classList.contains('open');
    }
    
    // Global functions for onclick handlers
    static initGlobalFunctions() {
        window.openSidePanel = () => window.navController?.openSidePanel();
        window.closeSidePanel = () => window.navController?.closeSidePanel();
    }
    
    // Get or create singleton instance
    static getInstance() {
        if (!NavController.instance && document.getElementById('side-panel')) {
            NavController.instance = new NavController();
        }
        return NavController.instance;
    }
}

// Initialize singleton when script loads
document.addEventListener('DOMContentLoaded', () => {
    const controller = NavController.getInstance();
    if (controller && !window.navController) {
        window.navController = controller;
        NavController.initGlobalFunctions();
    }
});