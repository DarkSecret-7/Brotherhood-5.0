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
 * Settings Transformer
 *
 * Converts between the backend's `{ settings: { key: value } }` dict
 * wire format and the frontend's strongly-typed settings object.
 * Only the keys known to the UI are surfaced; unknown keys are
 * preserved in `raw` so they can be round-tripped without being
 * silently dropped.
 *
 * Known keys:
 *   - `dark_mode`  ('true' / 'false' string) → `frontendSettings.darkMode` (boolean)
 */
class SettingsTransformer {

    /**
     * Transform the backend `{ settings: { ... } }` envelope (or a bare
     * map) to a frontend settings object.
     *
     * @param {{settings: Object}|Object} backendPayload
     * @returns {{darkMode: boolean, raw: Object}}
     */
    transformSettingsFromBackend(backendPayload) {
        const map = this._extractMap(backendPayload);
        return {
            darkMode: this.parseBoolean(map['dark_mode']),
            raw: map
        };
    }

    /**
     * Build the backend wire payload for a save. The caller passes the
     * strongly-typed frontend object; we re-encode the known keys back
     * to the wire format. Unknown fields in the frontend object are
     * not sent.
     *
     * @param {Object} frontendSettings
     * @returns {{settings: Object<string, string>}}
     */
    transformSettingsToBackend(frontendSettings) {
        const result = {};
        if (frontendSettings && typeof frontendSettings.darkMode === 'boolean') {
            result['dark_mode'] = frontendSettings.darkMode ? 'true' : 'false';
        }
        return { settings: result };
    }

    /**
     * Utils function to parse a string to boolean,
     * will move this to a separate utils script.
     * @param {string} value
     * @returns {boolean|null}
     */
    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return null;
    }

    /**
     * Pull the inner `settings` map out of either a `{ settings: {...} }`
     * envelope or a bare map. Defensive against backend shape changes.
     *
     * @private
     */
    _extractMap(payload) {
        if (!payload) return {};
        if (payload.settings && typeof payload.settings === 'object') {
            return payload.settings;
        }
        if (typeof payload === 'object') {
            return payload;
        }
        return {};
    }
}

// Export singleton instance
const settingsTransformer = new SettingsTransformer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SettingsTransformer, settingsTransformer };
} else {
    window.SettingsTransformer = SettingsTransformer;
    window.settingsTransformer = settingsTransformer;
}
