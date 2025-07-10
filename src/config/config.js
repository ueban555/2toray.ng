const path = require('path');

const config = {
    // Основные настройки сервера
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Директории для вывода
    OUTPUT_DIR: path.join(__dirname, '../../output'),
    LOGS_DIR: path.join(__dirname, '../../logs'),
    BACKUP_DIR: path.join(__dirname, '../../backups'),
    TEMP_DIR: path.join(__dirname, '../../temp'),
    
    // Настройки сбора данных
    COLLECTION_INTERVAL: 30, // минуты
    REQUEST_TIMEOUT: 15000, // мс
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000, // мс
    
    // Настройки проверки нод
    PING_TIMEOUT: 5000, // мс
    MAX_PING_ATTEMPTS: 3,
    CONCURRENT_CHECKS: 50,
    
    // Настройки фильтрации
    MIN_SPEED_THRESHOLD: 1, // Mbps
    MAX_LATENCY_THRESHOLD: 1000, // мс
    
    // Версионирование
    MAX_BACKUP_VERSIONS: 3,
    BACKUP_RETENTION_DAYS: 7,
    
    // Источники VPN конфигов
    VPN_SOURCES: [
        // Clash конфиги
        {
            name: 'ClashX Free Nodes',
            url: 'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub',
            type: 'clash',
            category: 'mixed',
            enabled: true,
            weight: 1.0
        },
        {
            name: 'Free Clash Configs',
            url: 'https://raw.githubusercontent.com/ripaojiedian/freenode/main/clash',
            type: 'clash',
            category: 'mixed',
            enabled: true,
            weight: 1.0
        },
        {
            name: 'Clash Meta Configs',
            url: 'https://raw.githubusercontent.com/vxiaov/free_proxies/main/clash/clash.provider.yaml',
            type: 'clash',
            category: 'mixed',
            enabled: true,
            weight: 0.8
        },
        
        // V2Ray конфиги
        {
            name: 'V2Ray Free Nodes',
            url: 'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/v2ray.txt',
            type: 'v2ray',
            category: 'v2ray',
            enabled: true,
            weight: 1.0
        },
        {
            name: 'V2Ray Collection',
            url: 'https://raw.githubusercontent.com/ripaojiedian/freenode/main/v2ray',
            type: 'v2ray',
            category: 'v2ray',
            enabled: true,
            weight: 0.9
        },
        
        // Trojan конфиги
        {
            name: 'Trojan Free Nodes',
            url: 'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/trojan.txt',
            type: 'trojan',
            category: 'trojan',
            enabled: true,
            weight: 1.0
        },
        
        // Hysteria конфиги
        {
            name: 'Hysteria Nodes',
            url: 'https://raw.githubusercontent.com/vxiaov/free_proxies/main/hysteria/hysteria.txt',
            type: 'hysteria',
            category: 'hysteria',
            enabled: true,
            weight: 0.7
        },
        
        // ShadowSocks конфиги
        {
            name: 'ShadowSocks Free',
            url: 'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/shadowsocks.txt',
            type: 'shadowsocks',
            category: 'shadowsocks',
            enabled: true,
            weight: 1.0
        },
        
        // Reality конфиги
        {
            name: 'Reality Nodes',
            url: 'https://raw.githubusercontent.com/vxiaov/free_proxies/main/reality/reality.txt',
            type: 'reality',
            category: 'reality',
            enabled: true,
            weight: 0.6
        },
        
        // JSON API источники
        {
            name: 'API Proxy List',
            url: 'https://api.proxyscrape.com/v2/?request=get&protocol=all&timeout=5000&format=json',
            type: 'json_api',
            category: 'mixed',
            enabled: true,
            weight: 0.5
        },
        
        // Дополнительные источники
        {
            name: 'Multi Protocol Collection',
            url: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
            type: 'mixed',
            category: 'mixed',
            enabled: true,
            weight: 0.8
        },
        {
            name: 'High Quality Nodes',
            url: 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt',
            type: 'mixed',
            category: 'premium',
            enabled: true,
            weight: 1.2
        }
    ],
    
    // GitHub интеграция
    GITHUB: {
        enabled: process.env.GITHUB_ENABLED === 'true',
        token: process.env.GITHUB_TOKEN,
        username: process.env.GITHUB_USERNAME,
        repository: process.env.GITHUB_REPOSITORY || 'vpn-configs',
        branch: process.env.GITHUB_BRANCH || 'main',
        commitMessage: 'Auto-update VPN configs',
        gistId: process.env.GITHUB_GIST_ID,
        gistFilename: 'clash-config.yaml'
    },
    
    // CDN настройки
    CDN: {
        enabled: process.env.CDN_ENABLED === 'true',
        provider: process.env.CDN_PROVIDER || 'github_pages', // github_pages, cloudflare, custom
        customUrl: process.env.CDN_CUSTOM_URL,
        cloudflareTokne: process.env.CLOUDFLARE_TOKEN,
        cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID
    },
    
    // Категории для разделения
    CATEGORIES: {
        'all': {
            name: 'All Protocols',
            description: 'Все доступные протоколы',
            filename: 'all-configs.yaml',
            protocols: ['vmess', 'vless', 'trojan', 'shadowsocks', 'hysteria', 'reality']
        },
        'vmess': {
            name: 'VMess Only',
            description: 'Только VMess протокол',
            filename: 'vmess-configs.yaml',
            protocols: ['vmess']
        },
        'vless': {
            name: 'VLESS Only',
            description: 'Только VLESS протокол',
            filename: 'vless-configs.yaml',
            protocols: ['vless']
        },
        'trojan': {
            name: 'Trojan Only',
            description: 'Только Trojan протокол',
            filename: 'trojan-configs.yaml',
            protocols: ['trojan']
        },
        'shadowsocks': {
            name: 'ShadowSocks Only',
            description: 'Только ShadowSocks протокол',
            filename: 'shadowsocks-configs.yaml',
            protocols: ['shadowsocks']
        },
        'hysteria': {
            name: 'Hysteria Only',
            description: 'Только Hysteria протокол',
            filename: 'hysteria-configs.yaml',
            protocols: ['hysteria']
        },
        'reality': {
            name: 'Reality Only',
            description: 'Только Reality протокол',
            filename: 'reality-configs.yaml',
            protocols: ['reality']
        },
        'premium': {
            name: 'Premium Quality',
            description: 'Высококачественные ноды',
            filename: 'premium-configs.yaml',
            protocols: ['vmess', 'vless', 'trojan'],
            minWeight: 1.0
        }
    },
    
    // Настройки логирования
    LOGGING: {
        level: process.env.LOG_LEVEL || 'info',
        maxFiles: 5,
        maxSize: '10m',
        format: process.env.LOG_FORMAT || 'combined'
    },
    
    // Настройки безопасности
    SECURITY: {
        rateLimitWindow: 15 * 60 * 1000, // 15 минут
        rateLimitMax: 100, // запросов на окно
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
        apiKey: process.env.API_KEY,
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
        adminPassword: process.env.ADMIN_PASSWORD
    },
    
    // Настройки мониторинга
    MONITORING: {
        enabled: true,
        healthCheckInterval: 5 * 60 * 1000, // 5 минут
        alertThresholds: {
            errorRate: 0.1, // 10%
            responseTime: 10000, // 10 секунд
            memoryUsage: 0.9 // 90%
        }
    },
    
    // Настройки кэширования
    CACHE: {
        enabled: true,
        ttl: 30 * 60 * 1000, // 30 минут
        maxEntries: 1000,
        checkPeriod: 5 * 60 * 1000 // 5 минут
    },
    
    // Пользовательские заголовки для запросов
    HTTP_HEADERS: {
        'User-Agent': 'VPN-Config-Aggregator/1.0 (+https://github.com/vpn-aggregator)',
        'Accept': 'text/plain,application/yaml,application/json,*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    },
    
    // Настройки выходных файлов
    OUTPUT: {
        clashFormat: {
            'mixed-port': 7890,
            'allow-lan': false,
            'bind-address': '*',
            'mode': 'rule',
            'log-level': 'info',
            'external-controller': '127.0.0.1:9090',
            'dns': {
                'enable': true,
                'ipv6': false,
                'nameserver': ['8.8.8.8', '8.8.4.4', '1.1.1.1'],
                'fallback': ['8.8.8.8', '8.8.4.4'],
                'fallback-filter': {
                    'geoip': true,
                    'ipcidr': ['240.0.0.0/4']
                }
            },
            'rules': [
                'DOMAIN-SUFFIX,google.com,PROXY',
                'DOMAIN-SUFFIX,youtube.com,PROXY',
                'DOMAIN-SUFFIX,facebook.com,PROXY',
                'DOMAIN-SUFFIX,twitter.com,PROXY',
                'DOMAIN-SUFFIX,instagram.com,PROXY',
                'DOMAIN-SUFFIX,telegram.org,PROXY',
                'DOMAIN-SUFFIX,whatsapp.com,PROXY',
                'GEOIP,LAN,DIRECT',
                'GEOIP,CN,DIRECT',
                'MATCH,PROXY'
            ]
        }
    }
};

// Валидация конфигурации
function validateConfig() {
    const errors = [];
    
    if (!config.VPN_SOURCES || config.VPN_SOURCES.length === 0) {
        errors.push('No VPN sources configured');
    }
    
    if (config.GITHUB.enabled && !config.GITHUB.token) {
        errors.push('GitHub integration enabled but no token provided');
    }
    
    if (config.CDN.enabled && config.CDN.provider === 'custom' && !config.CDN.customUrl) {
        errors.push('Custom CDN enabled but no URL provided');
    }
    
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
}

// Экспорт конфигурации
module.exports = config;

// Валидация при загрузке модуля
try {
    validateConfig();
} catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
}