const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');

const logger = require('./utils/logger');
const config = require('./config/config');
const VPNAggregator = require('./services/VPNAggregator');
const webRoutes = require('./routes/web');
const apiRoutes = require('./routes/api');
const { rateLimiter } = require('./middleware/rateLimiter');

class VPNConfigServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.vpnAggregator = new VPNAggregator(this.io);
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
        this.setupCronJobs();
    }

    setupMiddleware() {
        // Безопасность и оптимизация
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"]
                }
            }
        }));
        
        this.app.use(compression());
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(rateLimiter);

        // Статические файлы
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Логирование запросов
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        this.app.use('/', webRoutes);
        this.app.use('/api', apiRoutes);
        
        // Обработка ошибок 404
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                message: 'The requested resource does not exist'
            });
        });

        // Глобальный обработчик ошибок
        this.app.use((err, req, res, next) => {
            logger.error('Server error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: config.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);
            
            socket.on('request-stats', () => {
                socket.emit('stats-update', this.vpnAggregator.getStats());
            });

            socket.on('manual-collect', async () => {
                try {
                    await this.vpnAggregator.collectAndProcess();
                    socket.emit('collection-complete', { success: true });
                } catch (error) {
                    socket.emit('collection-complete', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }

    setupCronJobs() {
        // Основной сбор каждые 30 минут
        cron.schedule('*/30 * * * *', async () => {
            logger.info('Starting scheduled VPN config collection...');
            try {
                await this.vpnAggregator.collectAndProcess();
                logger.info('Scheduled collection completed successfully');
            } catch (error) {
                logger.error('Scheduled collection failed:', error);
            }
        });

        // Очистка старых логов каждый день в 2:00
        cron.schedule('0 2 * * *', async () => {
            logger.info('Starting log cleanup...');
            try {
                await this.vpnAggregator.cleanupOldLogs();
                logger.info('Log cleanup completed');
            } catch (error) {
                logger.error('Log cleanup failed:', error);
            }
        });

        // Проверка здоровья системы каждые 5 минут
        cron.schedule('*/5 * * * *', async () => {
            try {
                const stats = this.vpnAggregator.getStats();
                if (stats.lastUpdate && Date.now() - stats.lastUpdate > 3600000) { // 1 час
                    logger.warn('No updates for more than 1 hour - possible issue');
                }
            } catch (error) {
                logger.error('Health check failed:', error);
            }
        });

        logger.info('Cron jobs initialized successfully');
    }

    async start() {
        try {
            // Инициализация агрегатора
            await this.vpnAggregator.initialize();
            
            // Первичный сбор при запуске
            logger.info('Performing initial VPN config collection...');
            await this.vpnAggregator.collectAndProcess();
            
            // Запуск сервера
            const port = config.PORT || 3000;
            this.server.listen(port, () => {
                logger.info(`🚀 VPN Config Aggregator started on port ${port}`);
                logger.info(`📊 Web interface: http://localhost:${port}`);
                logger.info(`🔄 Auto-collection every 30 minutes`);
                console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    VPN Config Aggregator                     ║
║                                                              ║
║  🌐 Web Interface: http://localhost:${port}                    ║
║  📊 Real-time monitoring with Socket.IO                     ║
║  🔄 Auto-collection every 30 minutes                        ║
║  📁 Configs saved to: ${config.OUTPUT_DIR}                     ║
║                                                              ║
║  Features:                                                   ║
║  ✅ Multi-source aggregation                                ║
║  ✅ Dead node filtering                                     ║
║  ✅ Duplicate removal                                       ║
║  ✅ Category separation                                     ║
║  ✅ Backup versioning                                       ║
║  ✅ GitHub/Gist integration                                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
                `);
            });

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async gracefulShutdown() {
        logger.info('Received shutdown signal, starting graceful shutdown...');
        
        this.server.close(() => {
            logger.info('HTTP server closed');
        });

        await this.vpnAggregator.cleanup();
        logger.info('VPN Aggregator cleaned up');
        
        process.exit(0);
    }
}

// Создание и запуск сервера
const server = new VPNConfigServer();

// Обработка сигналов завершения
process.on('SIGTERM', () => server.gracefulShutdown());
process.on('SIGINT', () => server.gracefulShutdown());

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Запуск сервера
server.start().catch(error => {
    logger.error('Failed to start application:', error);
    process.exit(1);
});