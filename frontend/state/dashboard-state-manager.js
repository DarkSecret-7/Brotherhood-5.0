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
 * Dashboard State Manager
 * Single source of truth for dashboard-related state
 */
class DashboardStateManager {
    constructor() {
        this.state = {
            // Profile
            profile: null,
            profileEditMode: false,
            profileDirty: false,

            // Dialog State
            dialog: {
                isOpen: false,
                type: 'alert', // 'alert', 'confirm'
                title: '',
                message: '',
                confirmText: 'OK',
                cancelText: 'Cancel',
                resolve: null
            }
        };

        this.listeners = [];
    }

    // --- State Access ---
    getState() {
        console.log('Getting state:', this.state);
        
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    // --- Observer Pattern ---
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // --- Business Logic ---
    setProfile(profile) {
        this.setState({ profile, profileDirty: false });
    }

    toggleProfileEditMode(enabled) {
        this.setState({ profileEditMode: enabled });
    }

    // --- Dialog Management ---

    /**
     * Show custom alert dialog
     * @param {string|Object} message - Alert message or options object { title, message }
     * @param {string} title - Dialog title (default: 'Alert')
     * @returns {Promise<void>} Resolves when dialog is closed
     */
    showAlert(message, title = 'Alert') {
        return new Promise((resolve) => {
            // Handle options object format: { title, message }
            const options = typeof message === 'object' ? message : { message, title };

            this.state.dialog = {
                isOpen: true,
                type: 'alert',
                title: options.title || title,
                message: options.message || message,
                confirmText: options.confirmText || 'OK',
                cancelText: options.cancelText || 'Cancel',
                resolve
            };
            this.notify();
        });
    }

    /**
     * Show custom confirm dialog
     * @param {string|Object} message - Confirm message or options object { title, message, confirmText, cancelText }
     * @param {string} title - Dialog title (default: 'Confirm')
     * @param {Object} dialogOptions - Additional options { confirmText, cancelText }
     * @returns {Promise<boolean>} Resolves with true (confirm) or false (cancel)
     */
    showConfirm(message, title = 'Confirm', dialogOptions = {}) {
        return new Promise((resolve) => {
            // Handle options object format: { title, message, confirmText, cancelText }
            const options = typeof message === 'object' ? message : { message, title, ...dialogOptions };

            this.state.dialog = {
                isOpen: true,
                type: 'confirm',
                title: options.title || title,
                message: options.message || message,
                confirmText: options.confirmText || 'OK',
                cancelText: options.cancelText || 'Cancel',
                resolve
            };
            this.notify();
        });
    }

    /**
     * Close dialog and resolve the promise
     * @param {boolean} result - User response (true for confirm/ok, false for cancel)
     */
    closeDialog(result) {
        const { resolve } = this.state.dialog;
        this.state.dialog = {
            ...this.state.dialog,
            isOpen: false,
            resolve: null
        };
        this.notify();
        if (resolve) {
            resolve(result);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardStateManager };
} else {
    window.DashboardStateManager = DashboardStateManager;
}
