const mysql = require('mysql2');
require('dotenv').config();

// First, create a pool WITHOUT specifying the database — used to create the DB
const initPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0
}).promise();

// Main pool WITH the database selected
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skillswap',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// Auto-create database and tables on startup
async function initializeDatabase() {
    const dbName = process.env.DB_NAME || 'skillswap';
    try {
        await initPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`✅ Database "${dbName}" ready`);

        // Create tables
        const tables = [
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                bio TEXT DEFAULT NULL,
                avatar_url VARCHAR(255) DEFAULT NULL,
                location VARCHAR(100) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.skills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                proficiency ENUM('beginner','intermediate','advanced','expert') DEFAULT 'intermediate',
                type ENUM('teach','learn') NOT NULL,
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.swap_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                receiver_id INT NOT NULL,
                sender_skill_id INT NOT NULL,
                receiver_skill_id INT NOT NULL,
                status ENUM('pending','accepted','rejected') DEFAULT 'pending',
                message TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_skill_id) REFERENCES \`${dbName}\`.skills(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_skill_id) REFERENCES \`${dbName}\`.skills(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                sender_id INT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES \`${dbName}\`.swap_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT DEFAULT NULL,
                payment_id INT DEFAULT NULL,
                session_type ENUM('swap','paid') DEFAULT 'swap',
                host_id INT NOT NULL,
                participant_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                scheduled_at DATETIME NOT NULL,
                duration_minutes INT DEFAULT 60,
                meeting_link VARCHAR(500) DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                status ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (host_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE,
                FOREIGN KEY (participant_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                payer_id INT NOT NULL,
                instructor_id INT NOT NULL,
                skill_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                transaction_id VARCHAR(255) DEFAULT NULL,
                status ENUM('created','paid','failed','refunded') DEFAULT 'created',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (payer_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE,
                FOREIGN KEY (instructor_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE,
                FOREIGN KEY (skill_id) REFERENCES \`${dbName}\`.skills(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                mentor_id INT NOT NULL,
                learner_id INT NOT NULL,
                rating INT NOT NULL,
                comment TEXT,
                is_approved BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id),
                FOREIGN KEY (session_id) REFERENCES \`${dbName}\`.sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (mentor_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE,
                FOREIGN KEY (learner_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE,
                INDEX (mentor_id),
                INDEX (rating)
            )`,
            `CREATE TABLE IF NOT EXISTS \`${dbName}\`.testimonials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                review_id INT NOT NULL,
                mentor_id INT NOT NULL,
                is_featured BOOLEAN DEFAULT TRUE,
                display_priority INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (review_id) REFERENCES \`${dbName}\`.reviews(id) ON DELETE CASCADE,
                FOREIGN KEY (mentor_id) REFERENCES \`${dbName}\`.users(id) ON DELETE CASCADE
            )`
        ];

        for (const sql of tables) {
            await initPool.query(sql);
        }

        // ── Safe ALTER migrations (nullable columns, backward compatible) ──
        const migrations = [
            `ALTER TABLE \`${dbName}\`.skills ADD COLUMN price_per_session DECIMAL(10,2) DEFAULT NULL`,
            `ALTER TABLE \`${dbName}\`.sessions ADD COLUMN session_type ENUM('swap','paid') DEFAULT 'swap'`,
            `ALTER TABLE \`${dbName}\`.sessions ADD COLUMN payment_id INT DEFAULT NULL`,
            `ALTER TABLE \`${dbName}\`.sessions ADD COLUMN meeting_link VARCHAR(500) DEFAULT NULL`,
            `ALTER TABLE \`${dbName}\`.sessions MODIFY COLUMN request_id INT DEFAULT NULL`,
            `ALTER TABLE \`${dbName}\`.users ADD COLUMN mentor_score DECIMAL(4,2) DEFAULT NULL`,
            `ALTER TABLE \`${dbName}\`.users ADD COLUMN average_rating DECIMAL(3,2) DEFAULT NULL`,
            `ALTER TABLE \`${dbName}\`.swap_requests MODIFY COLUMN status ENUM('pending','accepted','rejected','deleted') DEFAULT 'pending'`,
            `ALTER TABLE \`${dbName}\`.sessions MODIFY COLUMN status ENUM('scheduled','completed','cancelled','chat_deleted') DEFAULT 'scheduled'`
        ];

        for (const sql of migrations) {
            try { await initPool.query(sql); } catch (e) {
                // Ignore "Duplicate column" errors — migration already applied
                if (e.errno !== 1060 && e.errno !== 1091) console.warn('Migration note:', e.message);
            }
        }

        console.log('✅ All tables ready');
    } catch (err) {
        console.error('❌ Database init error:', err.message);
        process.exit(1);
    }
}

module.exports = promisePool;
module.exports.initializeDatabase = initializeDatabase;
