const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');
const { isFeatureEnabled } = require('../config/features');

// GET /api/messages/:requestId — chat history for an accepted request
router.get('/:requestId', isAuthenticated, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid request ID' });

        // Verify request exists and user is part of it
        const [requests] = await db.query(
            'SELECT * FROM swap_requests WHERE id = ? AND (sender_id = ? OR receiver_id = ?)',
            [requestId, req.session.userId, req.session.userId]
        );
        if (requests.length === 0) {
            return res.status(404).json({ error: 'Request not found or access denied' });
        }
        if (requests[0].status !== 'accepted') {
            return res.status(403).json({ error: 'Chat is only available for accepted requests' });
        }

        const [messages] = await db.query(`
            SELECT m.*, u.username, u.full_name, u.avatar_url
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.request_id = ?
            ORDER BY m.created_at ASC
        `, [requestId]);

        res.json(messages);
    } catch (err) {
        console.error('Messages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/messages/paid/:paymentId — chat for a paid session (feature-gated)
router.get('/paid/:paymentId', isAuthenticated, async (req, res) => {
    try {
        if (!isFeatureEnabled('PAID_LEARNING')) {
            return res.status(404).json({ error: 'Feature not enabled' });
        }

        const [payments] = await db.query(
            'SELECT * FROM payments WHERE id = ? AND status = "paid" AND (payer_id = ? OR instructor_id = ?)',
            [req.params.paymentId, req.session.userId, req.session.userId]
        );
        if (payments.length === 0) {
            return res.status(404).json({ error: 'Paid session not found or access denied' });
        }

        // Paid messages use negative request_id convention: -paymentId
        const chatKey = -parseInt(req.params.paymentId);
        const [messages] = await db.query(`
            SELECT m.*, u.username, u.full_name, u.avatar_url
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.request_id = ?
            ORDER BY m.created_at ASC
        `, [chatKey]);

        res.json(messages);
    } catch (err) {
        console.error('Paid messages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/messages/:requestId/message/:messageId — delete a single message (own only)
router.delete('/:requestId/message/:messageId', isAuthenticated, async (req, res) => {
    try {
        const [messages] = await db.query(
            'SELECT * FROM messages WHERE id = ? AND request_id = ? AND sender_id = ?',
            [req.params.messageId, req.params.requestId, req.session.userId]
        );
        if (messages.length === 0) {
            return res.status(404).json({ error: 'Message not found or not yours' });
        }

        await db.query('DELETE FROM messages WHERE id = ?', [req.params.messageId]);
        res.json({ message: 'Message deleted' });
    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/messages/:requestId/clear — clear all messages in a conversation (participant only)
router.delete('/:requestId/clear', isAuthenticated, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);

        // Verify user is a participant
        if (requestId > 0) {
            const [requests] = await db.query(
                'SELECT * FROM swap_requests WHERE id = ? AND (sender_id = ? OR receiver_id = ?)',
                [requestId, req.session.userId, req.session.userId]
            );
            if (requests.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
        } else {
            // Paid chat (negative ID)
            const paymentId = -requestId;
            const [payments] = await db.query(
                'SELECT * FROM payments WHERE id = ? AND (payer_id = ? OR instructor_id = ?)',
                [paymentId, req.session.userId, req.session.userId]
            );
            if (payments.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const [result] = await db.query('DELETE FROM messages WHERE request_id = ?', [requestId]);
        res.json({ message: 'Chat cleared', deleted: result.affectedRows });
    } catch (err) {
        console.error('Clear chat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/messages/:requestId/search?q=keyword — search messages in a conversation
router.get('/:requestId/search', isAuthenticated, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const [messages] = await db.query(`
            SELECT m.*, u.username, u.full_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.request_id = ? AND m.content LIKE ?
            ORDER BY m.created_at DESC
            LIMIT 50
        `, [requestId, `%${query}%`]);

        res.json(messages);
    } catch (err) {
        console.error('Search messages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
