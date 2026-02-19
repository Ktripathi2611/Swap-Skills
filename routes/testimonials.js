const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { isAuthenticated } = require('../middleware/auth');
const { requireFeature } = require('../config/features');

// All routes gated behind REVIEWS_RATINGS
router.use(requireFeature('REVIEWS_RATINGS'));

// POST /api/testimonials — feature a review as testimonial
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { review_id } = req.body;
        const mentorId = req.session.userId;

        if (!review_id) {
            return res.status(400).json({ error: 'Review ID is required' });
        }

        // Verify review exists and belongs to this mentor
        const [reviews] = await db.query(
            'SELECT * FROM reviews WHERE id = ? AND mentor_id = ? AND is_approved = TRUE',
            [review_id, mentorId]
        );
        if (reviews.length === 0) {
            return res.status(404).json({ error: 'Review not found or not yours to feature' });
        }

        // Check max 5 featured testimonials
        const [countResult] = await db.query(
            'SELECT COUNT(*) as total FROM testimonials WHERE mentor_id = ? AND is_featured = TRUE',
            [mentorId]
        );
        if (countResult[0].total >= 5) {
            return res.status(400).json({ error: 'Maximum 5 featured testimonials allowed. Unfeature one first.' });
        }

        // Check if already featured
        const [existing] = await db.query(
            'SELECT id FROM testimonials WHERE review_id = ? AND mentor_id = ?',
            [review_id, mentorId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'This review is already featured' });
        }

        // Get next priority
        const [maxPriority] = await db.query(
            'SELECT MAX(display_priority) as maxP FROM testimonials WHERE mentor_id = ?',
            [mentorId]
        );
        const nextPriority = (maxPriority[0].maxP || 0) + 1;

        const [result] = await db.query(
            'INSERT INTO testimonials (review_id, mentor_id, display_priority) VALUES (?, ?, ?)',
            [review_id, mentorId, nextPriority]
        );

        res.status(201).json({ message: 'Testimonial featured', testimonial_id: result.insertId });
    } catch (err) {
        console.error('Feature testimonial error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/testimonials/:id — unfeature a testimonial
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const [result] = await db.query(
            'DELETE FROM testimonials WHERE id = ? AND mentor_id = ?',
            [req.params.id, req.session.userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Testimonial not found or not yours' });
        }
        res.json({ message: 'Testimonial removed' });
    } catch (err) {
        console.error('Unfeature testimonial error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/testimonials/mentor/:id — featured testimonials for a mentor
router.get('/mentor/:id', async (req, res) => {
    try {
        const [testimonials] = await db.query(`
            SELECT t.*, r.rating, r.comment, r.created_at as review_date,
                   u.full_name as learner_name, u.avatar_url as learner_avatar
            FROM testimonials t
            JOIN reviews r ON t.review_id = r.id
            JOIN users u ON r.learner_id = u.id
            WHERE t.mentor_id = ? AND t.is_featured = TRUE AND r.is_approved = TRUE
            ORDER BY t.display_priority ASC
        `, [req.params.id]);

        res.json(testimonials);
    } catch (err) {
        console.error('Get testimonials error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/testimonials/:id/priority — reorder testimonial priority
router.put('/:id/priority', isAuthenticated, async (req, res) => {
    try {
        const { display_priority } = req.body;
        const [result] = await db.query(
            'UPDATE testimonials SET display_priority = ? WHERE id = ? AND mentor_id = ?',
            [display_priority, req.params.id, req.session.userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Testimonial not found' });
        }
        res.json({ message: 'Priority updated' });
    } catch (err) {
        console.error('Update priority error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
