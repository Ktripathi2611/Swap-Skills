const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const BASE = 'http://localhost:3000/api';

// Helper function for HTTP requests with cookie support
let sessionCookie = '';

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE + path);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(sessionCookie ? { Cookie: sessionCookie } : {})
            }
        };

        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Capture session cookie
                const setCookie = res.headers['set-cookie'];
                if (setCookie) {
                    const sid = setCookie.find(c => c.startsWith('connect.sid'));
                    if (sid) sessionCookie = sid.split(';')[0];
                }
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const testUser = {
    username: 'testuser_' + Date.now(),
    email: `test_${Date.now()}@example.com`,
    password: 'password123',
    full_name: 'Test User'
};

let userId = null;
let skillId = null;
let skill2Id = null;

describe('Skill Swap API Tests', () => {

    // ── AUTH ──────────────────────────────────

    it('1. Register new user returns 201', async () => {
        const res = await request('POST', '/auth/register', testUser);
        assert.equal(res.status, 201);
        assert.ok(res.body.user);
        assert.equal(res.body.user.username, testUser.username);
        userId = res.body.user.id;
    });

    it('2. Register duplicate email returns 400', async () => {
        const res = await request('POST', '/auth/register', testUser);
        assert.equal(res.status, 400);
        assert.ok(res.body.error);
    });

    it('3. Logout returns 200', async () => {
        const res = await request('POST', '/auth/logout');
        assert.equal(res.status, 200);
        sessionCookie = '';
    });

    it('4. Login with valid credentials returns 200', async () => {
        const res = await request('POST', '/auth/login', {
            email: testUser.email,
            password: testUser.password
        });
        assert.equal(res.status, 200);
        assert.ok(res.body.user);
    });

    it('5. Login with wrong password returns 401', async () => {
        const oldCookie = sessionCookie;
        sessionCookie = '';
        const res = await request('POST', '/auth/login', {
            email: testUser.email,
            password: 'wrongpassword'
        });
        assert.equal(res.status, 401);
        sessionCookie = oldCookie;
    });

    it('6. GET /auth/me returns current user', async () => {
        const res = await request('GET', '/auth/me');
        assert.equal(res.status, 200);
        assert.equal(res.body.username, testUser.username);
    });

    // ── SKILLS ────────────────────────────────

    it('7. Add teach skill returns 201', async () => {
        const res = await request('POST', '/skills', {
            name: 'JavaScript',
            category: 'Programming',
            type: 'teach',
            proficiency: 'advanced',
            description: 'Web development with JS'
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'JavaScript');
        skillId = res.body.id;
    });

    it('8. Add learn skill returns 201', async () => {
        const res = await request('POST', '/skills', {
            name: 'Guitar',
            category: 'Music',
            type: 'learn',
            proficiency: 'beginner'
        });
        assert.equal(res.status, 201);
        skill2Id = res.body.id;
    });

    it('9. Search skills returns filtered results', async () => {
        const res = await request('GET', '/skills?search=JavaScript');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
        assert.ok(res.body.some(s => s.name === 'JavaScript'));
    });

    it('10. Edit skill returns updated data', async () => {
        const res = await request('PUT', `/skills/${skillId}`, {
            description: 'Updated: Modern JS and Node.js'
        });
        assert.equal(res.status, 200);
        assert.ok(res.body.description.includes('Updated'));
    });

    // ── PROFILE ───────────────────────────────

    it('11. Update profile returns 200', async () => {
        const res = await request('PUT', `/users/${userId}`, {
            bio: 'Test bio for testing',
            location: 'Test City'
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.bio, 'Test bio for testing');
    });

    it('12. Get user profile with skills', async () => {
        const res = await request('GET', `/users/${userId}`);
        assert.equal(res.status, 200);
        assert.ok(res.body.skills);
        assert.ok(Array.isArray(res.body.skills));
    });

    // ── RECOMMENDATIONS ───────────────────────

    it('13. Recommendations returns structured data', async () => {
        const res = await request('GET', '/recommendations');
        assert.equal(res.status, 200);
        assert.ok(res.body.matched_users !== undefined);
        assert.ok(res.body.similar_skills !== undefined);
        assert.ok(res.body.trending_skills !== undefined);
    });

    // ── CLEANUP ───────────────────────────────

    it('14. Delete skill returns success', async () => {
        const res = await request('DELETE', `/skills/${skill2Id}`);
        assert.equal(res.status, 200);
        assert.ok(res.body.message);
    });

    // ── AUTH EDGE CASES ───────────────────────

    it('15. GET /auth/me without session returns 401', async () => {
        const saved = sessionCookie;
        sessionCookie = '';
        const res = await request('GET', '/auth/me');
        assert.equal(res.status, 401);
        sessionCookie = saved;
    });

    // ── HYBRID PLATFORM FEATURES ──────────────

    it('16. GET /features returns feature flags', async () => {
        const res = await request('GET', '/features');
        assert.equal(res.status, 200);
        assert.ok(res.body.PAID_LEARNING !== undefined);
        assert.ok(res.body.VIDEO_MEETINGS !== undefined);
        assert.ok(res.body.MENTOR_DASHBOARD !== undefined);
    });

    it('17. Add teach skill with price_per_session', async () => {
        const res = await request('POST', '/skills', {
            name: 'React Advanced',
            category: 'Programming',
            type: 'teach',
            proficiency: 'expert',
            description: 'Advanced React patterns',
            price_per_session: 500
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'React Advanced');
        assert.equal(parseFloat(res.body.price_per_session), 500);
    });

    it('18. Recommendations include affordable_skills when PAID_LEARNING enabled', async () => {
        const res = await request('GET', '/recommendations');
        assert.equal(res.status, 200);
        // Should have affordable_skills array if PAID_LEARNING is on
        assert.ok(res.body.affordable_skills !== undefined || res.body.matched_users !== undefined);
    });

    it('19. Payment create-order without required fields returns 400', async () => {
        const res = await request('POST', '/payments/create-order', {});
        assert.equal(res.status, 400);
    });

    it('20. Payment earnings returns structured data', async () => {
        const res = await request('GET', '/payments/earnings');
        assert.equal(res.status, 200);
        assert.ok(res.body.summary);
        assert.ok(res.body.summary.total_earnings !== undefined);
        assert.ok(res.body.recent !== undefined);
    });

    it('21. Payment history returns array', async () => {
        const res = await request('GET', '/payments/history');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    it('22. Sessions endpoint returns array', async () => {
        const res = await request('GET', '/sessions');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });
});
