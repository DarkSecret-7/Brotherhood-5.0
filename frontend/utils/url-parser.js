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
 * URL Parser Utility - Reusable URL parameter parsing with validation
 * Provides clean separation for URL parameter handling across the application
 */

/**
 * Parse URL parameters with validation and error handling
 * @param {string} [searchString=window.location.search] - Search string to parse (defaults to current URL)
 * @returns {Object} Parsed parameters with validation
 */
function parseUrlParameters(searchString = window.location.search) {
    const params = {};
    
    try {
        const urlParams = new URLSearchParams(searchString);
        
        // Parse graph UUID parameter
        if (urlParams.has('graph')) {
            const graphUuid = urlParams.get('graph');
            if (isValidUuid(graphUuid)) {
                params.graph = graphUuid;
            } else {
                console.warn('Invalid graph UUID parameter:', graphUuid);
            }
        }
    } catch (error) {
        console.error('Error parsing URL parameters:', error);
    }
    
    return params;
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID format
 */
function isValidUuid(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    
    // Basic UUID validation (supports both with and without hyphens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const shortUuidRegex = /^[0-9a-f]{32}$/i;
    
    return uuidRegex.test(uuid) || shortUuidRegex.test(uuid);
}

/**
 * Build URL string from parameters object
 * @param {Object} params - Parameters object
 * @param {string} [baseUrl=window.location.pathname] - Base URL
 * @returns {string} Complete URL with parameters
 */
function buildUrlFromParams(params, baseUrl = window.location.pathname) {
    const urlParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            urlParams.set(key, value);
        }
    });
    
    const paramString = urlParams.toString();
    return paramString ? `${baseUrl}?${paramString}` : baseUrl;
}

/**
 * Update URL parameters without page reload
 * @param {Object} params - New parameters to set
 * @param {boolean} [replaceState=false] - Whether to replace current history entry
 */
function updateUrlParameters(params, replaceState = false) {
    const newUrl = buildUrlFromParams(params);
    
    if (replaceState) {
        window.history.replaceState({}, '', newUrl);
    } else {
        window.history.pushState({}, '', newUrl);
    }
}

/**
 * Get specific parameter value with type conversion
 * @param {string} paramName - Parameter name
 * @param {string} [type='string'] - Expected type ('string', 'number', 'boolean')
 * @param {string} [searchString=window.location.search] - Search string to parse
 * @returns {*} Parameter value or null if not present/invalid
 */
function getUrlParameter(paramName, type = 'string', searchString = window.location.search) {
    try {
        const urlParams = new URLSearchParams(searchString);
        
        if (!urlParams.has(paramName)) {
            return null;
        }
        
        const value = urlParams.get(paramName);
        
        switch (type) {
            case 'number':
                const numValue = parseFloat(value);
                return !isNaN(numValue) ? numValue : null;
                
            case 'boolean':
                return value.toLowerCase() === 'true' || value === '1';
                
            case 'string':
            default:
                return value;
        }
    } catch (error) {
        console.error(`Error getting URL parameter '${paramName}':`, error);
        return null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseUrlParameters,
        isValidUuid,
        buildUrlFromParams,
        updateUrlParameters,
        getUrlParameter
    };
} else {
    window.UrlParser = {
        parseUrlParameters,
        isValidUuid,
        buildUrlFromParams,
        updateUrlParameters,
        getUrlParameter
    };
}
