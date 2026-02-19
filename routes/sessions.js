const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');
const { isFeatureEnabled } = require('../config/features');

// POST /api/sessions — create session (supports both swap and paid types)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { request_id, payment_id, participant_id, title, scheduled_at, duration_minutes, notes, meeting_link } = req.body;

        if (!participant_id || !title || !scheduled_at) {
            return res.status(400).json({ error: 'participant_id, title, and scheduled_at are required' });
        }

        let session_type = 'swap';

        // Case 1: Swap session — needs an accepted request
        if (request_id) {
            const [requests] = await db.query(
                'SELECT * FROM swap_requests WHERE id = ? AND status = "accepted" AND (sender_id = ? OR receiver_id = ?)',
                [request_id, req.session.userId, req.session.userId]
            );
            if (requests.length === 0) {
                return res.status(400).json({ error: 'Invalid or unaccepted request' });
            }
        }
        // Case 2: Paid session — needs a verified payment
        else if (payment_id && isFeatureEnabled('PAID_LEARNING')) {
            const [payments] = await db.query(
                'SELECT * FROM payments WHERE id = ? AND status = "paid" AND (payer_id = ? OR instructor_id = ?)',
                [payment_id, req.session.userId, req.session.userId]
            );
            if (payments.length === 0) {
                return res.status(400).json({ error: 'Invalid or unverified payment' });
            }
            session_type = 'paid';
        }
        // Neither — error
        else {
            return res.status(400).json({ error: 'Either request_id or payment_id is required' });
        }

        const meetLink = (isFeatureEnabled('VIDEO_MEETINGS') && meeting_link) ? meeting_link : null;

        const [result] = await db.query(
            `INSERT INTO sessions (request_id, payment_id, session_type, host_id, participant_id, title, scheduled_at, duration_minutes, meeting_link, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [request_id || null, payment_id || null, session_type, req.session.userId, participant_id, title, scheduled_at, duration_minutes || 60, meetLink, notes || null]
        );

        const [session] = await db.query('SELECT * FROM sessions WHERE id = ?', [result.insertId]);
        res.status(201).json(session[0]);
    } catch (err) {
        console.error('Create session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/sessions — list user's sessions
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const [sessions] = await db.query(`
            SELECT s.*, 
                   h.username AS host_username, h.full_name AS host_name,
                   p.username AS participant_username, p.full_name AS participant_name
            FROM sessions s
            JOIN users h ON s.host_id = h.id
            JOIN users p ON s.participant_id = p.id
            WHERE s.host_id = ? OR s.participant_id = ?
            ORDER BY s.scheduled_at ASC
        `, [req.session.userId, req.session.userId]);

        res.json(sessions);
    } catch (err) {
        console.error('List sessions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/sessions/:id — update session
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const [sessions] = await db.query('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
        if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' });
        if (sessions[0].host_id !== req.session.userId) {
            return res.status(403).json({ error: 'Only the host can update the session' });
        }

        const { title, scheduled_at, duration_minutes, notes, status, meeting_link } = req.body;
        const meetLink = isFeatureEnabled('VIDEO_MEETINGS') ? meeting_link : sessions[0].meeting_link;

        await db.query(
            'UPDATE sessions SET title = COALESCE(?, title), scheduled_at = COALESCE(?, scheduled_at), duration_minutes = COALESCE(?, duration_minutes), notes = COALESCE(?, notes), status = COALESCE(?, status), meeting_link = COALESCE(?, meeting_link) WHERE id = ?',
            [title, scheduled_at, duration_minutes, notes, status, meetLink, req.params.id]
        );

        const [updated] = await db.query('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
        res.json(updated[0]);
    } catch (err) {
        console.error('Update session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/sessions/:id — cancel session
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const [sessions] = await db.query('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
        if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' });
        if (sessions[0].host_id !== req.session.userId && sessions[0].participant_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await db.query('UPDATE sessions SET status = "cancelled" WHERE id = ?', [req.params.id]);
        res.json({ message: 'Session cancelled' });
    } catch (err) {
        console.error('Cancel session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/sessions/paid/:paymentId — remove a paid chat conversation (participant only)
router.delete('/paid/:paymentId', isAuthenticated, async (req, res) => {
    try {
        if (!isFeatureEnabled('PAID_LEARNING')) {
            return res.status(404).json({ error: 'Feature not enabled' });
        }

        // Verify user is the payer or instructor for this payment
        const [payments] = await db.query(
            'SELECT * FROM payments WHERE id = ? AND status = "paid" AND (payer_id = ? OR instructor_id = ?)',
            [req.params.paymentId, req.session.userId, req.session.userId]
        );
        if (payments.length === 0) {
            return res.status(404).json({ error: 'Paid session not found or access denied' });
        }

        // Mark all sessions for this payment as chat_deleted so they won't appear in the sidebar
        await db.query(
            'UPDATE sessions SET status = "chat_deleted" WHERE payment_id = ?',
            [req.params.paymentId]
        );

        res.json({ message: 'Paid conversation deleted' });
    } catch (err) {
        console.error('Delete paid session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

