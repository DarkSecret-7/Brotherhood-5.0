/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * NavController handles top navigation, side panel, and shared UI elements.
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
        window.logout = () => window.navController?.logout();
    }
    
    // Get or create singleton instance
    static getInstance() {
        if (!NavController.instance && document.getElementById('side-panel')) {
            NavController.instance = new NavController();
        }
        return NavController.instance;
    }
    
    // Logout function
    logout() {
        authApiService.logout().then(() => {
            window.location.replace('/landing');
            localStorage.clear();
            sessionStorage.clear();
        });
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