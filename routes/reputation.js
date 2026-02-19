const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireFeature } = require('../config/features');

// All routes gated behind REVIEWS_RATINGS
router.use(requireFeature('REVIEWS_RATINGS'));

// GET /api/reputation/:userId — reputation score breakdown
router.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // User info
        const [users] = await db.query(
            'SELECT id, full_name, average_rating, mentor_score FROM users WHERE id = ?',
            [userId]
        );
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Review stats
        const [reviewStats] = await db.query(
            'SELECT COUNT(*) as total, AVG(rating) as avg FROM reviews WHERE mentor_id = ? AND is_approved = TRUE',
            [userId]
        );

        // Rating distribution
        const [distribution] = await db.query(`
            SELECT rating, COUNT(*) as count 
            FROM reviews WHERE mentor_id = ? AND is_approved = TRUE
            GROUP BY rating ORDER BY rating DESC
        `, [userId]);

        // Session stats
        const [sessionStats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM sessions WHERE host_id = ?
        `, [userId]);

        // Request stats
        const [requestStats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
            FROM swap_requests WHERE receiver_id = ?
        `, [userId]);

        const totalSessions = sessionStats[0].total || 0;
        const completedSessions = sessionStats[0].completed || 0;
        const totalRequests = requestStats[0].total || 0;
        const acceptedRequests = requestStats[0].accepted || 0;

        // Build distribution map (1-5)
        const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        distribution.forEach(d => { ratingDist[d.rating] = d.count; });

        res.json({
            user: users[0],
            stats: {
                average_rating: reviewStats[0].avg ? parseFloat(reviewStats[0].avg).toFixed(2) : null,
                total_reviews: reviewStats[0].total,
                total_sessions: totalSessions,
                completed_sessions: completedSessions,
                completion_rate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : '0.0',
                response_rate: totalRequests > 0 ? ((acceptedRequests / totalRequests) * 100).toFixed(1) : '0.0',
                reputation_score: users[0].mentor_score
            },
            rating_distribution: ratingDist
        });
    } catch (err) {
        console.error('Reputation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reputation/leaderboard — top mentors by reputation
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const [mentors] = await db.query(`
            SELECT u.id, u.full_name, u.username, u.avatar_url, u.average_rating, u.mentor_score,
                   COUNT(r.id) as review_count
            FROM users u
            LEFT JOIN reviews r ON r.mentor_id = u.id AND r.is_approved = TRUE
            WHERE u.mentor_score IS NOT NULL
            GROUP BY u.id
            ORDER BY u.mentor_score DESC
            LIMIT ?
        `, [limit]);

        res.json(mentors);
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
