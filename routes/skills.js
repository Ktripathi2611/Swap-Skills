const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');

// POST /api/skills — add skill
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { name, category, proficiency, type, description } = req.body;
        if (!name || !category || !type) {
            return res.status(400).json({ error: 'Name, category, and type are required' });
        }
        if (!['teach', 'learn'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "teach" or "learn"' });
        }

        const price_per_session = req.body.price_per_session || null;
        const [result] = await db.query(
            'INSERT INTO skills (user_id, name, category, proficiency, type, description, price_per_session) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.session.userId, name, category, proficiency || 'intermediate', type, description || null, type === 'teach' ? price_per_session : null]
        );

        const [skill] = await db.query('SELECT * FROM skills WHERE id = ?', [result.insertId]);
        res.status(201).json(skill[0]);
    } catch (err) {
        console.error('Add skill error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/skills — list / search / filter
router.get('/', async (req, res) => {
    try {
        const { search, category, type, user_id } = req.query;
        let query = `SELECT s.*, u.username, u.full_name, u.avatar_url 
                      FROM skills s JOIN users u ON s.user_id = u.id WHERE 1=1`;
        const params = [];

        if (search) {
            query += ' AND (s.name LIKE ? OR s.description LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term);
        }
        if (category) {
            query += ' AND s.category = ?';
            params.push(category);
        }
        if (type) {
            query += ' AND s.type = ?';
            params.push(type);
        }
        if (user_id) {
            query += ' AND s.user_id = ?';
            params.push(user_id);
        }

        query += ' ORDER BY s.created_at DESC';
        const [skills] = await db.query(query, params);
        res.json(skills);
    } catch (err) {
        console.error('List skills error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/skills/trending — top skills by request frequency
router.get('/trending', async (req, res) => {
    try {
        const [trending] = await db.query(`
            SELECT s.name, s.category, COUNT(sr.id) AS request_count
            FROM skills s
            LEFT JOIN swap_requests sr ON sr.sender_skill_id = s.id OR sr.receiver_skill_id = s.id
            GROUP BY s.name, s.category
            ORDER BY request_count DESC
            LIMIT 10
        `);
        res.json(trending);
    } catch (err) {
        console.error('Trending error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/skills/:id — edit skill (owner only)
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const [skills] = await db.query('SELECT * FROM skills WHERE id = ?', [req.params.id]);
        if (skills.length === 0) return res.status(404).json({ error: 'Skill not found' });
        if (skills[0].user_id !== req.session.userId) return res.status(403).json({ error: 'Not authorized' });

        const { name, category, proficiency, type, description, price_per_session } = req.body;
        await db.query(
            'UPDATE skills SET name = COALESCE(?, name), category = COALESCE(?, category), proficiency = COALESCE(?, proficiency), type = COALESCE(?, type), description = COALESCE(?, description), price_per_session = ? WHERE id = ?',
            [name, category, proficiency, type, description, price_per_session !== undefined ? price_per_session : skills[0].price_per_session, req.params.id]
        );

        const [updated] = await db.query('SELECT * FROM skills WHERE id = ?', [req.params.id]);
        res.json(updated[0]);
    } catch (err) {
        console.error('Edit skill error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/skills/:id — delete skill (owner only)
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const [skills] = await db.query('SELECT * FROM skills WHERE id = ?', [req.params.id]);
        if (skills.length === 0) return res.status(404).json({ error: 'Skill not found' });
        if (skills[0].user_id !== req.session.userId) return res.status(403).json({ error: 'Not authorized' });

        await db.query('DELETE FROM skills WHERE id = ?', [req.params.id]);
        res.json({ message: 'Skill deleted' });
    } catch (err) {
        console.error('Delete skill error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
