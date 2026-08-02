/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project Developers
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
 * Settings Controller
 *
 * UI controller for the dashboard Settings page. The HTML structure is
 * declared statically in settings.html; this controller only injects
 * dynamic values (text, classes, disabled states) into the existing DOM
 * nodes. No innerHTML rewrites.
 *
 * Save-driven flow: the toggle mutates a local draft (and flips the
 * visible theme immediately for feedback), and the user must press
 * **Save** to commit the change to the backend.
 *
 * Data flow: Backend → SettingsApiService → SettingsTransformer →
 *            DashboardStateManager → SettingsController (this class).
 */
class SettingsController {
    STORAGE_KEYS = {
        darkMode: 'setting_dark_mode',
    };

    constructor(stateManager) {
        this.stateManager = stateManager;
        this.isSaving = false;

        // Static DOM nodes — resolved once in init() after DOMContentLoaded.
        this._el = null;
    }

    async init() {
        this._resolveElements();
        if (!this._el.container) return;

        this.stateManager.subscribe(this.render.bind(this));
        this.stateManager.subscribe(this.renderDialog.bind(this));

        this.bindEvents();
        await this.loadSettings();
    }

    // -----------------------------------------------------------------
    // DOM element references (resolved once, reused across renders)
    // -----------------------------------------------------------------

    _resolveElements() {
        this._el = {
            container:      document.getElementById('settings-container'),
            loading:        document.getElementById('settings-loading'),
            errorCard:      document.getElementById('settings-error'),
            errorMessage:   document.getElementById('settings-error-message'),
            layout:         document.getElementById('settings-layout'),
            dirtyBadge:     document.getElementById('settings-dirty-badge'),
            toggleBtn:      document.getElementById('settings-dark-mode-btn'),
            toggleLabel:    document.getElementById('settings-dark-mode-label'),
            saveBtn:        document.getElementById('settings-save-btn'),
            discardBtn:     document.getElementById('settings-discard-btn'),
            refreshBtn:     document.getElementById('settings-refresh-btn'),
            saveStatus:     document.getElementById('settings-save-status'),
        };
    }

    // -----------------------------------------------------------------
    // Event wiring (delegate on container so re-renders need no rebind)
    // -----------------------------------------------------------------

    bindEvents() {
        const el = this._el;
        if (!el.container) return;

        el.container.addEventListener('click', (event) => {
            const target = event.target;

            if (target.closest('[data-action="toggle-dark-mode"]')) {
                event.preventDefault();
                this.handleDarkModeToggle();
                return;
            }
            if (target.closest('[data-action="save-settings"]')) {
                event.preventDefault();
                this.handleSave();
                return;
            }
            if (target.closest('[data-action="discard-settings"]')) {
                event.preventDefault();
                this.handleDiscard();
                return;
            }
            if (target.closest('[data-action="refresh-settings"]')) {
                event.preventDefault();
                this.loadSettings();
            }
        });
    }

    // -----------------------------------------------------------------
    // Data loading
    // -----------------------------------------------------------------

    /**
     * Load all settings from the backend, apply the known keys to the
     * document/localStorage, and reset the draft.
     *
     * @returns {Promise<Object>} Frontend-shaped settings object (or null)
     */
    async loadSettings() {   
        this.stateManager.setSettingsLoading(true);
        this.stateManager.setSettingsError(null);
        this.stateManager.setSettingsSaveStatus(null);
        try {
            const backendPayload = await window.settingsApiService.getSettings();
            const frontendSettings = window.settingsTransformer.transformSettingsFromBackend(backendPayload);

            // Apply settings to local storage and state
            this._applySettingsToLocal(frontendSettings);
            this._applySettingsToDocument(frontendSettings);
            this.stateManager.setSettings(frontendSettings);
            
            return frontendSettings;
        } catch (error) {
            console.error('Failed to load settings', error);
            this.stateManager.setSettingsError(
                'Failed to load your settings. Please try refreshing the page.'
            );
            this.render(this.stateManager.getState());
        } finally {
            this.stateManager.setSettingsLoading(false);
        }
    }

