// ── Navbar Injection ──────────────────────────
let _navFeatureFlags = null;

async function loadFeatureFlags() {
    if (_navFeatureFlags) return _navFeatureFlags;
    try {
        const res = await fetch('/api/features');
        _navFeatureFlags = await res.json();
    } catch { _navFeatureFlags = {}; }
    return _navFeatureFlags;
}

async function injectNavbar() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const flags = await loadFeatureFlags();

    // Conditionally show Earnings link
    const earningsLink = flags.PAID_LEARNING
        ? `<a href="/earnings.html" class="${currentPage === 'earnings.html' ? 'active' : ''}">Earnings</a>`
        : '';

    const navHTML = `
    <nav class="navbar" id="navbar">
        <a href="/index.html" class="navbar-brand">
            <span class="brand-icon">🔄</span> Skill Swap
        </a>
        <div class="navbar-links" id="navLinks">
            <a href="/index.html" class="${currentPage === 'index.html' ? 'active' : ''}">Home</a>
            <a href="/dashboard.html" class="${currentPage === 'dashboard.html' ? 'active' : ''}">Dashboard</a>
            <a href="/skills.html" class="${currentPage === 'skills.html' ? 'active' : ''}">Skills</a>
            <a href="/requests.html" class="${currentPage === 'requests.html' ? 'active' : ''}">Requests</a>
            <a href="/chat.html" class="${currentPage === 'chat.html' ? 'active' : ''}">Chat</a>
            <a href="/sessions.html" class="${currentPage === 'sessions.html' ? 'active' : ''}">Sessions</a>
            ${earningsLink}
        </div>
        <div class="navbar-actions">
            <div class="theme-toggle" onclick="toggleTheme()" title="Toggle theme"></div>
            <div id="navAuth"></div>
            <button class="mobile-toggle" onclick="document.getElementById('navLinks').classList.toggle('open')">
                <span></span><span></span><span></span>
            </button>
        </div>
    </nav>`;
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    // Scroll effect
    window.addEventListener('scroll', () => {
        document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 30);
    });

    // Auth state
    updateNavAuth();
}

async function updateNavAuth() {
    const navAuth = document.getElementById('navAuth');
    if (!navAuth) return;
    try {
        const user = await getCurrentUser();
        if (user) {
            navAuth.innerHTML = `
                <a href="/profile.html" class="btn btn-sm btn-secondary">${user.full_name || user.username}</a>
                <button class="btn btn-sm btn-danger" onclick="logout()">Logout</button>`;
        } else {
            navAuth.innerHTML = `
                <a href="/login.html" class="btn btn-sm btn-secondary">Login</a>
                <a href="/register.html" class="btn btn-sm btn-primary">Sign Up</a>`;
        }
    } catch {
        navAuth.innerHTML = `
            <a href="/login.html" class="btn btn-sm btn-secondary">Login</a>
            <a href="/register.html" class="btn btn-sm btn-primary">Sign Up</a>`;
    }
}

async function logout() {
    try {
        await api.post('/auth/logout');
        showToast('Logged out successfully', 'success');
        setTimeout(() => window.location.href = '/index.html', 500);
    } catch { showToast('Logout failed', 'error'); }
}

function injectFooter() {
    const footer = `
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div>
                    <div class="footer-brand">🔄 Skill Swap</div>
                    <p>Connect, learn, and grow together. Exchange your skills with passionate learners worldwide.</p>
                    <div class="footer-social">
                        <a href="#" title="Twitter">𝕏</a>
                        <a href="#" title="GitHub">⌨</a>
                        <a href="#" title="LinkedIn">in</a>
                        <a href="#" title="Discord">💬</a>
                    </div>
                </div>
                <div>
                    <h4>Platform</h4>
                    <ul>
                        <li><a href="/skills.html">Browse Skills</a></li>
                        <li><a href="/dashboard.html">Dashboard</a></li>
                        <li><a href="/sessions.html">Sessions</a></li>
                    </ul>
                </div>
                <div>
                    <h4>Account</h4>
                    <ul>
                        <li><a href="/profile.html">My Profile</a></li>
                        <li><a href="/requests.html">Requests</a></li>
                        <li><a href="/chat.html">Messages</a></li>
                    </ul>
                </div>
                <div>
                    <h4>Resources</h4>
                    <ul>
                        <li><a href="#">Help Center</a></li>
                        <li><a href="#">Community</a></li>
                        <li><a href="#">Blog</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2026 Skill Swap. Built with ❤️ for learners everywhere.</p>
            </div>
        </div>
    </footer>`;
    document.body.insertAdjacentHTML('beforeend', footer);
}

document.addEventListener('DOMContentLoaded', () => { injectNavbar(); injectFooter(); });
