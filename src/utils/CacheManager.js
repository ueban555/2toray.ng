const logger = require('./logger');

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.cleanupInterval = null;
    }

    async initialize() {
        logger.info('Cache manager initialized');
        
        // Запуск очистки каждые 5 минут
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    async get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Проверка TTL (30 минут)
        if (Date.now() - item.timestamp > 30 * 60 * 1000) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }

    async set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    cleanup() {
        const now = Date.now();
        const ttl = 30 * 60 * 1000; // 30 минут
        let removed = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > ttl) {
                this.cache.delete(key);
                removed++;
            }
        }
        
        if (removed > 0) {
            logger.debug(`Cache cleanup: removed ${removed} expired entries`);
        }
    }

    clear() {
        this.cache.clear();
        logger.info('Cache cleared');
    }

    async cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

module.exports = CacheManager;