    /**
     * Public convenience: load + apply + return without re-throwing.
     * Used by the login flow to sync the device's theme with the
     * server's choice without blocking on a network failure.
     */
    async loadAndSyncSettings() {
        try {
            return await this.loadSettings();
        } catch (e) {
            console.warn('Settings sync with server failed:', e);
            return null;
        }
    }

    /**
     * Apply settings to document attributes separately here.
     * Only applies handpicked keys where applicable.
     * MAY GENERALISE LATER
     * @param {Object|null} frontendSettings - Output of settingsTransformer
     * @private
     */
    _applySettingsToDocument(frontendSettings) {
        try {
            const darkMode = Boolean(frontendSettings.darkMode);
            document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        } catch (e) {
            console.error('Failed to apply settings to document attributes', e);
        }
    }

    /**
     * Apply settings to local storage separately here.
     * Agonostic about keys and does not have logic.
     *
     * @param {Object|null} frontendSettings - Output of settingsTransformer
     * @private
     */
    _applySettingsToLocal(frontendSettings) {
        try {
            Object.keys(this.STORAGE_KEYS).forEach(key => {
                const value = frontendSettings[key];
                const address = this.STORAGE_KEYS[key];
                // Only apply if value is not null or undefined.
                if (value != null) {
                    localStorage.setItem(address, String(value));       // agnostic about value type
                }
            });
        } catch (e) {
            console.error('Failed to apply settings to local storage', e);
        }
    }

    // -----------------------------------------------------------------
    // User actions
    // -----------------------------------------------------------------

    /**
     * Toggle the local draft's darkMode flag.
     * The visible theme is flipped immediately via updateSettingsDraft so
     * the user gets instant feedback, but nothing is sent to the backend
     * until **Save** is pressed.
     */
    handleDarkModeToggle() {
        if (this.isSaving) return;
        const state = this.stateManager.getState();
        if (!state.settingsDraft) return;
        const current = !!state.settingsDraft.darkMode;
        this.stateManager.updateSettingsDraft({ darkMode: !current });
    }

    /**
     * Save the current draft to the backend in one bulk request.
     * On success: replace canonical settings with the server's response,
     * clear the draft, show "Saved". On failure: keep the draft and
     * surface the error inline.
     */
    async handleSave() {
        // Confirmation dialog
        const confirm = await this.stateManager.showConfirm('Are you sure you want to save these settings?');
        if (!confirm) return;

        const state = this.stateManager.getState();
        if (this.isSaving || !state.isSettingsDirty || !state.settingsDraft) return;

        const payload = window.settingsTransformer.transformSettingsToBackend(state.settingsDraft);

        this.isSaving = true;
        this.stateManager.setSettingsSaving(true);
        this.stateManager.setSettingsSaveStatus(null);

        try {
            const response = await window.settingsApiService.bulkUpsertSettings(payload.settings);
            const canonical = window.settingsTransformer.transformSettingsFromBackend(response);
            this.stateManager.acceptSavedSettings(canonical);
        } catch (error) {
            console.error('Failed to save settings', error);
            this.stateManager.setSettingsSaveStatus({
                type: 'err',
                message: 'Failed to save: ' + (error.message || 'Unknown error')
            });
        } finally {
            this.isSaving = false;
            this.stateManager.setSettingsSaving(false);
        }
    }

    /**
     * Revert the draft to the canonical settings. Also reapplies the
     * canonical theme to the document so the toggle's preview is undone.
     */
    async handleDiscard() {
        if (this.isSaving) return;
        // Confirmation dialog
        const confirm = await this.stateManager.showConfirm('Are you sure you want to discard these settings?');
        if (!confirm) return;

        this.stateManager.discardSettingsDraft();
    }

    // -----------------------------------------------------------------
    // Rendering — patch DOM nodes; never wipe the container's innerHTML
    // -----------------------------------------------------------------

