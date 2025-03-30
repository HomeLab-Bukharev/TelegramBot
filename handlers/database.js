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

async function updateDownloadSize(taskId, fileSize) {
    await pool.query(`UPDATE tasks SET download_size = $1, updated_at = NOW() WHERE id = $2;`, [fileSize, taskId]);
}

async function updateFinalSize(taskId, fileSize) {
    await pool.query(`UPDATE tasks SET final_size = $1, updated_at = NOW() WHERE id = $2;`, [fileSize, taskId]);
}

async function getUserStats(telegramId) {
    const res = await pool.query(`
        SELECT 
            COUNT(*) AS total_downloads,
            COUNT(CASE WHEN status = 'success' THEN 1 END) AS successful_downloads,
            SUM(CASE WHEN status = 'success' AND final_size IS NOT NULL THEN final_size::float ELSE 0 END) AS total_size,
            MAX(created_at) AS last_download,
            COUNT(DISTINCT platform) AS platforms_used
        FROM tasks
        WHERE user_id = $1;
    `, [telegramId]);
    
    return res.rows[0];
}

async function getPlatformStats(telegramId) {
    const res = await pool.query(`
        SELECT 
            platform,
            COUNT(*) AS downloads,
            COUNT(CASE WHEN status = 'success' THEN 1 END) AS successful
        FROM tasks
        WHERE user_id = $1
        GROUP BY platform
        ORDER BY successful DESC;
    `, [telegramId]);
    
    return res.rows;
}

module.exports = { 
    pool, 
    addUser, 
    isAuthorized, 
    logTask, 
    updateTaskStatus, 
    updateDownloadSize, 
    detectPlatform, 
    updateFinalSize,
    getUserStats,
    getPlatformStats
};