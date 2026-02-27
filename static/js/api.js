// --- Low-Level API Service (Network Layer) ---
var api = {
    _getHeaders: function() {
        var token = localStorage.getItem('access_token');
        var headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    },
    _handleResponse: function(response) {
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('access_token');
            document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }
        return response;
    },
    fetchSnapshots: function() {
        return fetch(API_BASE + '/snapshots', { headers: this._getHeaders() })
            .then(this._handleResponse)
            .then(function(res) { return res.json(); });
    },
    fetchSnapshot: function(label) {
        return fetch(API_BASE + `/snapshots/${label}/read`, { headers: this._getHeaders() })
            .then(this._handleResponse)
            .then(function(res) { return res.json(); });
    },
    deleteSnapshot: function(label) {
        return fetch(API_BASE + `/snapshots/${label}`, { 
            method: 'DELETE',
            headers: this._getHeaders()
        }).then(this._handleResponse);
    },
    postSaveSnapshot: function(snapshotData) {
        return fetch(API_BASE + '/snapshots', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(snapshotData)
        }).then(this._handleResponse);
    },
    patchSnapshot: function(label, data) {
        return fetch(API_BASE + `/snapshots/${label}`, {
            method: 'PATCH',
            headers: this._getHeaders(),
            body: JSON.stringify(data)
        }).then(this._handleResponse).then(function(res) { return res.json(); });
    },
    exportSnapshot: function(label) {
        // For download, we handle the blob directly in the UI handler usually, 
        // but here we just return the fetch promise which resolves to the response.
        // We don't use _handleResponse because we want the blob, not JSON.
        // But we still want to check status.
        return fetch(API_BASE + `/snapshots/${label}/export`, { 
            headers: this._getHeaders() 
        }).then(function(res) {
            if (res.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
                throw new Error('Unauthorized');
            }
            if (!res.ok) throw new Error('Export failed');
            return res.blob();
        });
    },
    importSnapshot: function(file, overwrite) {
        var formData = new FormData();
        formData.append('file', file);
        
        var url = API_BASE + '/snapshots/import';
        if (overwrite) {
            url += '?overwrite=true';
        }
        
        var headers = this._getHeaders();
        delete headers['Content-Type']; // Let browser set boundary for multipart
        
        return fetch(url, {
            method: 'POST',
            headers: headers,
            body: formData
        }).then(this._handleResponse).then(function(res) { return res.json(); });
    }
};