    render(state) {
        console.log(state);
        const el = this._el;
        if (!el.container) return;

        const { settings, settingsDraft, isLoadingSettings, isSavingSettings,
                isSettingsDirty, settingsError, settingsSaveStatus } = state;

        // ── Show/hide top-level panels ────────────────────────────────

        // Loading spinner: only on the very first fetch before any data arrives.
        this._toggle(el.loading, isLoadingSettings && !settings && !settingsError);

        // Error panel: first-fetch failure.
        const showError = !!settingsError && !settings;
        this._toggle(el.errorCard, showError);
        if (showError && el.errorMessage) {
            el.errorMessage.textContent = settingsError;
        }

        // Main layout: visible once we have data (or are re-saving with existing data).
        const showLayout = !!settings || (!!settingsDraft && !settingsError);
        this._toggle(el.layout, showLayout);

        if (!showLayout) return;

        // ── Update appearance section ─────────────────────────────────

        const draft    = settingsDraft || settings || { darkMode: false };
        const darkMode = !!draft.darkMode;
        const busy     = isSavingSettings || this.isSaving;

        // Toggle button classes & aria
        if (el.toggleBtn) {
            el.toggleBtn.classList.toggle('is-dark',  darkMode);
            el.toggleBtn.classList.toggle('is-light', !darkMode);
            el.toggleBtn.setAttribute('aria-pressed', darkMode ? 'true' : 'false');
            el.toggleBtn.disabled = busy;
        }

        // Text label next to the pill
        if (el.toggleLabel) {
            el.toggleLabel.textContent = darkMode ? 'Dark mode' : 'Light mode';
        }

        // Dirty badge
        this._toggle(el.dirtyBadge, !!isSettingsDirty);

        // Save / Discard buttons
        if (el.saveBtn) {
            el.saveBtn.disabled = busy || !isSettingsDirty;
            el.saveBtn.textContent = busy ? 'Saving…' : 'Save changes';
        }
        if (el.discardBtn) {
            el.discardBtn.disabled = busy || !isSettingsDirty;
        }
        if (el.refreshBtn) {
            el.refreshBtn.disabled = busy;
        }

        // Save status (ok / err)
        if (el.saveStatus) {
            const hasStatus = !!settingsSaveStatus;
            this._toggle(el.saveStatus, hasStatus);
            if (hasStatus) {
                el.saveStatus.textContent = settingsSaveStatus.message;
                el.saveStatus.className = `settings-save-status settings-save-status-${settingsSaveStatus.type}`;
            }
        }
    }

    /**
     * Show or hide a DOM element with the project's `.hidden` utility class.
     * @param {HTMLElement|null} el
     * @param {boolean} visible
     * @private
     */
    _toggle(el, visible) {
        if (!el) return;
        el.classList.toggle('hidden', !visible);
    }

    // -----------------------------------------------------------------
    // Dialog rendering
    // -----------------------------------------------------------------

    /**
     * Show or hide the shared custom dialog overlay based on
     * `state.dialog.isOpen`. Mirrors the same hook used by the profile
     * controller so the settings page can surface alerts/confirmations.
     */
    renderDialog(state) {
        const overlay   = document.getElementById('custom-dialog-overlay');
        const title     = document.getElementById('dialog-title');
        const message   = document.getElementById('dialog-message');
        const cancelBtn = document.getElementById('dialog-cancel');
        const confirmBtn = document.getElementById('dialog-confirm');

        if (!overlay) return;

        if (state.dialog && state.dialog.isOpen) {
            if (title)   title.textContent   = state.dialog.title;
            if (message) message.textContent = state.dialog.message;
            if (confirmBtn) confirmBtn.textContent = state.dialog.confirmText;

            if (cancelBtn) {
                if (state.dialog.type === 'confirm') {
                    cancelBtn.style.display = 'inline-block';
                    cancelBtn.textContent = state.dialog.cancelText;
                } else {
                    cancelBtn.style.display = 'none';
                }
            }

            overlay.style.display = 'block';
            document.body.style.overflow = 'hidden';
        } else {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SettingsController };
} else {
    window.SettingsController = SettingsController;
}
