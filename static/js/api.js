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
    fetchSnapshot: function(id) {
        return fetch(API_BASE + '/snapshots/' + id, { headers: this._getHeaders() })
            .then(this._handleResponse)
            .then(function(res) { return res.json(); });
    },
    deleteSnapshot: function(id) {
        return fetch(API_BASE + '/snapshots/' + id, { 
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
    postSimplifyPrerequisites: function(expression, currentNodeId, contextNodes) {
        return fetch(API_BASE + '/draft/simplify-prerequisites', {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({ 
                expression: expression, 
                current_node_id: currentNodeId,
                context_nodes: contextNodes 
            })
        }).then(this._handleResponse).then(function(res) { return res.json(); });
    }
};
