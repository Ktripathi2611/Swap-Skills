const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');
const { requireFeature } = require('../config/features');

// All payment routes require the PAID_LEARNING feature
router.use(requireFeature('PAID_LEARNING'));

// POST /api/payments/create-order — Demo: create a simulated payment
router.post('/create-order', isAuthenticated, async (req, res) => {
    try {
        const { skill_id, instructor_id } = req.body;
        if (!skill_id || !instructor_id) {
            return res.status(400).json({ error: 'skill_id and instructor_id are required' });
        }

        // Can't pay yourself
        if (instructor_id === req.session.userId) {
            return res.status(400).json({ error: 'You cannot pay yourself' });
        }

        // Look up skill and verify it has a price
        const [skills] = await db.query(
            'SELECT * FROM skills WHERE id = ? AND user_id = ? AND type = "teach"',
            [skill_id, instructor_id]
        );
        if (skills.length === 0) {
            return res.status(404).json({ error: 'Teachable skill not found for this instructor' });
        }

        const skill = skills[0];
        const amount = skill.price_per_session;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'This skill does not have a price set (swap only)' });
        }

        // Create payment record
        const txnId = 'DEMO_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const [result] = await db.query(
            'INSERT INTO payments (payer_id, instructor_id, skill_id, amount, currency, transaction_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.session.userId, instructor_id, skill_id, amount, 'INR', txnId, 'created']
        );

        res.status(201).json({
            payment_id: result.insertId,
            transaction_id: txnId,
            amount,
            currency: 'INR',
            skill_name: skill.name,
            status: 'created',
            demo_mode: true
        });
    } catch (err) {
        console.error('Create order error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/payments/verify — Demo: simulate payment verification (always succeeds)
router.post('/verify', isAuthenticated, async (req, res) => {
    try {
        const { payment_id } = req.body;
        if (!payment_id) {
            return res.status(400).json({ error: 'payment_id is required' });
        }

        const [payments] = await db.query('SELECT * FROM payments WHERE id = ? AND payer_id = ?', [payment_id, req.session.userId]);
        if (payments.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const payment = payments[0];
        if (payment.status === 'paid') {
            return res.status(400).json({ error: 'Payment already verified' });
        }

        // Mark as paid (demo — always succeeds)
        await db.query('UPDATE payments SET status = "paid" WHERE id = ?', [payment_id]);

        // Auto-create a paid session
        const [skillRows] = await db.query('SELECT name FROM skills WHERE id = ?', [payment.skill_id]);
        const skillName = skillRows.length > 0 ? skillRows[0].name : 'Learning Session';

        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + 1); // Default: tomorrow
        scheduledAt.setHours(10, 0, 0, 0);

        const [sessionResult] = await db.query(
            `INSERT INTO sessions (payment_id, session_type, host_id, participant_id, title, scheduled_at, duration_minutes, status) 
             VALUES (?, 'paid', ?, ?, ?, ?, 60, 'scheduled')`,
            [payment_id, payment.instructor_id, payment.payer_id, `Paid: ${skillName}`, scheduledAt]
        );

        res.json({
            success: true,
            message: 'Payment verified successfully (Demo Mode)',
            payment_id,
            session_id: sessionResult.insertId,
            demo_mode: true
        });
    } catch (err) {
        console.error('Verify payment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/payments/history — current user's payments (as payer)
router.get('/history', isAuthenticated, async (req, res) => {
    try {
        const [payments] = await db.query(`
            SELECT p.*, s.name AS skill_name, s.category,
                   u.full_name AS instructor_name, u.username AS instructor_username
            FROM payments p
            JOIN skills s ON p.skill_id = s.id
            JOIN users u ON p.instructor_id = u.id
            WHERE p.payer_id = ?
            ORDER BY p.created_at DESC
        `, [req.session.userId]);
        res.json(payments);
    } catch (err) {
        console.error('Payment history error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/payments/earnings — instructor's earnings summary
router.get('/earnings', isAuthenticated, async (req, res) => {
    try {
        const [earnings] = await db.query(`
            SELECT 
                COUNT(*) AS total_paid_sessions,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_earnings,
                COALESCE(SUM(CASE WHEN status = 'paid' AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) THEN amount ELSE 0 END), 0) AS this_month
            FROM payments WHERE instructor_id = ?
        `, [req.session.userId]);

        const [recentPayments] = await db.query(`
            SELECT p.*, s.name AS skill_name,
                   u.full_name AS payer_name
            FROM payments p
            JOIN skills s ON p.skill_id = s.id
            JOIN users u ON p.payer_id = u.id
            WHERE p.instructor_id = ? AND p.status = 'paid'
            ORDER BY p.created_at DESC
            LIMIT 20
        `, [req.session.userId]);

        res.json({
            summary: earnings[0],
            recent: recentPayments
        });
    } catch (err) {
        console.error('Earnings error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
