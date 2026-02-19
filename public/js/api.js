// ── API Helper ────────────────────────────────
const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
    };

    try {
        const res = await fetch(url, config);
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 401 && !endpoint.includes('/auth/')) {
                window.location.href = '/login.html';
                return null;
            }
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
    }
}

// Convenience methods
const api = {
    get: (endpoint) => apiRequest(endpoint),
    post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' })
};

// Auth helpers
async function getCurrentUser() {
    try {
        return await api.get('/auth/me');
    } catch {
        return null;
    }
}

async function checkAuth() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return null;
    }
    return user;
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
