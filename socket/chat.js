const db = require('../db/connection');

module.exports = function (io) {
    io.on('connection', (socket) => {
        console.log('🔌 Socket connected:', socket.id);

        // Join a chat room for a specific swap request
        socket.on('joinRoom', (requestId) => {
            socket.join(`chat_${requestId}`);
            console.log(`Socket ${socket.id} joined room chat_${requestId}`);
        });

        // Handle sending messages
        socket.on('sendMessage', async (data) => {
            try {
                const { requestId, senderId, content } = data;

                if (!requestId || !senderId || !content) return;

                // Save to database
                const [result] = await db.query(
                    'INSERT INTO messages (request_id, sender_id, content) VALUES (?, ?, ?)',
                    [requestId, senderId, content]
                );

                // Fetch the saved message with user info
                const [messages] = await db.query(`
                    SELECT m.*, u.username, u.full_name, u.avatar_url
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = ?
                `, [result.insertId]);

                const savedMessage = messages[0];

                // Broadcast to room
                io.to(`chat_${requestId}`).emit('newMessage', savedMessage);
            } catch (err) {
                console.error('Socket sendMessage error:', err);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Typing indicator
        socket.on('typing', (data) => {
            const { requestId, username } = data;
            socket.to(`chat_${requestId}`).emit('userTyping', { username });
        });

        socket.on('stopTyping', (data) => {
            const { requestId } = data;
            socket.to(`chat_${requestId}`).emit('userStopTyping');
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected:', socket.id);
        });
    });
};
