const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');

// GET /api/users — list / search users
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT id, username, email, full_name, bio, avatar_url, location, created_at FROM users';
        const params = [];

        if (search) {
            query += ' WHERE username LIKE ? OR full_name LIKE ? OR email LIKE ?';
            const term = `%${search}%`;
            params.push(term, term, term);
        }
        query += ' ORDER BY created_at DESC';

        const [users] = await db.query(query, params);
        res.json(users);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/users/:id — single user profile with skills
router.get('/:id', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, full_name, bio, avatar_url, location, average_rating, mentor_score, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const [skills] = await db.query('SELECT * FROM skills WHERE user_id = ?', [req.params.id]);

        // Review count
        const [reviewCount] = await db.query(
            'SELECT COUNT(*) as count FROM reviews WHERE mentor_id = ? AND is_approved = TRUE',
            [req.params.id]
        );

        res.json({ ...users[0], skills, review_count: reviewCount[0].count });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/users/:id — update own profile
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        if (req.session.userId !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        const { full_name, bio, avatar_url, location } = req.body;
        await db.query(
            'UPDATE users SET full_name = COALESCE(?, full_name), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url), location = COALESCE(?, location) WHERE id = ?',
            [full_name, bio, avatar_url, location, req.params.id]
        );
        const [updated] = await db.query(
            'SELECT id, username, email, full_name, bio, avatar_url, location FROM users WHERE id = ?',
            [req.params.id]
        );
        res.json(updated[0]);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
