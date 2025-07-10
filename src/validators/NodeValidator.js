const ping = require('ping');
const axios = require('axios');
const net = require('net');
const logger = require('../utils/logger');
const config = require('../config/config');

class NodeValidator {
    constructor() {
        this.validationCache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 минут
    }

    async validate(node) {
        try {
            // Проверка кэша
            const cacheKey = `${node.server}:${node.port}`;
            const cached = this.validationCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.isValid;
            }

            // Базовая валидация
            if (!this.isValidNode(node)) {
                this.cacheResult(cacheKey, false);
                return false;
            }

            // Проверка доступности
            const isReachable = await this.checkReachability(node);
            
            if (!isReachable) {
                this.cacheResult(cacheKey, false);
                return false;
            }

            // Дополнительные проверки в зависимости от протокола
            const protocolValid = await this.validateProtocol(node);
            
            const isValid = protocolValid;
            this.cacheResult(cacheKey, isValid);
            
            return isValid;
            
        } catch (error) {
            logger.validation(`Validation error for ${node.server}:${node.port}: ${error.message}`);
            return false;
        }
    }

    isValidNode(node) {
        // Проверка обязательных полей
        if (!node.server || !node.port || !node.protocol) {
            logger.validation(`Missing required fields for node: ${JSON.stringify(node)}`);
            return false;
        }

        // Проверка валидности IP/домена
        if (!this.isValidHostname(node.server)) {
            logger.validation(`Invalid hostname: ${node.server}`);
            return false;
        }

        // Проверка валидности порта
        if (!this.isValidPort(node.port)) {
            logger.validation(`Invalid port: ${node.port}`);
            return false;
        }

        // Проверка протокол-специфичных полей
        if (!this.validateProtocolFields(node)) {
            return false;
        }

        return true;
    }

    isValidHostname(hostname) {
        // Проверка на IP адрес
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
            return true;
        }

        // Проверка на доменное имя
        const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
        return domainRegex.test(hostname);
    }

    isValidPort(port) {
        const portNum = parseInt(port);
        return portNum >= 1 && portNum <= 65535;
    }

    validateProtocolFields(node) {
        switch (node.protocol) {
            case 'vmess':
                if (!node.id && !node.uuid) {
                    logger.validation(`VMess node missing UUID: ${node.server}`);
                    return false;
                }
                break;
                
            case 'vless':
                if (!node.id && !node.uuid) {
                    logger.validation(`VLESS node missing UUID: ${node.server}`);
                    return false;
                }
                break;
                
            case 'trojan':
                if (!node.password && !node.id) {
                    logger.validation(`Trojan node missing password: ${node.server}`);
                    return false;
                }
                break;
                
            case 'shadowsocks':
                if (!node.password || !node.method) {
                    logger.validation(`ShadowSocks node missing password/method: ${node.server}`);
                    return false;
                }
                break;
                
            case 'hysteria':
                if (!node.auth && !node.password) {
                    logger.validation(`Hysteria node missing auth: ${node.server}`);
                    return false;
                }
                break;
        }
        
        return true;
    }

    async checkReachability(node) {
        try {
            // Ping тест
            const pingResult = await this.pingHost(node.server);
            if (!pingResult.alive) {
                logger.validation(`Ping failed for ${node.server}: ${pingResult.output}`);
                return false;
            }

            // TCP connection тест
            const tcpResult = await this.testTcpConnection(node.server, node.port);
            if (!tcpResult) {
                logger.validation(`TCP connection failed for ${node.server}:${node.port}`);
                return false;
            }

            return true;
            
        } catch (error) {
            logger.validation(`Reachability check failed for ${node.server}:${node.port}: ${error.message}`);
            return false;
        }
    }

    async pingHost(hostname) {
        try {
            const result = await ping.promise.probe(hostname, {
                timeout: config.PING_TIMEOUT / 1000, // ping.js использует секунды
                attempts: 1
            });
            
            return {
                alive: result.alive,
                time: result.time,
                output: result.output
            };
            
        } catch (error) {
            return {
                alive: false,
                output: error.message
            };
        }
    }

    async testTcpConnection(hostname, port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = config.PING_TIMEOUT;
            
            let isResolved = false;
            
            const cleanup = () => {
                if (!isResolved) {
                    isResolved = true;
                    socket.destroy();
                }
            };
            
            socket.setTimeout(timeout);
            
            socket.on('connect', () => {
                cleanup();
                resolve(true);
            });
            
            socket.on('timeout', () => {
                cleanup();
                resolve(false);
            });
            
            socket.on('error', () => {
                cleanup();
                resolve(false);
            });
            
            try {
                socket.connect(port, hostname);
            } catch (error) {
                cleanup();
                resolve(false);
            }
        });
    }

    async validateProtocol(node) {
        // Базовая проверка протокола пройдена в isValidNode
        // Здесь можно добавить более глубокие проверки если нужно
        
        switch (node.protocol) {
            case 'vmess':
                return this.validateVmess(node);
            case 'vless':
                return this.validateVless(node);
            case 'trojan':
                return this.validateTrojan(node);
            case 'shadowsocks':
                return this.validateShadowSocks(node);
            case 'hysteria':
                return this.validateHysteria(node);
            default:
                return true; // Неизвестные протоколы пропускаем
        }
    }

    validateVmess(node) {
        // Проверка UUID формата
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuid = node.id || node.uuid;
        
        if (!uuidRegex.test(uuid)) {
            logger.validation(`Invalid VMess UUID format: ${uuid}`);
            return false;
        }

        // Проверка AlterId
        const alterId = parseInt(node.aid || node.alterId || 0);
        if (alterId < 0 || alterId > 255) {
            logger.validation(`Invalid VMess AlterId: ${alterId}`);
            return false;
        }

        return true;
    }

    validateVless(node) {
        // Проверка UUID формата
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuid = node.id || node.uuid;
        
        if (!uuidRegex.test(uuid)) {
            logger.validation(`Invalid VLESS UUID format: ${uuid}`);
            return false;
        }

        return true;
    }

    validateTrojan(node) {
        const password = node.password || node.id;
        
        // Минимальная длина пароля
        if (password.length < 8) {
            logger.validation(`Trojan password too short: ${password.length} chars`);
            return false;
        }

        return true;
    }

    validateShadowSocks(node) {
        // Проверка поддерживаемых методов шифрования
        const supportedMethods = [
            'aes-128-gcm', 'aes-256-gcm', 'aes-128-cfb', 'aes-256-cfb',
            'aes-128-ctr', 'aes-256-ctr', 'chacha20-ietf-poly1305',
            'xchacha20-ietf-poly1305', 'rc4-md5', 'bf-cfb'
        ];

        const method = node.method || node.cipher;
        if (!supportedMethods.includes(method)) {
            logger.validation(`Unsupported ShadowSocks method: ${method}`);
            return false;
        }

        return true;
    }

    validateHysteria(node) {
        // Базовая валидация для Hysteria
        const auth = node.auth || node.password;
        
        if (!auth || auth.length < 4) {
            logger.validation(`Invalid Hysteria auth: ${auth}`);
            return false;
        }

        return true;
    }

    cacheResult(key, isValid) {
        this.validationCache.set(key, {
            isValid,
            timestamp: Date.now()
        });

        // Очистка старого кэша
        if (this.validationCache.size > 10000) {
            this.cleanupCache();
        }
    }

    cleanupCache() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, value] of this.validationCache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.validationCache.delete(key));
        
        logger.validation(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }

    getStats() {
        return {
            cacheSize: this.validationCache.size,
            cacheTimeout: this.cacheTimeout
        };
    }

    clearCache() {
        this.validationCache.clear();
        logger.validation('Validation cache cleared');
    }
}

module.exports = NodeValidator;