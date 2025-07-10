const yaml = require('yaml');
const _ = require('lodash');
const logger = require('../utils/logger');

class ConfigParser {
    constructor() {
        this.parsers = {
            'clash': this.parseClash.bind(this),
            'v2ray': this.parseV2Ray.bind(this),
            'trojan': this.parseTrojan.bind(this),
            'hysteria': this.parseHysteria.bind(this),
            'reality': this.parseReality.bind(this),
            'shadowsocks': this.parseShadowSocks.bind(this),
            'mixed': this.parseMixed.bind(this),
            'json_api': this.parseJsonApi.bind(this)
        };
    }

    async parse(data, type, source) {
        try {
            if (!this.parsers[type]) {
                throw new Error(`Unsupported parser type: ${type}`);
            }

            const parser = this.parsers[type];
            const nodes = await parser(data, source);
            
            logger.parsing(`Parsed ${nodes.length} nodes from ${source.name} (${type})`);
            return nodes;
            
        } catch (error) {
            logger.error(`Failed to parse config from ${source.name}:`, error);
            return [];
        }
    }

    async parseClash(data, source) {
        const nodes = [];
        
        try {
            // Попытка парсинга как YAML
            let config;
            if (typeof data === 'string') {
                config = yaml.parse(data);
            } else {
                config = data;
            }

            if (config && config.proxies && Array.isArray(config.proxies)) {
                for (const proxy of config.proxies) {
                    const node = this.convertClashProxy(proxy);
                    if (node) {
                        nodes.push(node);
                    }
                }
            }
            
        } catch (error) {
            // Если не получилось как YAML, пробуем построчно
            const lines = data.split('\n');
            for (const line of lines) {
                const node = this.parseSubscriptionLine(line.trim());
                if (node) {
                    nodes.push(node);
                }
            }
        }

        return nodes;
    }

    async parseV2Ray(data, source) {
        const nodes = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            try {
                if (trimmed.startsWith('vmess://')) {
                    const node = this.parseVmessUrl(trimmed);
                    if (node) nodes.push(node);
                } else if (trimmed.startsWith('vless://')) {
                    const node = this.parseVlessUrl(trimmed);
                    if (node) nodes.push(node);
                } else {
                    // Попытка декодирования base64
                    try {
                        const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
                        const node = this.parseSubscriptionLine(decoded);
                        if (node) nodes.push(node);
                    } catch (e) {
                        // Игнорируем ошибки декодирования
                    }
                }
            } catch (error) {
                logger.debug(`Failed to parse line: ${trimmed.substring(0, 50)}...`);
            }
        }
        
