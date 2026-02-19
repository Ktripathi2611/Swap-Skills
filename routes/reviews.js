const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');
const { requireFeature } = require('../config/features');

// All routes gated behind REVIEWS_RATINGS
router.use(requireFeature('REVIEWS_RATINGS'));

// ── Helper: recalculate mentor average rating & reputation ──
async function recalculateMentorStats(mentorId) {
    // Average rating
    const [avgResult] = await db.query(
        'SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews FROM reviews WHERE mentor_id = ? AND is_approved = TRUE',
        [mentorId]
    );
    const avgRating = avgResult[0].avg_rating ? parseFloat(avgResult[0].avg_rating).toFixed(2) : null;
    const totalReviews = avgResult[0].total_reviews || 0;

    // Completion rate
    const [sessionStats] = await db.query(
        `SELECT 
            COUNT(*) as total_sessions,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
         FROM sessions WHERE host_id = ?`,
        [mentorId]
    );
    const totalSessions = sessionStats[0].total_sessions || 0;
    const completedSessions = sessionStats[0].completed || 0;
    const completionRate = totalSessions > 0 ? completedSessions / totalSessions : 0;

    // Response rate
    const [requestStats] = await db.query(
        `SELECT 
            COUNT(*) as total_requests,
            SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
         FROM swap_requests WHERE receiver_id = ?`,
        [mentorId]
    );
    const totalRequests = requestStats[0].total_requests || 0;
    const acceptedRequests = requestStats[0].accepted || 0;
    const responseRate = totalRequests > 0 ? acceptedRequests / totalRequests : 0;

    // Review volume weight (log-based)
    const reviewVolume = totalReviews > 0 ? Math.min(Math.log10(totalReviews + 1) / Math.log10(100), 1) : 0;

    // Experience bonus (more than 10 completed sessions = full bonus)
    const experienceBonus = Math.min(completedSessions / 10, 1);

    // Reputation Score (0-5 scale)
    const score = avgRating
        ? (parseFloat(avgRating) * 0.5) + (completionRate * 5 * 0.2) + (responseRate * 5 * 0.1) + (reviewVolume * 5 * 0.1) + (experienceBonus * 5 * 0.1)
        : null;

    const mentorScore = score ? parseFloat(score.toFixed(2)) : null;

    await db.query(
        'UPDATE users SET average_rating = ?, mentor_score = ? WHERE id = ?',
        [avgRating, mentorScore, mentorId]
    );

    return { avgRating, mentorScore, totalReviews, completionRate, responseRate };
}

// POST /api/reviews — submit a review
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { session_id, rating, comment } = req.body;
        const learnerId = req.session.userId;

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        if (!session_id) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // Verify session exists and is completed
        const [sessions] = await db.query('SELECT * FROM sessions WHERE id = ?', [session_id]);
        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const session = sessions[0];
        if (session.status !== 'completed') {
            return res.status(403).json({ error: 'Can only review completed sessions' });
        }

        // Determine mentor (host) and verify learner is participant
        const mentorId = session.host_id;
        if (session.participant_id !== learnerId) {
            return res.status(403).json({ error: 'Only the learner/participant can leave a review' });
        }

        // Prevent self-review
        if (mentorId === learnerId) {
            return res.status(403).json({ error: 'Cannot review yourself' });
        }

        // Check duplicate
        const [existing] = await db.query('SELECT id FROM reviews WHERE session_id = ?', [session_id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'A review already exists for this session' });
        }

        // Sanitize comment (basic — strip HTML tags)
        const safeComment = comment ? comment.replace(/<[^>]*>/g, '').substring(0, 1000) : null;

        // Insert review
        const [result] = await db.query(
            'INSERT INTO reviews (session_id, mentor_id, learner_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
            [session_id, mentorId, learnerId, rating, safeComment]
        );

        // Recalculate mentor stats
        const stats = await recalculateMentorStats(mentorId);

        res.status(201).json({
            message: 'Review submitted successfully',
            review_id: result.insertId,
            mentor_stats: stats
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'A review already exists for this session' });
        }
        console.error('Submit review error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reviews/mentor/:id — reviews for a mentor (paginated, filterable)
router.get('/mentor/:id', async (req, res) => {
    try {
        const mentorId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const ratingFilter = req.query.rating ? parseInt(req.query.rating) : null;
        const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';

        let whereClause = 'WHERE r.mentor_id = ? AND r.is_approved = TRUE';
        const params = [mentorId];

        if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
            whereClause += ' AND r.rating = ?';
            params.push(ratingFilter);
        }

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reviews r ${whereClause}`, params
        );

        // Get reviews
        const [reviews] = await db.query(`
            SELECT r.*, u.username, u.full_name, u.avatar_url
            FROM reviews r
            JOIN users u ON r.learner_id = u.id
            ${whereClause}
            ORDER BY r.created_at ${sort}
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({
            reviews,
            total: countResult[0].total,
            page,
            totalPages: Math.ceil(countResult[0].total / limit)
        });
    } catch (err) {
        console.error('Get reviews error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reviews/session/:id — review for a specific session
router.get('/session/:id', isAuthenticated, async (req, res) => {
    try {
        const [reviews] = await db.query(`
            SELECT r.*, u.username, u.full_name
            FROM reviews r
            JOIN users u ON r.learner_id = u.id
            WHERE r.session_id = ?
        `, [req.params.id]);

        res.json(reviews.length > 0 ? reviews[0] : null);
    } catch (err) {
        console.error('Get session review error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/reviews/:id — delete own review
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const [reviews] = await db.query(
            'SELECT * FROM reviews WHERE id = ? AND learner_id = ?',
            [req.params.id, req.session.userId]
        );
        if (reviews.length === 0) {
            return res.status(404).json({ error: 'Review not found or not yours' });
        }

        const mentorId = reviews[0].mentor_id;
        await db.query('DELETE FROM reviews WHERE id = ?', [req.params.id]);

        // Recalculate
        await recalculateMentorStats(mentorId);

        res.json({ message: 'Review deleted' });
    } catch (err) {
        console.error('Delete review error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/reviews/:id/moderate — admin approve/reject
router.put('/:id/moderate', isAuthenticated, async (req, res) => {
    try {
        const { is_approved } = req.body;
        const [result] = await db.query(
            'UPDATE reviews SET is_approved = ? WHERE id = ?',
            [is_approved, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Recalculate mentor stats
        const [review] = await db.query('SELECT mentor_id FROM reviews WHERE id = ?', [req.params.id]);
        if (review.length > 0) await recalculateMentorStats(review[0].mentor_id);

        res.json({ message: `Review ${is_approved ? 'approved' : 'rejected'}` });
    } catch (err) {
        console.error('Moderate review error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
module.exports.recalculateMentorStats = recalculateMentorStats;
