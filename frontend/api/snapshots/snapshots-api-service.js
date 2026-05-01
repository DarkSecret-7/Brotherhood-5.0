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
 * Snapshots API Service - Graph snapshot endpoints
 * Handles CRUD operations for graph snapshots using UUIDs
 */
class SnapshotsApiService extends BaseApiService {
    
    /**
     * Create new snapshot
     * @param {Object} snapshotData - { version_label, nodes, domains, base_uuid?, redirects? }
     */
    async createSnapshot(snapshotData) {
        return await this.post('/snapshots', snapshotData);
    }

    /**
     * Get user's accessible snapshots
     * @param {Object} options - { skip?, limit? }
     */
    async getUserSnapshots(options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        
        const endpoint = `/snapshots${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Get public snapshots
     * @param {Object} options - { skip?, limit? }
     */
    async getPublicSnapshots(options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        
        const endpoint = `/public/snapshots${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Get specific snapshot by UUID
     * @param {string} snapshotUuid - The snapshot UUID
     * @param {string} action - "read", "fetch", "write", or "delete"
     */
    async getSnapshot(snapshotUuid, action = 'read') {
        return await this.get(`/snapshots/${snapshotUuid}?action=${action}`);
    }

    /**
     * Get public snapshot by UUID
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async getPublicSnapshot(snapshotUuid) {
        return await this.get(`/public/snapshots/${snapshotUuid}`);
    }

    /**
     * Legacy: Get snapshot for reading (backward compatibility)
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async readSnapshot(snapshotUuid) {
        return await this.get(`/snapshots/${snapshotUuid}/read`);
    }

    /**
     * Update snapshot
     * @param {string} snapshotUuid - The snapshot UUID
     * @param {Object} updateData - { version_label?, nodes?, domains?, overwrite?, is_public? }
     */
    async updateSnapshot(snapshotUuid, updateData) {
        return await this.patch(`/snapshots/${snapshotUuid}`, updateData);
    }

    /**
     * Delete snapshot
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async deleteSnapshot(snapshotUuid) {
        return await this.delete(`/snapshots/${snapshotUuid}`);
    }

    /**
     * Export snapshot as file
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async exportSnapshot(snapshotUuid) {
        return await this.download(`/snapshots/${snapshotUuid}/export`);
    }

    /**
     * Import snapshot from file
     * @param {File} file - The .knw file to import
     * @param {boolean} overwrite - Whether to overwrite if exists
     */
    async importSnapshot(file, overwrite = false) {
        return await this.upload('/snapshots/import', file, overwrite);
    }

    /**
     * Check if user has authorization for specific action on snapshot
     * @param {string} snapshotUuid - The snapshot UUID
     * @param {string} action - "read", "fetch", "write", or "delete"
     */
    async checkAuthorization(snapshotUuid, action) {
        try {
            await this.get(`/snapshots/${snapshotUuid}?action=${action}`);
            return true;
        } catch (error) {
            if (error.message.includes('403') || error.message.includes('Unauthorized')) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get snapshot with full graph data for editing
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async fetchSnapshotForEdit(snapshotUuid) {
        return await this.getSnapshot(snapshotUuid, 'fetch');
    }

    /**
     * Get snapshot metadata only (without full graph data)
     * @param {string} snapshotUuid - The snapshot UUID
     */
    async getSnapshotMetadata(snapshotUuid) {
        const snapshot = await this.getSnapshot(snapshotUuid, 'read');
        // Return only metadata, exclude large arrays
        return {
            public_uuid: snapshot.public_uuid,
            base_uuid: snapshot.base_uuid,
            base_graph_label: snapshot.base_graph_label,
            version_label: snapshot.version_label,
            created_at: snapshot.created_at,
            last_updated: snapshot.last_updated,
            is_public: snapshot.is_public,
            authors: snapshot.authors,
            node_count: snapshot.node_count,
            assessable_node_count: snapshot.assessable_node_count
        };
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
