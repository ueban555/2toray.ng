const logger = require('../utils/logger');

class CDNUploader {
    constructor() {
        this.enabled = false;
    }

    async initialize() {
        logger.info('CDN uploader initialized (disabled)');
    }

    async upload(configs) {
        if (!this.enabled) {
            logger.info('CDN upload skipped (disabled)');
            return;
        }
        
        logger.info(`Would upload ${configs.length} configs to CDN`);
    }
}

module.exports = CDNUploader;