const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config/config');

// Создание директории логов
fs.ensureDirSync(config.LOGS_DIR);

// Кастомный формат для логов
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}] ${stack || message}`;
    })
);

// Конфигурация транспортов
const transports = [
    // Консольный вывод
    new winston.transports.Console({
        level: config.LOGGING.level,
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }),
    
    // Файл для всех логов
    new winston.transports.File({
        filename: path.join(config.LOGS_DIR, 'app.log'),
        level: 'info',
        format: customFormat,
        maxsize: parseInt(config.LOGGING.maxSize) * 1024 * 1024, // Конвертация в байты
        maxFiles: config.LOGGING.maxFiles,
        tailable: true
    }),
    
    // Файл только для ошибок
    new winston.transports.File({
        filename: path.join(config.LOGS_DIR, 'error.log'),
        level: 'error',
        format: customFormat,
        maxsize: parseInt(config.LOGGING.maxSize) * 1024 * 1024,
        maxFiles: config.LOGGING.maxFiles,
        tailable: true
    }),
    
    // Файл для отладки (только в dev режиме)
    ...(config.NODE_ENV === 'development' ? [
        new winston.transports.File({
            filename: path.join(config.LOGS_DIR, 'debug.log'),
            level: 'debug',
            format: customFormat,
            maxsize: parseInt(config.LOGGING.maxSize) * 1024 * 1024,
            maxFiles: 2
        })
    ] : [])
];

// Создание основного логгера
const logger = winston.createLogger({
    level: config.LOGGING.level,
    format: customFormat,
    transports,
    exitOnError: false
});

// Добавление методов для различных типов логирования
logger.collection = (message, meta = {}) => {
    logger.info(`[COLLECTION] ${message}`, meta);
};

logger.validation = (message, meta = {}) => {
    logger.debug(`[VALIDATION] ${message}`, meta);
};

logger.parsing = (message, meta = {}) => {
    logger.debug(`[PARSING] ${message}`, meta);
};

logger.upload = (message, meta = {}) => {
    logger.info(`[UPLOAD] ${message}`, meta);
};

logger.performance = (message, meta = {}) => {
    logger.info(`[PERFORMANCE] ${message}`, meta);
};

// Обработка необработанных исключений
logger.exceptions.handle(
    new winston.transports.File({
        filename: path.join(config.LOGS_DIR, 'exceptions.log'),
        format: customFormat
    })
);

// Обработка необработанных промисов
logger.rejections.handle(
    new winston.transports.File({
        filename: path.join(config.LOGS_DIR, 'rejections.log'),
        format: customFormat
    })
);

// Функция для логирования статистики
logger.stats = (stats) => {
    logger.info('System Statistics:', {
        timestamp: new Date().toISOString(),
        ...stats
    });
};

// Функция для логирования производительности
logger.timing = (label, startTime) => {
    const duration = Date.now() - startTime;
    logger.performance(`${label} completed in ${duration}ms`);
    return duration;
};

module.exports = logger;