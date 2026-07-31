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
 * Settings API Service - User-scoped key/value settings endpoint
 *
 * Wraps GET /api/v1/dashboard/settings and POST /api/v1/dashboard/settings. Used by the
 * Settings dashboard page to read and persist per-user preferences
 * (currently `dark_mode`).
 *
 * Architecture: Controller → Transformer → SettingsApiService → Backend.
 */
class SettingsApiService extends BaseApiService {

    /**
     * Get the full set of persisted settings for the current user.
     * Returns the raw `{ settings: { key: value, ... } }` object as delivered by the backend
     *
     * @returns {Promise<{settings: Object<string, string>}>}
     */
    async getSettings() {
        return await this.get('/dashboard/settings');
    }

    /**
     * Bulk-upsert settings for the current user. The backend enforces
     * its own whitelist; unknown keys are rejected with 400.
     *
     * @param {Object<string, string|number|boolean>} settings
     * @returns {Promise<{settings: Object<string, string>}>} Updated map
     */
    async bulkUpsertSettings(settings) {
        // Backend requires string values. Coerce client-side so the
        // call site can pass booleans/numbers without thinking about it.
        const stringified = {};
        for (const [key, value] of Object.entries(settings || {})) {
            stringified[key] = value === null || value === undefined
                ? ''
                : String(value);
        }
        return await this.post('/dashboard/settings', { settings: stringified });
    }
}

// Export singleton instance
const settingsApiService = new SettingsApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SettingsApiService, settingsApiService };
} else {
    window.SettingsApiService = SettingsApiService;
    window.settingsApiService = settingsApiService;
}
