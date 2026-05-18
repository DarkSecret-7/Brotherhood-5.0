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
 * Unified Snapshots API Service
 * Handles all snapshot operations through two main endpoints:
 * - Bulk: GET /snapshots (with filters: public_only, metadata_only, skip, limit)
 * - Single: GET /snapshots/{uuid} (with action: read, fetch, assess, write, delete)
 */
class SnapshotsApiService extends BaseApiService {

    // ============== BULK OPERATIONS ==============

    /**
     * Get snapshots list - unified bulk endpoint
     * @param {Object} options - {
     *   skip?: number,
     *   limit?: number,
     *   publicOnly?: boolean - true for public gallery, false for user accessible
     *   action?: string - "read" | "fetch" | "assess" - authorization level required
     *   metadataOnly?: boolean - true to get only metadata (lightweight)
     * }
     */
    async getSnapshots(options = {}) {
        const params = new URLSearchParams();
        if (options.skip !== undefined) params.append('skip', options.skip);
        if (options.limit !== undefined) params.append('limit', options.limit);
        if (options.publicOnly) params.append('public_only', 'true');
        if (options.action) params.append('action', options.action);
        if (options.metadataOnly) params.append('metadata_only', 'true');

        const endpoint = `/snapshots${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    // ============== SINGLE SNAPSHOT OPERATIONS ==============

    /**
     * Get single snapshot - unified endpoint with action parameter
     * @param {string} snapshotUuid - The snapshot UUID
     * @param {Object} options - {
     *   action?: string - "read" | "fetch" | "assess" | "write" | "delete"
     *   public?: boolean - true for public access (skips auth)
     *   metadata_only?: boolean - true for metadata only
     * }
     */
    async getSnapshot(snapshotUuid, options = {}) {
        const params = new URLSearchParams();
        const action = options.action || 'read';
        params.append('action', action);
        if (options.public) params.append('public', 'true');
        if (options.metadataOnly) params.append('metadata_only', 'true');

        return await this.get(`/snapshots/${snapshotUuid}?${params.toString()}`);
    }

    // ============== CONVENIENCE METHODS (using unified endpoints) ==============

    /**
     * Get public snapshots for gallery etc
     * @param {boolean} metadataOnly - true for metadata only (lightweight)
     */
    async getPublicSnapshots(metadataOnly = false) {
        return await this.getSnapshots({ action: 'read', publicOnly: true, metadataOnly: metadataOnly });
    }

    /**
     * Get public snapshot for gallery viewing etc
     * @param {string} snapshotUuid
     */
    async getPublicSnapshot(snapshotUuid) {
        return await this.getSnapshot(snapshotUuid, { action: 'read', public: true });
    }

    /**
     * Get snapshot for learning (requires bookmark)
     * @param {string} snapshotUuid
     */
    async getSnapshotForLearning(snapshotUuid) {
        return await this.getSnapshot(snapshotUuid, { action: 'learn', public: true });
    }

    /**
     * Get snapshot for assessment (requires bookmark)
     * @param {string} snapshotUuid
     */
    async getSnapshotForAssessment(snapshotUuid) {
        return await this.getSnapshot(snapshotUuid, { action: 'assess', public: true });
    }

    /**
     * Get snapshot metadata only
     * @param {string} snapshotUuid
     */
    async getSnapshotMetadata(snapshotUuid) {
        return await this.getSnapshot(snapshotUuid, { action: 'read', metadataOnly: true });
    }

    /**
     * Fetch snapshot for editing
     * @param {string} snapshotUuid
     */
    async fetchSnapshotForEdit(snapshotUuid) {
        return await this.getSnapshot(snapshotUuid, { action: 'fetch' });
    }

    // ============== WRITE OPERATIONS ==============

    /**
     * Create new snapshot
     * @param {Object} snapshotData - { version_label, nodes, domains, base_uuid?, redirects? }
     */
    async createSnapshot(snapshotData) {
        return await this.post('/snapshots', snapshotData);
    }

    /**
     * Update snapshot
     * @param {string} snapshotUuid
     * @param {Object} updateData
     */
    async updateSnapshot(snapshotUuid, updateData) {
        return await this.patch(`/snapshots/${snapshotUuid}`, updateData);
    }

    /**
     * Delete snapshot
     * @param {string} snapshotUuid
     */
    async deleteSnapshot(snapshotUuid) {
        return await this.delete(`/snapshots/${snapshotUuid}`);
    }

    // ============== IMPORT/EXPORT ==============

    /**
     * Export snapshot as file
     * @param {string} snapshotUuid
     */
    async exportSnapshot(snapshotUuid) {
        return await this.download(`/snapshots/${snapshotUuid}/export`);
    }

    /**
     * Import snapshot from file
     * @param {File} file - The .knw file
     * @param {boolean} overwrite
     * @param {string} targetUuid - Target snapshot UUID for overwrite (optional)
     */
    async importSnapshot(file, overwrite = false, targetUuid = null) {
        return await this.upload('/snapshots/import', file, overwrite, targetUuid);
    }

    // ============== AUTHORIZATION CHECK ==============

    /**
     * Check if user has authorization for specific action
     * @param {string} snapshotUuid
     * @param {string} action - "read" | "fetch" | "assess" | "write" | "delete"
     */
    async checkAuthorization(snapshotUuid, action) {
        try {
            await this.getSnapshot(snapshotUuid, { action });
            return true;
        } catch (error) {
            if (error.message.includes('403') || error.message.includes('Unauthorized') || error.message.includes('Not authorized')) {
                return false;
            }
            throw error;
        }
    }
}

// Export singleton instance
const snapshotsApiService = new SnapshotsApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SnapshotsApiService, snapshotsApiService };
} else {
    window.SnapshotsApiService = SnapshotsApiService;
    window.snapshotsApiService = snapshotsApiService;
}
