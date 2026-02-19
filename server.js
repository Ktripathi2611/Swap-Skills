require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'skillswap_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});
app.use(sessionMiddleware);

// Share session with Socket.IO
io.engine.use(sessionMiddleware);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/reputation', require('./routes/reputation'));

// Feature flags endpoint (for frontend conditional rendering)
const { features } = require('./config/features');
app.get('/api/features', (req, res) => res.json(features));

// ── Socket.IO ──────────────────────────────────────────────
require('./socket/chat')(io);

// ── SPA fallback — serve index.html for non-API routes ─────
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        const page = req.path.substring(1) || 'index.html';
        const filePath = path.join(__dirname, 'public', page.endsWith('.html') ? page : page + '.html');
        res.sendFile(filePath, err => {
            if (err) res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }
});

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────
const { initializeDatabase } = require('./db/connection');
const PORT = process.env.PORT || 3000;

initializeDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`✨ Skill Swap server running on http://localhost:${PORT}`);
    });
});

module.exports = { app, server, io };
