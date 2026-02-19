const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');

// POST /api/requests — send swap request
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { receiver_id, sender_skill_id, receiver_skill_id, message } = req.body;

        if (!receiver_id || !sender_skill_id || !receiver_skill_id) {
            return res.status(400).json({ error: 'receiver_id, sender_skill_id, and receiver_skill_id are required' });
        }
        if (receiver_id === req.session.userId) {
            return res.status(400).json({ error: 'Cannot send request to yourself' });
        }

        // Check for existing pending request
        const [existing] = await db.query(
            'SELECT id FROM swap_requests WHERE sender_id = ? AND receiver_id = ? AND status = "pending"',
            [req.session.userId, receiver_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You already have a pending request with this user' });
        }

        const [result] = await db.query(
            'INSERT INTO swap_requests (sender_id, receiver_id, sender_skill_id, receiver_skill_id, message) VALUES (?, ?, ?, ?, ?)',
            [req.session.userId, receiver_id, sender_skill_id, receiver_skill_id, message || null]
        );

        const [request] = await db.query(`
            SELECT sr.*, 
                   su.username AS sender_username, su.full_name AS sender_name,
                   ru.username AS receiver_username, ru.full_name AS receiver_name,
                   ss.name AS sender_skill_name, rs.name AS receiver_skill_name
            FROM swap_requests sr
            JOIN users su ON sr.sender_id = su.id
            JOIN users ru ON sr.receiver_id = ru.id
            JOIN skills ss ON sr.sender_skill_id = ss.id
            JOIN skills rs ON sr.receiver_skill_id = rs.id
            WHERE sr.id = ?
        `, [result.insertId]);

        res.status(201).json(request[0]);
    } catch (err) {
        console.error('Send request error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/requests — list user's requests (sent & received)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT sr.*, 
                   su.username AS sender_username, su.full_name AS sender_name, su.avatar_url AS sender_avatar,
                   ru.username AS receiver_username, ru.full_name AS receiver_name, ru.avatar_url AS receiver_avatar,
                   ss.name AS sender_skill_name, rs.name AS receiver_skill_name
            FROM swap_requests sr
            JOIN users su ON sr.sender_id = su.id
            JOIN users ru ON sr.receiver_id = ru.id
            JOIN skills ss ON sr.sender_skill_id = ss.id
            JOIN skills rs ON sr.receiver_skill_id = rs.id
            WHERE sr.sender_id = ? OR sr.receiver_id = ?
            ORDER BY sr.created_at DESC
        `, [req.session.userId, req.session.userId]);

        res.json(requests);
    } catch (err) {
        console.error('List requests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/requests/:id/accept
router.put('/:id/accept', isAuthenticated, async (req, res) => {
    try {
        const [requests] = await db.query('SELECT * FROM swap_requests WHERE id = ?', [req.params.id]);
        if (requests.length === 0) return res.status(404).json({ error: 'Request not found' });
        if (requests[0].receiver_id !== req.session.userId) {
            return res.status(403).json({ error: 'Only the receiver can accept' });
        }
        if (requests[0].status !== 'pending') {
            return res.status(400).json({ error: 'Request is not pending' });
        }

        await db.query('UPDATE swap_requests SET status = "accepted" WHERE id = ?', [req.params.id]);
        res.json({ message: 'Request accepted', id: parseInt(req.params.id), status: 'accepted' });
    } catch (err) {
        console.error('Accept error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/requests/:id/reject
router.put('/:id/reject', isAuthenticated, async (req, res) => {
    try {
        const [requests] = await db.query('SELECT * FROM swap_requests WHERE id = ?', [req.params.id]);
        if (requests.length === 0) return res.status(404).json({ error: 'Request not found' });
        if (requests[0].receiver_id !== req.session.userId) {
            return res.status(403).json({ error: 'Only the receiver can reject' });
        }
        if (requests[0].status !== 'pending') {
            return res.status(400).json({ error: 'Request is not pending' });
        }

        await db.query('UPDATE swap_requests SET status = "rejected" WHERE id = ?', [req.params.id]);
        res.json({ message: 'Request rejected', id: parseInt(req.params.id), status: 'rejected' });
    } catch (err) {
        console.error('Reject error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/requests/:id — delete a swap conversation (participant only)
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const [requests] = await db.query(
            'SELECT * FROM swap_requests WHERE id = ? AND (sender_id = ? OR receiver_id = ?)',
            [req.params.id, req.session.userId, req.session.userId]
        );
        if (requests.length === 0) {
            return res.status(404).json({ error: 'Request not found or access denied' });
        }

        // Mark as deleted — keeps the row for data integrity but removes it from the chat list
        await db.query('UPDATE swap_requests SET status = "deleted" WHERE id = ?', [req.params.id]);
        res.json({ message: 'Conversation deleted' });
    } catch (err) {
        console.error('Delete request error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

