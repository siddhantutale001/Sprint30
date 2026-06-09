const { pool } = require('../config/database');

const getRoadmap = async (req, res) => {
    const userId = req.user.id;
    const track = req.query.track || 'Full-Stack';
    try {
        const [rows] = await pool.execute(`
            SELECT 
                t.id as task_id,
                t.day_number,
                t.title,
                t.track,
                COALESCE(up.completed, false) as completed
            FROM tasks t
            LEFT JOIN user_progress up 
                ON t.id = up.task_id AND up.user_id = ?
            WHERE t.track = ?
            ORDER BY t.day_number ASC
        `, [userId, track]);

        const completed = rows.filter(r => r.completed).length;
        const total = rows.length;

        res.json({
            tasks: rows,
            stats: {
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
                remaining: total - completed
            }
        });
    } catch (err) {
        console.error('getRoadmap error:', err);
        res.status(500).json({ error: 'Failed to fetch roadmap' });
    }
};

const toggleTask = async (req, res) => {
    const userId = req.user.id;
    const { task_id } = req.body;
    try {
        const [existing] = await pool.execute(
            'SELECT * FROM user_progress WHERE user_id = ? AND task_id = ?',
            [userId, task_id]
        );
        if (existing.length === 0) {
            await pool.execute(
                'INSERT INTO user_progress (user_id, task_id, completed, completed_at) VALUES (?, ?, true, NOW())',
                [userId, task_id]
            );
            return res.json({ completed: true });
        }
        const current = existing[0].completed;
        await pool.execute(
            'UPDATE user_progress SET completed = ?, completed_at = ? WHERE user_id = ? AND task_id = ?',
            [!current, !current ? new Date() : null, userId, task_id]
        );
        res.json({ completed: !current });
    } catch (err) {
        console.error('toggleTask error:', err);
        res.status(500).json({ error: 'Failed to update progress' });
    }
};

module.exports = { getRoadmap, toggleTask };
