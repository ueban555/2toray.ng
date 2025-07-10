const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');

class GitHubUploader {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.headers = {
            'Authorization': `token ${config.GITHUB.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'VPN-Config-Aggregator'
        };
    }

    async initialize() {
        if (!config.GITHUB.enabled || !config.GITHUB.token) {
            logger.warn('GitHub integration disabled or token missing');
            return;
        }
        
        try {
            // Проверка токена
            const response = await axios.get(`${this.baseURL}/user`, { headers: this.headers });
            logger.upload(`GitHub integration initialized for user: ${response.data.login}`);
            
            // Проверка/создание репозитория
            if (config.GITHUB.repository) {
                await this.ensureRepository();
            }
            
        } catch (error) {
            logger.error('GitHub initialization failed:', error.message);
            throw error;
        }
    }

    async ensureRepository() {
        try {
            const repoPath = `${config.GITHUB.username}/${config.GITHUB.repository}`;
            const response = await axios.get(`${this.baseURL}/repos/${repoPath}`, { headers: this.headers });
            logger.upload(`Repository ${repoPath} exists`);
        } catch (error) {
            if (error.response?.status === 404) {
                logger.upload(`Creating repository ${config.GITHUB.repository}...`);
                await this.createRepository();
            } else {
                throw error;
            }
        }
    }

    async createRepository() {
        const repoData = {
            name: config.GITHUB.repository,
            description: 'Auto-generated VPN configurations',
            private: false,
            has_issues: false,
            has_projects: false,
            has_wiki: false
        };

        await axios.post(`${this.baseURL}/user/repos`, repoData, { headers: this.headers });
        logger.upload(`Repository ${config.GITHUB.repository} created`);
    }

    async upload(configs) {
        if (!config.GITHUB.enabled) return;

        try {
            // Загрузка в репозиторий
            if (config.GITHUB.repository) {
                await this.uploadToRepository(configs);
            }

            // Загрузка в gist
            if (config.GITHUB.gistId) {
                await this.uploadToGist(configs);
            }

        } catch (error) {
            logger.error('GitHub upload failed:', error.message);
            throw error;
        }
    }

    async uploadToRepository(configs) {
        const repoPath = `${config.GITHUB.username}/${config.GITHUB.repository}`;
        
        for (const configData of configs) {
            try {
                const filePath = configData.filename;
                const content = Buffer.from(configData.content).toString('base64');
                
                // Проверка существования файла
                let sha = null;
                try {
                    const existingFile = await axios.get(
                        `${this.baseURL}/repos/${repoPath}/contents/${filePath}`,
                        { headers: this.headers }
                    );
                    sha = existingFile.data.sha;
                } catch (error) {
                    // Файл не существует, это нормально
                }

                const updateData = {
                    message: `${config.GITHUB.commitMessage} - ${configData.category}`,
                    content: content,
                    branch: config.GITHUB.branch
                };

                if (sha) {
                    updateData.sha = sha;
                }

                await axios.put(
                    `${this.baseURL}/repos/${repoPath}/contents/${filePath}`,
                    updateData,
                    { headers: this.headers }
                );

                logger.upload(`Uploaded ${filePath} to repository`);
                
            } catch (error) {
                logger.error(`Failed to upload ${configData.filename} to repository:`, error.message);
            }
        }

        // Создание README с информацией о подписках
        await this.createSubscriptionReadme(configs, repoPath);
    }

    async createSubscriptionReadme(configs, repoPath) {
        const readmeContent = this.generateReadmeContent(configs);
        const content = Buffer.from(readmeContent).toString('base64');
        
        let sha = null;
        try {
            const existingReadme = await axios.get(
                `${this.baseURL}/repos/${repoPath}/contents/README.md`,
                { headers: this.headers }
            );
            sha = existingReadme.data.sha;
        } catch (error) {
            // README не существует
        }

        const updateData = {
            message: 'Update README with subscription links',
            content: content,
            branch: config.GITHUB.branch
        };

        if (sha) {
            updateData.sha = sha;
        }

        await axios.put(
            `${this.baseURL}/repos/${repoPath}/contents/README.md`,
            updateData,
            { headers: this.headers }
        );

        logger.upload('Updated README with subscription links');
    }

    generateReadmeContent(configs) {
        const baseUrl = `https://raw.githubusercontent.com/${config.GITHUB.username}/${config.GITHUB.repository}/${config.GITHUB.branch}`;
        
        let readme = `# VPN Configuration Subscriptions

Автоматически обновляемые конфигурации VPN серверов.

## 📱 Ссылки для подписки

`;

        for (const configData of configs) {
            const subscriptionUrl = `${baseUrl}/${configData.filename}`;
            readme += `### ${configData.categoryInfo.name}
- **Описание**: ${configData.categoryInfo.description}
- **Количество серверов**: ${configData.nodeCount}
- **Ссылка для подписки**: \`${subscriptionUrl}\`
- **QR-код**: [Сгенерировать QR](https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(subscriptionUrl)})

`;
        }

        readme += `
## 📊 Статистика

- **Последнее обновление**: ${new Date().toISOString()}
- **Всего категорий**: ${configs.length}
- **Общее количество серверов**: ${configs.reduce((sum, c) => sum + c.nodeCount, 0)}

## 🔄 Автообновление

Конфигурации автоматически обновляются каждые 30 минут.

## ⚙️ Использование

1. Скопируйте ссылку для подписки нужной категории
2. Вставьте её в ваш VPN клиент (Clash, V2rayNG, etc.)
3. Обновите подписку в клиенте

---

*Автоматически сгенерировано VPN Config Aggregator*
`;

        return readme;
    }

    async uploadToGist(configs) {
        // Загружаем основной конфиг в gist
        const mainConfig = configs.find(c => c.category === 'all') || configs[0];
        
        if (!mainConfig) return;

        const gistData = {
            description: 'Auto-updated VPN configuration',
            files: {}
        };

        gistData.files[config.GITHUB.gistFilename] = {
            content: mainConfig.content
        };

        try {
            if (config.GITHUB.gistId) {
                // Обновление существующего gist
                await axios.patch(
                    `${this.baseURL}/gists/${config.GITHUB.gistId}`,
                    gistData,
                    { headers: this.headers }
                );
                logger.upload(`Updated gist ${config.GITHUB.gistId}`);
            } else {
                // Создание нового gist
                gistData.public = true;
                const response = await axios.post(
                    `${this.baseURL}/gists`,
                    gistData,
                    { headers: this.headers }
                );
                logger.upload(`Created new gist: ${response.data.id}`);
                logger.info(`Gist URL: ${response.data.html_url}`);
            }
        } catch (error) {
            logger.error('Gist upload failed:', error.message);
        }
    }
}

module.exports = GitHubUploader;