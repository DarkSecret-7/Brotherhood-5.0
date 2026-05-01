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
 * Gallery API Service - Public gallery specific endpoints
 * Handles read-only operations for public graph gallery
 */
class GalleryApiService extends BaseApiService {
    
    /**
     * Get all public snapshots for gallery display
     * @param {Object} options - { skip?, limit? }
     */
    async getPublicGallerySnapshots(options = {}) {
        const params = new URLSearchParams();
        if (options.skip) params.append('skip', options.skip);
        if (options.limit) params.append('limit', options.limit);
        
        const endpoint = `/public/snapshots${params.toString() ? '?' + params.toString() : ''}`;
        return await this.get(endpoint);
    }

    /**
     * Get specific public snapshot for gallery viewing
     * @param {string} public_uuid - The public UUID of the snapshot
     */
    async getPublicGallerySnapshot(public_uuid) {
        return await this.get(`/public/snapshots/${public_uuid}`);
    }

    /**
     * Get public snapshot metadata only (for list display)
     * @param {string} public_uuid - The public UUID of the snapshot
     */
    async getPublicGallerySnapshotMetadata(public_uuid) {
        try {
            const snapshot = await this.getPublicGallerySnapshot(public_uuid);
            // Return only metadata, exclude large arrays - no data manipulation
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
        } catch (error) {
            throw new Error(`Failed to get public snapshot metadata: ${error.message}`);
        }
    }
}

// Export singleton instance
const galleryApiService = new GalleryApiService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GalleryApiService, galleryApiService };
} else {
    window.GalleryApiService = GalleryApiService;
    window.galleryApiService = galleryApiService;
}
