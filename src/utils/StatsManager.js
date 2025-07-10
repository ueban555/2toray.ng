const logger = require('./logger');

class StatsManager {
    constructor() {
        this.stats = {
            totalCollections: 0,
            successfulCollections: 0,
            failedCollections: 0,
            totalNodes: 0,
            validNodes: 0,
            lastUpdate: null
        };
    }

    async initialize() {
        logger.info('Stats manager initialized');
    }

    async record(data) {
        this.stats.totalCollections++;
        
        if (data.success !== false) {
            this.stats.successfulCollections++;
        } else {
            this.stats.failedCollections++;
        }
        
        if (data.totalNodes) {
            this.stats.totalNodes = data.totalNodes;
        }
        
        if (data.validNodes) {
            this.stats.validNodes = data.validNodes;
        }
        
        this.stats.lastUpdate = Date.now();
        
        logger.info('Stats updated', this.stats);
    }

    getStats() {
        return {
            ...this.stats,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    async cleanup() {
        logger.info('Stats manager cleaned up');
    }
}

module.exports = StatsManager;