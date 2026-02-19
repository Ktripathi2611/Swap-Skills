/**
 * Feature Flags — Modular Feature Toggle System
 * 
 * Enable/disable optional platform modules without affecting core swap functionality.
 * All core features (auth, skills, swap, chat, sessions, recommendations) are always on.
 */

const features = {
    // ── Core (always enabled) ──────────────────
    // auth, skills, swap_requests, chat, sessions, recommendations

    // ── Optional Modules ───────────────────────
    PAID_LEARNING: true,       // Allow users to pay for learning sessions
    VIDEO_MEETINGS: true,      // Meeting link support in sessions
    MENTOR_DASHBOARD: true,    // Earnings page for instructors
    REVIEWS_RATINGS: true,     // Review, testimonial & reputation system
    ADVANCED_ANALYTICS: false  // Admin analytics (future)
};

/**
 * Check if a feature module is enabled
 * @param {string} featureName - Feature key from the features object
 * @returns {boolean}
 */
function isFeatureEnabled(featureName) {
    return features[featureName] === true;
}

/**
 * Express middleware — blocks route if feature is disabled
 * @param {string} featureName 
 */
function requireFeature(featureName) {
    return (req, res, next) => {
        if (!isFeatureEnabled(featureName)) {
            return res.status(404).json({ error: `Feature "${featureName}" is not enabled` });
        }
        next();
    };
}

module.exports = { features, isFeatureEnabled, requireFeature };
