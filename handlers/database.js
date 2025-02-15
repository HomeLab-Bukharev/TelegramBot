const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function addUser(telegramId, name) {
    await pool.query(
        `INSERT INTO users (telegram_id, name) VALUES ($1, $2) ON CONFLICT (telegram_id) DO NOTHING;`,
        [telegramId, name]
    );
}

async function isAuthorized(telegramId) {
    const res = await pool.query(`SELECT status FROM users WHERE telegram_id = $1`, [telegramId]);
    return res.rows.length > 0 && res.rows[0].status === 'approved';
}

async function logTask(telegramId, url, platform) {
    const res = await pool.query(
        `INSERT INTO tasks (user_id, url, platform) VALUES ($1, $2, $3) RETURNING id;`,
        [telegramId, url, platform]
    );
    return res.rows[0].id;
}

async function updateTaskStatus(taskId, status) {
    await pool.query(`UPDATE tasks SET status = $1 WHERE id = $2;`, [status, taskId]);
}

function detectPlatform(url) {
    const platforms = [
        { name: 'Instagram', domains: ['instagram.com'] },
        { name: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
        { name: 'TikTok', domains: ['tiktok.com'] },
        { name: 'Twitter', domains: ['twitter.com', 'x.com'] },
        { name: 'Facebook', domains: ['facebook.com', 'fb.watch'] }
    ];

    for (const platform of platforms) {
        if (platform.domains.some(domain => url.includes(domain))) {
            return platform.name;
        }
    }
    return 'unknown';
}

module.exports = { pool, addUser, isAuthorized, logTask, updateTaskStatus, detectPlatform };
