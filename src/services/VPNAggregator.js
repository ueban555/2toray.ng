const axios = require('axios');
const yaml = require('yaml');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const _ = require('lodash');
const moment = require('moment');

const config = require('../config/config');
const logger = require('../utils/logger');
const ConfigParser = require('../parsers/ConfigParser');
const NodeValidator = require('../validators/NodeValidator');
const GitHubUploader = require('../uploaders/GitHubUploader');
const CDNUploader = require('../uploaders/CDNUploader');
const StatsManager = require('../utils/StatsManager');
const CacheManager = require('../utils/CacheManager');

class VPNAggregator {
    constructor(socketIO) {
        this.io = socketIO;
        this.parser = new ConfigParser();
        this.validator = new NodeValidator();
        this.githubUploader = new GitHubUploader();
        this.cdnUploader = new CDNUploader();
        this.stats = new StatsManager();
        this.cache = new CacheManager();
        
        this.isCollecting = false;
        this.lastCollection = null;
        this.collectionHistory = [];
        this.processedNodes = new Map();
        this.duplicateHashes = new Set();
        
        this.httpClient = axios.create({
            timeout: config.REQUEST_TIMEOUT,
            headers: config.HTTP_HEADERS,
            maxRedirects: 3,
            validateStatus: (status) => status < 500
        });
        
        // Настройка интерцепторов для логирования и ретраев
        this.setupAxiosInterceptors();
    }

    async initialize() {
        logger.info('Initializing VPN Aggregator...');
        
        // Создание необходимых директорий
        await this.createDirectories();
        
        // Инициализация компонентов
        await this.stats.initialize();
        await this.cache.initialize();
        
        if (config.GITHUB.enabled) {
            await this.githubUploader.initialize();
        }
        
        if (config.CDN.enabled) {
            await this.cdnUploader.initialize();
        }
        
        logger.info('VPN Aggregator initialized successfully');
    }

    async createDirectories() {
        const dirs = [
            config.OUTPUT_DIR,
            config.LOGS_DIR,
            config.BACKUP_DIR,
            config.TEMP_DIR
        ];
        
        for (const dir of dirs) {
            await fs.ensureDir(dir);
        }
    }

