const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Получение статистики
router.get('/stats', (req, res) => {
    try {
        const stats = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString(),
            status: 'running'
        };
        res.json(stats);
    } catch (error) {
        logger.error('API stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Ручной запуск сбора
router.post('/collect', async (req, res) => {
    try {
        logger.info('Manual collection requested via API');
        res.json({ message: 'Collection request received' });
    } catch (error) {
        logger.error('API collect error:', error);
        res.status(500).json({ error: 'Failed to start collection' });
    }
});

// Здоровье системы
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

module.exports = router;