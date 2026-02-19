// ── Utility Functions ─────────────────────────

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function showSkeleton(container, count = 3) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'glass-card skeleton skeleton-card';
        s.innerHTML = '<div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div>';
        container.appendChild(s);
    }
}

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function validateForm(fields) {
    for (const [name, value] of Object.entries(fields)) {
        if (!value || !value.toString().trim()) { showToast(`${name} is required`, 'error'); return false; }
    }
    return true;
}

function formatDate(d) { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
function formatTime(d) { return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
function formatDateTime(d) { return `${formatDate(d)} at ${formatTime(d)}`; }

function timeAgo(dateStr) {
    const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    const intervals = [{ l: 'y', s: 31536000 }, { l: 'mo', s: 2592000 }, { l: 'd', s: 86400 }, { l: 'h', s: 3600 }, { l: 'm', s: 60 }];
    for (const { l, s: sec } of intervals) { const c = Math.floor(s / sec); if (c > 0) return `${c}${l} ago`; }
    return 'just now';
}

function debounce(fn, delay = 300) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}