        return nodes;
    }

    async parseTrojan(data, source) {
        const nodes = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.startsWith('trojan://')) {
                const node = this.parseTrojanUrl(trimmed);
                if (node) nodes.push(node);
            }
        }
        
        return nodes;
    }

    async parseHysteria(data, source) {
        const nodes = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.startsWith('hysteria://')) {
                const node = this.parseHysteriaUrl(trimmed);
                if (node) nodes.push(node);
            }
        }
        
        return nodes;
    }

    async parseReality(data, source) {
        const nodes = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.startsWith('vless://') && trimmed.includes('reality')) {
                const node = this.parseVlessUrl(trimmed);
                if (node && node.reality) {
                    nodes.push(node);
                }
            }
        }
        
        return nodes;
    }

    async parseShadowSocks(data, source) {
        const nodes = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.startsWith('ss://')) {
                const node = this.parseShadowSocksUrl(trimmed);
                if (node) nodes.push(node);
            }
        }
        
        return nodes;
    }

    async parseMixed(data, source) {
        const nodes = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const node = this.parseSubscriptionLine(trimmed);
            if (node) {
                nodes.push(node);
            }
        }
        
        return nodes;
    }

    async parseJsonApi(data, source) {
        const nodes = [];
        
        try {
            const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
            
            if (Array.isArray(jsonData)) {
                for (const item of jsonData) {
                    const node = this.convertJsonToNode(item);
                    if (node) nodes.push(node);
                }
            } else if (jsonData.proxies && Array.isArray(jsonData.proxies)) {
                for (const proxy of jsonData.proxies) {
                    const node = this.convertJsonToNode(proxy);
                    if (node) nodes.push(node);
                }
            }
        } catch (error) {
            logger.error(`Failed to parse JSON API data: ${error.message}`);
        }
        
        return nodes;
    }

    parseSubscriptionLine(line) {
        if (line.startsWith('vmess://')) {
            return this.parseVmessUrl(line);
        } else if (line.startsWith('vless://')) {
            return this.parseVlessUrl(line);
        } else if (line.startsWith('trojan://')) {
            return this.parseTrojanUrl(line);
        } else if (line.startsWith('ss://')) {
            return this.parseShadowSocksUrl(line);
        } else if (line.startsWith('hysteria://')) {
            return this.parseHysteriaUrl(line);
        }
        
        return null;
    }

    parseVmessUrl(url) {
        try {
            const base64Data = url.replace('vmess://', '');
            const jsonStr = Buffer.from(base64Data, 'base64').toString('utf8');
            const config = JSON.parse(jsonStr);
            
            return {
                protocol: 'vmess',
                server: config.add || config.host,
                port: parseInt(config.port),
                id: config.id,
                uuid: config.id,
                aid: parseInt(config.aid || 0),
                alterId: parseInt(config.aid || 0),
                cipher: config.scy || 'auto',
                network: config.net || 'tcp',
                type: config.type || 'none',
                host: config.host,
                path: config.path,
                tls: config.tls === 'tls',
                sni: config.sni,
                name: config.ps || `${config.add}:${config.port}`,
                country: this.extractCountry(config.ps),
                city: this.extractCity(config.ps)
            };
        } catch (error) {
            logger.debug(`Failed to parse VMess URL: ${error.message}`);
            return null;
        }
    }

    parseVlessUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            
            const node = {
                protocol: 'vless',
                server: urlObj.hostname,
                port: parseInt(urlObj.port),
                id: urlObj.username,
                uuid: urlObj.username,
                network: params.get('type') || 'tcp',
                security: params.get('security') || 'none',
                path: params.get('path'),
                host: params.get('host'),
                sni: params.get('sni'),
                alpn: params.get('alpn'),
                flow: params.get('flow'),
                name: decodeURIComponent(urlObj.hash.substring(1)) || `${urlObj.hostname}:${urlObj.port}`,
                tls: params.get('security') === 'tls' || params.get('security') === 'reality'
            };
            
            // Проверка на Reality
            if (params.get('security') === 'reality') {
                node.reality = true;
                node.publicKey = params.get('pbk');
                node.shortId = params.get('sid');
                node.fingerprint = params.get('fp');
            }
            
            node.country = this.extractCountry(node.name);
            node.city = this.extractCity(node.name);
            
            return node;
        } catch (error) {
            logger.debug(`Failed to parse VLESS URL: ${error.message}`);
            return null;
        }
    }

    parseTrojanUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            
            return {
                protocol: 'trojan',
                server: urlObj.hostname,
                port: parseInt(urlObj.port),
                password: urlObj.username,
                sni: params.get('sni') || urlObj.hostname,
                alpn: params.get('alpn'),
                name: decodeURIComponent(urlObj.hash.substring(1)) || `${urlObj.hostname}:${urlObj.port}`,
                country: this.extractCountry(decodeURIComponent(urlObj.hash.substring(1))),
                city: this.extractCity(decodeURIComponent(urlObj.hash.substring(1)))
            };
        } catch (error) {
            logger.debug(`Failed to parse Trojan URL: ${error.message}`);
            return null;
        }
    }

    parseShadowSocksUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            
            // Декодирование userinfo
            let method, password;
            if (urlObj.username && urlObj.password) {
                method = urlObj.username;
                password = urlObj.password;
            } else {
                // Попытка декодирования base64
                const decoded = Buffer.from(urlObj.username, 'base64').toString('utf8');
                [method, password] = decoded.split(':');
            }
            
            return {
                protocol: 'shadowsocks',
                server: urlObj.hostname,
                port: parseInt(urlObj.port),
                method: method,
                cipher: method,
                password: password,
                name: decodeURIComponent(urlObj.hash.substring(1)) || `${urlObj.hostname}:${urlObj.port}`,
                country: this.extractCountry(decodeURIComponent(urlObj.hash.substring(1))),
                city: this.extractCity(decodeURIComponent(urlObj.hash.substring(1)))
            };
        } catch (error) {
            logger.debug(`Failed to parse ShadowSocks URL: ${error.message}`);
            return null;
        }
    }

    parseHysteriaUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            
            return {
                protocol: 'hysteria',
                server: urlObj.hostname,
                port: parseInt(urlObj.port),
                auth: urlObj.username,
                password: urlObj.username,
                protocol_param: params.get('protocol'),
                up: params.get('up'),
                down: params.get('down'),
                sni: params.get('peer') || params.get('sni'),
                alpn: params.get('alpn'),
                name: decodeURIComponent(urlObj.hash.substring(1)) || `${urlObj.hostname}:${urlObj.port}`,
                country: this.extractCountry(decodeURIComponent(urlObj.hash.substring(1))),
                city: this.extractCity(decodeURIComponent(urlObj.hash.substring(1)))
            };
        } catch (error) {
            logger.debug(`Failed to parse Hysteria URL: ${error.message}`);
            return null;
        }
    }

    convertClashProxy(proxy) {
        try {
            const node = {
                protocol: proxy.type,
                server: proxy.server,
                port: parseInt(proxy.port),
                name: proxy.name
            };

            switch (proxy.type) {
                case 'vmess':
                    Object.assign(node, {
                        id: proxy.uuid,
                        uuid: proxy.uuid,
                        aid: proxy.alterId || 0,
                        alterId: proxy.alterId || 0,
                        cipher: proxy.cipher || 'auto',
                        network: proxy.network || 'tcp',
                        tls: proxy.tls || false,
                        host: proxy['ws-opts']?.headers?.Host,
                        path: proxy['ws-opts']?.path
                    });
                    break;
                    
                case 'vless':
                    Object.assign(node, {
                        id: proxy.uuid,
                        uuid: proxy.uuid,
                        network: proxy.network || 'tcp',
                        tls: proxy.tls || false,
                        flow: proxy.flow,
                        host: proxy['ws-opts']?.headers?.Host,
                        path: proxy['ws-opts']?.path
                    });
                    break;
                    
                case 'trojan':
                    Object.assign(node, {
                        password: proxy.password,
                        sni: proxy.sni
                    });
                    break;
                    
                case 'ss':
                    Object.assign(node, {
                        protocol: 'shadowsocks',
                        method: proxy.cipher,
                        cipher: proxy.cipher,
                        password: proxy.password
                    });
                    break;
            }

            node.country = this.extractCountry(node.name);
            node.city = this.extractCity(node.name);
            
            return node;
        } catch (error) {
            logger.debug(`Failed to convert Clash proxy: ${error.message}`);
            return null;
        }
    }

    convertJsonToNode(item) {
        try {
            // Базовая структура
            const node = {
                protocol: item.type || item.protocol || 'unknown',
                server: item.server || item.host || item.hostname,
                port: parseInt(item.port),
                name: item.name || item.tag || `${item.server}:${item.port}`
            };

            // Дополнительные поля в зависимости от протокола
            if (item.username) node.username = item.username;
            if (item.password) node.password = item.password;
            if (item.uuid) node.uuid = item.uuid;
            if (item.id) node.id = item.id;
            if (item.method) node.method = item.method;
            if (item.cipher) node.cipher = item.cipher;

            node.country = this.extractCountry(node.name);
            node.city = this.extractCity(node.name);

            return node;
        } catch (error) {
            logger.debug(`Failed to convert JSON to node: ${error.message}`);
            return null;
        }
    }

    extractCountry(name) {
        if (!name) return 'Unknown';
        
        const countryPatterns = {
            'US|USA|United States|America': 'United States',
            'UK|United Kingdom|Britain': 'United Kingdom',
            'DE|Germany|Deutschland': 'Germany',
            'FR|France': 'France',
            'JP|Japan': 'Japan',
            'SG|Singapore': 'Singapore',
            'HK|Hong Kong': 'Hong Kong',
            'TW|Taiwan': 'Taiwan',
            'KR|Korea|South Korea': 'South Korea',
            'CA|Canada': 'Canada',
            'AU|Australia': 'Australia',
            'NL|Netherlands': 'Netherlands',
            'RU|Russia': 'Russia',
            'CN|China': 'China',
            'IN|India': 'India'
        };

        for (const [pattern, country] of Object.entries(countryPatterns)) {
            const regex = new RegExp(`\\b(${pattern})\\b`, 'i');
            if (regex.test(name)) {
                return country;
            }
        }

        // Попытка извлечь первое слово как страну
        const words = name.split(/[\s\-_]+/);
        const firstWord = words[0];
        if (firstWord && firstWord.length >= 2) {
            return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
        }

        return 'Unknown';
    }

    extractCity(name) {
        if (!name) return '';
        
        const cityPatterns = {
            'NYC|New York': 'New York',
            'LA|Los Angeles': 'Los Angeles',
            'SF|San Francisco': 'San Francisco',
            'London': 'London',
            'Paris': 'Paris',
            'Tokyo': 'Tokyo',
            'Seoul': 'Seoul',
            'Beijing': 'Beijing',
            'Shanghai': 'Shanghai',
            'Mumbai': 'Mumbai',
            'Sydney': 'Sydney',
            'Toronto': 'Toronto',
            'Frankfurt': 'Frankfurt',
            'Amsterdam': 'Amsterdam',
            'Moscow': 'Moscow'
        };

        for (const [pattern, city] of Object.entries(cityPatterns)) {
            const regex = new RegExp(`\\b(${pattern})\\b`, 'i');
            if (regex.test(name)) {
                return city;
            }
        }

        return '';
    }
}

module.exports = ConfigParser;