    setupAxiosInterceptors() {
        // Интерцептор запросов
        this.httpClient.interceptors.request.use(
            (config) => {
                logger.debug(`Making request to: ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('Request interceptor error:', error);
                return Promise.reject(error);
            }
        );

        // Интерцептор ответов с ретраями
        this.httpClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                const { config: requestConfig, response } = error;
                
                if (!requestConfig._retry) {
                    requestConfig._retry = 0;
                }
                
                if (requestConfig._retry < config.MAX_RETRIES && 
                    (!response || response.status >= 500 || error.code === 'ECONNABORTED')) {
                    
                    requestConfig._retry += 1;
                    const delay = config.RETRY_DELAY * Math.pow(2, requestConfig._retry - 1);
                    
                    logger.warn(`Retrying request to ${requestConfig.url} (attempt ${requestConfig._retry}/${config.MAX_RETRIES}) after ${delay}ms`);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.httpClient(requestConfig);
                }
                
                return Promise.reject(error);
            }
        );
    }

    async collectAndProcess() {
        if (this.isCollecting) {
            logger.warn('Collection already in progress, skipping...');
            return;
        }

        this.isCollecting = true;
        const startTime = Date.now();
        
        try {
            logger.info('Starting VPN config collection and processing...');
            this.emitProgress('collection_start', { timestamp: startTime });

            // Шаг 1: Сбор конфигов из всех источников
            const rawConfigs = await this.collectFromAllSources();
            this.emitProgress('collection_raw', { count: rawConfigs.length });

            // Шаг 2: Парсинг и нормализация
            const parsedNodes = await this.parseConfigs(rawConfigs);
            this.emitProgress('parsing_complete', { count: parsedNodes.length });

            // Шаг 3: Удаление дубликатов
            const uniqueNodes = await this.removeDuplicates(parsedNodes);
            this.emitProgress('duplicates_removed', { 
                before: parsedNodes.length, 
                after: uniqueNodes.length,
                removed: parsedNodes.length - uniqueNodes.length
            });

            // Шаг 4: Валидация нод
            const validNodes = await this.validateNodes(uniqueNodes);
            this.emitProgress('validation_complete', { 
                total: uniqueNodes.length,
                valid: validNodes.length,
                invalid: uniqueNodes.length - validNodes.length
            });

            // Шаг 5: Категоризация и группировка
            const categorizedNodes = await this.categorizeNodes(validNodes);
            this.emitProgress('categorization_complete', { categories: Object.keys(categorizedNodes) });

            // Шаг 6: Генерация конфигов
            const generatedConfigs = await this.generateConfigs(categorizedNodes);
            this.emitProgress('generation_complete', { configs: generatedConfigs.length });

            // Шаг 7: Сохранение локально
            await this.saveConfigsLocally(generatedConfigs);
            this.emitProgress('local_save_complete');

            // Шаг 8: Создание резервных копий
            await this.createBackups(generatedConfigs);
            this.emitProgress('backup_complete');

            // Шаг 9: Загрузка в GitHub/Gist
            if (config.GITHUB.enabled) {
                await this.uploadToGitHub(generatedConfigs);
                this.emitProgress('github_upload_complete');
            }

            // Шаг 10: Загрузка на CDN
            if (config.CDN.enabled) {
                await this.uploadToCDN(generatedConfigs);
                this.emitProgress('cdn_upload_complete');
            }

            // Финализация
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            await this.updateStats({
                timestamp: endTime,
                duration,
                totalSources: config.VPN_SOURCES.filter(s => s.enabled).length,
                rawConfigs: rawConfigs.length,
                parsedNodes: parsedNodes.length,
                uniqueNodes: uniqueNodes.length,
                validNodes: validNodes.length,
                generatedConfigs: generatedConfigs.length
            });

            this.lastCollection = {
                timestamp: endTime,
                duration,
                success: true,
                stats: {
                    sources: rawConfigs.length,
                    parsed: parsedNodes.length,
                    unique: uniqueNodes.length,
                    valid: validNodes.length,
                    configs: generatedConfigs.length
                }
            };

            this.emitProgress('collection_complete', this.lastCollection);
            logger.info(`Collection completed successfully in ${duration}ms`);

        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            this.lastCollection = {
                timestamp: endTime,
                duration,
                success: false,
                error: error.message
            };

            this.emitProgress('collection_error', { error: error.message });
            logger.error('Collection failed:', error);
            throw error;
            
        } finally {
            this.isCollecting = false;
        }
    }

    async collectFromAllSources() {
        const sources = config.VPN_SOURCES.filter(source => source.enabled);
        const results = [];
        
        logger.info(`Collecting from ${sources.length} sources...`);
        
        // Параллельный сбор с ограничением concurrent запросов
        const chunks = _.chunk(sources, 5); // Не более 5 одновременных запросов
        
        for (const chunk of chunks) {
            const promises = chunk.map(async (source) => {
                try {
                    const cacheKey = `source_${crypto.createHash('md5').update(source.url).digest('hex')}`;
                    
                    // Проверка кэша
                    if (config.CACHE.enabled) {
                        const cached = await this.cache.get(cacheKey);
                        if (cached) {
                            logger.debug(`Using cached data for ${source.name}`);
                            return {
                                source,
                                data: cached,
                                fromCache: true
                            };
                        }
                    }

                    logger.debug(`Fetching from ${source.name}: ${source.url}`);
                    const response = await this.httpClient.get(source.url);
                    
                    if (response.status === 200 && response.data) {
                        const data = response.data;
                        
                        // Сохранение в кэш
                        if (config.CACHE.enabled) {
                            await this.cache.set(cacheKey, data);
                        }
                        
                        logger.info(`✅ Successfully collected from ${source.name} (${data.length} chars)`);
                        return {
                            source,
                            data,
                            fromCache: false
                        };
                    } else {
                        logger.warn(`❌ Empty response from ${source.name}`);
                        return null;
                    }
                    
                } catch (error) {
                    logger.error(`❌ Failed to collect from ${source.name}:`, error.message);
                    return null;
                }
            });
            
            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults.filter(Boolean));
            
            // Небольшая задержка между chunk'ами
            if (chunks.indexOf(chunk) < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        logger.info(`Collected data from ${results.length}/${sources.length} sources`);
        return results;
    }

    async parseConfigs(rawConfigs) {
        const allNodes = [];
        
        for (const { source, data } of rawConfigs) {
            try {
                logger.debug(`Parsing config from ${source.name} (${source.type})`);
                const nodes = await this.parser.parse(data, source.type, source);
                
                // Добавление метаданных к нодам
                const enrichedNodes = nodes.map(node => ({
                    ...node,
                    source: source.name,
                    sourceType: source.type,
                    category: source.category,
                    weight: source.weight,
                    parsedAt: Date.now()
                }));
                
                allNodes.push(...enrichedNodes);
                logger.debug(`Parsed ${nodes.length} nodes from ${source.name}`);
                
            } catch (error) {
                logger.error(`Failed to parse config from ${source.name}:`, error.message);
            }
        }
        
        logger.info(`Total parsed nodes: ${allNodes.length}`);
        return allNodes;
    }

    async removeDuplicates(nodes) {
        const uniqueNodes = [];
        const seenHashes = new Set();
        let duplicateCount = 0;
        
        for (const node of nodes) {
            // Создание уникального хэша для ноды
            const nodeHash = this.createNodeHash(node);
            
            if (!seenHashes.has(nodeHash)) {
                seenHashes.add(nodeHash);
                uniqueNodes.push({
                    ...node,
                    nodeHash
                });
            } else {
                duplicateCount++;
            }
        }
        
        logger.info(`Removed ${duplicateCount} duplicate nodes, ${uniqueNodes.length} unique remaining`);
        return uniqueNodes;
    }

    createNodeHash(node) {
        // Создание хэша на основе критических параметров ноды
        const criticalParams = {
            protocol: node.protocol,
            server: node.server,
            port: node.port,
            id: node.id || node.uuid || node.password,
            path: node.path,
            host: node.host,
            sni: node.sni
        };
        
        const hashString = JSON.stringify(criticalParams, Object.keys(criticalParams).sort());
        return crypto.createHash('sha256').update(hashString).digest('hex').substring(0, 16);
    }

    async validateNodes(nodes) {
        logger.info(`Validating ${nodes.length} nodes...`);
        
        // Разбиение на chunk'и для параллельной обработки
        const chunks = _.chunk(nodes, config.CONCURRENT_CHECKS);
        const validNodes = [];
        let processedCount = 0;
        
        for (const chunk of chunks) {
            const promises = chunk.map(async (node) => {
                try {
                    const isValid = await this.validator.validate(node);
                    processedCount++;
                    
                    if (processedCount % 50 === 0) {
                        this.emitProgress('validation_progress', {
                            processed: processedCount,
                            total: nodes.length,
                            percentage: Math.round((processedCount / nodes.length) * 100)
                        });
                    }
                    
                    if (isValid) {
                        return {
                            ...node,
                            validatedAt: Date.now(),
                            isValid: true
                        };
                    }
                    return null;
                    
                } catch (error) {
                    logger.debug(`Validation failed for node ${node.server}:${node.port} - ${error.message}`);
                    return null;
                }
            });
            
            const chunkResults = await Promise.all(promises);
            validNodes.push(...chunkResults.filter(Boolean));
        }
        
        logger.info(`Validation complete: ${validNodes.length}/${nodes.length} nodes are valid`);
        return validNodes;
    }

    async categorizeNodes(nodes) {
        const categorized = {};
        
        // Инициализация категорий
        for (const [key, category] of Object.entries(config.CATEGORIES)) {
            categorized[key] = [];
        }
        
        for (const node of nodes) {
            // Добавление в категорию "all"
            categorized.all.push(node);
            
            // Добавление в протокол-специфичные категории
            for (const [categoryKey, category] of Object.entries(config.CATEGORIES)) {
                if (categoryKey === 'all') continue;
                
                // Проверка протокола
                if (category.protocols && category.protocols.includes(node.protocol)) {
                    // Проверка минимального веса для premium категории
                    if (category.minWeight && node.weight < category.minWeight) {
                        continue;
                    }
                    
                    categorized[categoryKey].push(node);
                }
            }
        }
        
        // Логирование статистики по категориям
        for (const [key, nodes] of Object.entries(categorized)) {
            logger.info(`Category '${key}': ${nodes.length} nodes`);
        }
        
        return categorized;
    }

    async generateConfigs(categorizedNodes) {
        const generatedConfigs = [];
        
        for (const [categoryKey, nodes] of Object.entries(categorizedNodes)) {
            if (nodes.length === 0) continue;
            
            const category = config.CATEGORIES[categoryKey];
            
            try {
                // Сортировка нод по весу (по убыванию)
                const sortedNodes = nodes.sort((a, b) => (b.weight || 0) - (a.weight || 0));
                
                // Генерация Clash конфига
                const clashConfig = this.generateClashConfig(sortedNodes, category);
                
                const configData = {
                    category: categoryKey,
                    categoryInfo: category,
                    filename: category.filename,
                    format: 'clash',
                    content: yaml.stringify(clashConfig),
                    nodeCount: nodes.length,
                    generatedAt: new Date().toISOString(),
                    version: this.generateConfigVersion()
                };
                
                generatedConfigs.push(configData);
                logger.info(`Generated ${categoryKey} config with ${nodes.length} nodes`);
                
            } catch (error) {
                logger.error(`Failed to generate config for category ${categoryKey}:`, error.message);
            }
        }
        
        return generatedConfigs;
    }

    generateClashConfig(nodes, category) {
        const baseConfig = _.cloneDeep(config.OUTPUT.clashFormat);
        
        // Преобразование нод в формат Clash
        const proxies = nodes.map(node => this.convertNodeToClashFormat(node));
        
        // Создание групп прокси
        const proxyGroups = [
            {
                name: 'PROXY',
                type: 'select',
                proxies: ['Auto', 'Manual', 'DIRECT'].concat(proxies.map(p => p.name))
            },
            {
                name: 'Auto',
                type: 'url-test',
                proxies: proxies.map(p => p.name),
                url: 'http://www.gstatic.com/generate_204',
                interval: 300
            },
            {
                name: 'Manual',
                type: 'select',
                proxies: proxies.map(p => p.name)
            }
        ];
        
        // Группировка по странам, если есть geo данные
        const countryGroups = this.createCountryGroups(proxies);
        proxyGroups.push(...countryGroups);
        
        return {
            ...baseConfig,
            proxies,
            'proxy-groups': proxyGroups,
            metadata: {
                generatedAt: new Date().toISOString(),
                category: category.name,
                nodeCount: nodes.length,
                version: this.generateConfigVersion()
            }
        };
    }

    convertNodeToClashFormat(node) {
        const common = {
            name: this.generateProxyName(node),
            server: node.server,
            port: parseInt(node.port)
        };
        
        switch (node.protocol) {
            case 'vmess':
                return {
                    ...common,
                    type: 'vmess',
                    uuid: node.id || node.uuid,
                    alterId: parseInt(node.aid || node.alterId || 0),
                    cipher: node.cipher || 'auto',
                    network: node.net || node.network || 'tcp',
                    tls: node.tls === 'tls' || node.tls === true,
                    'skip-cert-verify': true,
                    ...(node.path && { 'ws-opts': { path: node.path } }),
                    ...(node.host && { 'ws-opts': { ...common['ws-opts'], headers: { Host: node.host } } })
                };
                
            case 'vless':
                return {
                    ...common,
                    type: 'vless',
                    uuid: node.id || node.uuid,
                    network: node.net || node.network || 'tcp',
                    tls: node.tls === 'tls' || node.tls === true,
                    'skip-cert-verify': true,
                    ...(node.flow && { flow: node.flow }),
                    ...(node.path && { 'ws-opts': { path: node.path } })
                };
                
            case 'trojan':
                return {
                    ...common,
                    type: 'trojan',
                    password: node.password || node.id,
                    sni: node.sni || node.server,
                    'skip-cert-verify': true
                };
                
            case 'shadowsocks':
                return {
                    ...common,
                    type: 'ss',
                    cipher: node.method || node.cipher || 'aes-256-gcm',
                    password: node.password || node.id
                };
                
            default:
                logger.warn(`Unknown protocol: ${node.protocol}`);
                return null;
        }
    }

    generateProxyName(node) {
        const country = node.country || 'Unknown';
        const city = node.city || '';
        const source = node.source ? node.source.substring(0, 10) : 'Unknown';
        const protocol = node.protocol.toUpperCase();
        const index = Math.random().toString(36).substring(2, 6);
        
        return `${country}${city ? '-' + city : ''} ${protocol} ${source} ${index}`;
    }

    createCountryGroups(proxies) {
        const countryMap = {};
        
        proxies.forEach(proxy => {
            const countryMatch = proxy.name.match(/^([A-Za-z\s]+?)(?:\s|$|-)/);
            const country = countryMatch ? countryMatch[1].trim() : 'Other';
            
            if (!countryMap[country]) {
                countryMap[country] = [];
            }
            countryMap[country].push(proxy.name);
        });
        
        return Object.entries(countryMap)
            .filter(([country, proxies]) => proxies.length >= 2)
            .map(([country, proxies]) => ({
                name: `${country} (${proxies.length})`,
                type: 'url-test',
                proxies,
                url: 'http://www.gstatic.com/generate_204',
                interval: 300
            }));
    }

    generateConfigVersion() {
        return moment().format('YYYYMMDD-HHmmss');
    }

    async saveConfigsLocally(configs) {
        logger.info('Saving configs locally...');
        
        for (const config of configs) {
            const filePath = path.join(config.OUTPUT_DIR, config.filename);
            await fs.writeFile(filePath, config.content, 'utf8');
            logger.debug(`Saved ${config.filename}`);
        }
        
        // Создание индексного файла
        const indexData = {
            lastUpdate: new Date().toISOString(),
            configs: configs.map(c => ({
                category: c.category,
                filename: c.filename,
                nodeCount: c.nodeCount,
                version: c.version
            }))
        };
        
        await fs.writeFile(
            path.join(config.OUTPUT_DIR, 'index.json'),
            JSON.stringify(indexData, null, 2),
            'utf8'
        );
        
        logger.info(`Saved ${configs.length} configs locally`);
    }

    async createBackups(configs) {
        const backupDir = path.join(config.BACKUP_DIR, moment().format('YYYY-MM-DD'));
        await fs.ensureDir(backupDir);
        
        for (const configData of configs) {
            const backupPath = path.join(backupDir, configData.filename);
            await fs.writeFile(backupPath, configData.content, 'utf8');
        }
        
        // Очистка старых резервных копий
        await this.cleanupOldBackups();
        
        logger.info(`Created backups in ${backupDir}`);
    }

    async cleanupOldBackups() {
        const backupDirs = await fs.readdir(config.BACKUP_DIR);
        const cutoffDate = moment().subtract(config.BACKUP_RETENTION_DAYS, 'days');
        
        for (const dirName of backupDirs) {
            const dirDate = moment(dirName, 'YYYY-MM-DD');
            if (dirDate.isValid() && dirDate.isBefore(cutoffDate)) {
                const dirPath = path.join(config.BACKUP_DIR, dirName);
                await fs.remove(dirPath);
                logger.debug(`Removed old backup: ${dirName}`);
            }
        }
    }

    async uploadToGitHub(configs) {
        if (!config.GITHUB.enabled) return;
        
        logger.info('Uploading to GitHub...');
        await this.githubUploader.upload(configs);
        logger.info('GitHub upload completed');
    }

    async uploadToCDN(configs) {
        if (!config.CDN.enabled) return;
        
        logger.info('Uploading to CDN...');
        await this.cdnUploader.upload(configs);
        logger.info('CDN upload completed');
    }

    async updateStats(data) {
        await this.stats.record(data);
        this.collectionHistory.push(data);
        
        // Ограничение истории до последних 100 записей
        if (this.collectionHistory.length > 100) {
            this.collectionHistory = this.collectionHistory.slice(-100);
        }
    }

    async cleanupOldLogs() {
        // Реализация очистки старых логов
        logger.info('Cleaning up old logs...');
    }

    getStats() {
        return {
            isCollecting: this.isCollecting,
            lastCollection: this.lastCollection,
            collectionHistory: this.collectionHistory.slice(-10), // Последние 10 записей
            processedNodes: this.processedNodes.size,
            duplicateHashes: this.duplicateHashes.size,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            version: require('../../package.json').version
        };
    }

    emitProgress(event, data) {
        if (this.io) {
            this.io.emit('collection_progress', { event, data, timestamp: Date.now() });
        }
        logger.debug(`Progress: ${event}`, data);
    }

    async cleanup() {
        logger.info('Cleaning up VPN Aggregator...');
        
        if (this.cache) {
            await this.cache.cleanup();
        }
        
        if (this.stats) {
            await this.stats.cleanup();
        }
        
        logger.info('VPN Aggregator cleanup completed');
    }
}

module.exports = VPNAggregator;