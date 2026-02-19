const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');
const { isFeatureEnabled } = require('../config/features');

// GET /api/recommendations — rule-based + content-based recommendations
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        // 1. Users who teach skills the current user wants to learn
        const [matchedUsers] = await db.query(`
            SELECT DISTINCT u.id, u.username, u.full_name, u.avatar_url, u.bio,
                   teach.name AS teaches, learn.name AS user_wants
            FROM skills learn
            JOIN skills teach ON LOWER(teach.name) = LOWER(learn.name) AND teach.type = 'teach'
            JOIN users u ON teach.user_id = u.id
            WHERE learn.user_id = ? AND learn.type = 'learn' AND teach.user_id != ?
            LIMIT 10
        `, [userId, userId]);

        // 2. Similar skills based on category matching
        const [similarSkills] = await db.query(`
            SELECT DISTINCT s.*, u.username, u.full_name, u.avatar_url
            FROM skills s
            JOIN users u ON s.user_id = u.id
            WHERE s.category IN (
                SELECT category FROM skills WHERE user_id = ?
            ) AND s.user_id != ? AND s.type = 'teach'
            ORDER BY s.created_at DESC
            LIMIT 10
        `, [userId, userId]);

        // 3. Trending skills by request frequency
        const [trending] = await db.query(`
            SELECT s.name, s.category, COUNT(sr.id) AS request_count
            FROM skills s
            LEFT JOIN swap_requests sr ON sr.sender_skill_id = s.id OR sr.receiver_skill_id = s.id
            GROUP BY s.name, s.category
            ORDER BY request_count DESC
            LIMIT 10
        `);

        const result = {
            matched_users: matchedUsers,
            similar_skills: similarSkills,
            trending_skills: trending
        };

        // 4. Optional: Affordable paid skills + top instructors
        if (isFeatureEnabled('PAID_LEARNING')) {
            const [affordable] = await db.query(`
                SELECT s.*, u.username, u.full_name, u.avatar_url
                FROM skills s
                JOIN users u ON s.user_id = u.id
                WHERE s.type = 'teach' AND s.price_per_session IS NOT NULL AND s.price_per_session > 0 AND s.user_id != ?
                ORDER BY s.price_per_session ASC
                LIMIT 8
            `, [userId]);

            const [topInstructors] = await db.query(`
                SELECT u.id, u.username, u.full_name, u.avatar_url,
                       u.average_rating, u.mentor_score,
                       COUNT(p.id) AS sessions_taught,
                       COALESCE(SUM(p.amount), 0) AS total_earned
                FROM payments p
                JOIN users u ON p.instructor_id = u.id
                WHERE p.status = 'paid'
                GROUP BY u.id, u.username, u.full_name, u.avatar_url, u.average_rating, u.mentor_score
                ORDER BY ${isFeatureEnabled('REVIEWS_RATINGS') ? 'u.mentor_score DESC, sessions_taught' : 'sessions_taught'} DESC
                LIMIT 5
            `);

            result.affordable_skills = affordable;
            result.top_instructors = topInstructors;
        }

        res.json(result);
    } catch (err) {
        console.error('Recommendations error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

