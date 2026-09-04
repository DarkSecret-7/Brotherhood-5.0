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
 * Bibliography API Service - read-only access to the global
 * bibliography database.
 *
 * Architecture: Controller → Transformer → BibliographyApiService → Backend.
 *   - The ops controller composes query params and unwraps the
 *     `BibliographySearchResult` envelope into a plain array + total.
 *   - The transformer is not involved for the prototype — the API
 *     already returns hash-based fields in the shape the tray expects.
 */
class BibliographyApiService extends BaseApiService {
    constructor() {
        super();
    }

    /**
     * Search the global bibliography database.
     * @param {Object} params
     * @param {string} [params.query] - Free-text query (title/author).
     * @param {string} [params.bibType] - Optional exact-match type filter.
     * @param {number} [params.limit=50] - Page size (1..200).
     * @param {number} [params.offset=0] - Row offset.
     * @returns {Promise<{items: Array, total: number, limit: number, offset: number}>}
     */
    async searchBibliographies({ query = null, bibType = null, limit = 50, offset = 0 } = {}) {
        const qs = new URLSearchParams();
        if (query && String(query).trim()) qs.set('q', String(query).trim());
        if (bibType && String(bibType).trim()) qs.set('bib_type', String(bibType).trim());
        qs.set('limit', String(limit));
        qs.set('offset', String(offset));
        const qsString = qs.toString();
        return await this.get(`/bibliography/search${qsString ? `?${qsString}` : ''}`);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BibliographyApiService };
} else {
    window.BibliographyApiService = BibliographyApiService;
}
