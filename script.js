class AdvancedSpaceClicker {
    constructor() {
        this.energy = 0;
        this.clickPower = 1;
        this.energyPerSecond = 0;
        this.totalClicks = 0;
        this.totalEnergyEarned = 0;
        this.startTime = Date.now();
        this.playTime = 0;
        this.prestigeStars = 0;
        
        this.upgrades = {
            cursor: { count: 0, cost: 15, power: 1, costMultiplier: 1.15 },
            generator: { count: 0, cost: 100, power: 1, costMultiplier: 1.15 },
            factory: { count: 0, cost: 1100, power: 8, costMultiplier: 1.15 },
            mine: { count: 0, cost: 12000, power: 47, costMultiplier: 1.15 },
            spaceship: { count: 0, cost: 130000, power: 260, costMultiplier: 1.15 },
            blackhole: { count: 0, cost: 1500000, power: 1500, costMultiplier: 1.15 },
            galaxy: { count: 0, cost: 15000000, power: 8500, costMultiplier: 1.15 },
            universe: { count: 0, cost: 150000000, power: 50000, costMultiplier: 1.15 }
        };
        
        this.achievements = [
            { id: 'first_click', name: 'Первый Клик', desc: 'Сделайте первый клик', icon: '👆', unlocked: false, condition: () => this.totalClicks >= 1 },
            { id: 'hundred_clicks', name: 'Энтузиаст', desc: '100 кликов', icon: '🎯', unlocked: false, condition: () => this.totalClicks >= 100 },
            { id: 'thousand_clicks', name: 'Кликомастер', desc: '1000 кликов', icon: '🏆', unlocked: false, condition: () => this.totalClicks >= 1000 },
            { id: 'first_upgrade', name: 'Первое Улучшение', desc: 'Купите любое улучшение', icon: '🛒', unlocked: false, condition: () => Object.values(this.upgrades).some(u => u.count > 0) },
            { id: 'energy_1000', name: 'Энергетик', desc: '1K энергии', icon: '⚡', unlocked: false, condition: () => this.totalEnergyEarned >= 1000 },
            { id: 'energy_million', name: 'Миллионер', desc: '1M энергии', icon: '💰', unlocked: false, condition: () => this.totalEnergyEarned >= 1000000 },
            { id: 'ten_generators', name: 'Автоматизация', desc: '10 генераторов', icon: '🏭', unlocked: false, condition: () => this.upgrades.generator.count >= 10 },
            { id: 'first_spaceship', name: 'Космонавт', desc: 'Купите звездолёт', icon: '🚀', unlocked: false, condition: () => this.upgrades.spaceship.count >= 1 },
            { id: 'first_blackhole', name: 'Повелитель Тьмы', desc: 'Купите чёрную дыру', icon: '🕳️', unlocked: false, condition: () => this.upgrades.blackhole.count >= 1 },
            { id: 'play_time_hour', name: 'Долгожитель', desc: 'Играйте 1 час', icon: '⏰', unlocked: false, condition: () => this.playTime >= 3600 },
            { id: 'energy_per_sec_1000', name: 'Электростанция', desc: '1K энергии/сек', icon: '⚡', unlocked: false, condition: () => this.energyPerSecond >= 1000 },
            { id: 'first_prestige', name: 'Перерождение', desc: 'Первый престиж', icon: '🌟', unlocked: false, condition: () => this.prestigeStars > 0 }
        ];
        
        this.currentTab = 'basic';
        this.lastSave = Date.now();
        this.init();
    }
    
    init() {
        this.loadGame();
        this.bindEvents();
        this.updateDisplay();
        this.startGameLoop();
        this.calculateOfflineProgress();
        this.setupTabs();
        this.createAchievements();
    }
    
    bindEvents() {
        const clickButton = document.getElementById('clickButton');
        clickButton.addEventListener('click', (e) => this.handleClick(e));
        
        // Обработчики для улучшений
        document.querySelectorAll('.upgrade').forEach(upgrade => {
            upgrade.addEventListener('click', () => {
                const upgradeType = upgrade.dataset.upgrade;
                this.buyUpgrade(upgradeType);
            });
        });
        
        // Обработчик престижа
        const prestigeButton = document.getElementById('prestigeButton');
        if (prestigeButton) {
            prestigeButton.addEventListener('click', () => this.prestige());
        }
    }
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                this.switchTab(tab);
            });
        });
    }
    
    switchTab(tab) {
        // Убираем активный класс со всех кнопок
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.upgrades-container').forEach(container => container.classList.add('hidden'));
        
        // Активируем нужную вкладку
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-upgrades`).classList.remove('hidden');
        
        this.currentTab = tab;
    }
    
    createAchievements() {
        const container = document.getElementById('achievements');
        container.innerHTML = '';
        
        this.achievements.forEach(achievement => {
            const achievementEl = document.createElement('div');
            achievementEl.className = `achievement ${achievement.unlocked ? 'unlocked' : ''}`;
            achievementEl.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
            `;
            container.appendChild(achievementEl);
        });
    }
    
    checkAchievements() {
        let newAchievements = 0;
        
        this.achievements.forEach(achievement => {
            if (!achievement.unlocked && achievement.condition()) {
                achievement.unlocked = true;
                newAchievements++;
                this.showAchievementNotification(achievement);
            }
        });
        
        if (newAchievements > 0) {
            this.createAchievements();
        }
    }
    
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #ffd700, #ffed4a);
            color: #333;
            padding: 15px 20px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 2000;
            animation: slideIn 0.5s ease;
            box-shadow: 0 5px 15px rgba(255, 215, 0, 0.5);
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5rem;">${achievement.icon}</span>
                <div>
                    <div style="font-size: 0.9rem;">Достижение разблокировано!</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">${achievement.name}</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    handleClick(e) {
        const effectivePower = this.clickPower * this.getPrestigeMultiplier();
        this.energy += effectivePower;
        this.totalClicks++;
        this.totalEnergyEarned += effectivePower;
        
        this.createClickEffect(e);
        this.createFloatingNumber(e, effectivePower);
        this.updateDisplay();
        this.checkAchievements();
        this.saveGame();
    }
    
    createClickEffect(e) {
        const button = e.currentTarget;
        const effect = button.querySelector('.click-effect');
        
        effect.style.width = '100px';
        effect.style.height = '100px';
        effect.style.opacity = '1';
        
        setTimeout(() => {
            effect.style.width = '0';
            effect.style.height = '0';
            effect.style.opacity = '0';
        }, 100);
    }
    
    createFloatingNumber(e, value) {
        const rect = e.currentTarget.getBoundingClientRect();
        const floatingNumbers = document.querySelector('.floating-numbers');
        
        const number = document.createElement('div');
        number.className = 'floating-number';
        number.textContent = `+${this.formatNumber(value)}`;
        
        const x = Math.random() * 200 - 100;
        const y = Math.random() * 50 - 25;
        
        number.style.left = `${150 + x}px`;
        number.style.top = `${150 + y}px`;
        
        floatingNumbers.appendChild(number);
        
        setTimeout(() => {
            if (floatingNumbers.contains(number)) {
                floatingNumbers.removeChild(number);
            }
        }, 1000);
    }
    
    buyUpgrade(upgradeType) {
        const upgrade = this.upgrades[upgradeType];
        
        if (this.energy >= upgrade.cost) {
            this.energy -= upgrade.cost;
            upgrade.count++;
            
            upgrade.cost = Math.ceil(upgrade.cost * upgrade.costMultiplier);
            
            if (upgradeType === 'cursor') {
                this.clickPower += upgrade.power;
            } else {
                this.energyPerSecond += upgrade.power;
            }
            
            this.updateDisplay();
            this.checkAchievements();
            this.saveGame();
            this.createUpgradeEffect(upgradeType);
        }
    }
    
    createUpgradeEffect(upgradeType) {
        const upgradeElement = document.querySelector(`[data-upgrade="${upgradeType}"]`);
        upgradeElement.style.transform = 'scale(1.1)';
        upgradeElement.style.boxShadow = '0 0 30px rgba(78, 205, 196, 0.8)';
        
        setTimeout(() => {
            upgradeElement.style.transform = '';
            upgradeElement.style.boxShadow = '';
        }, 300);
    }
    
    getPrestigeMultiplier() {
        return 1 + (this.prestigeStars * 0.1); // +10% за каждую звезду
    }
    
    calculatePrestigeGain() {
        if (this.totalEnergyEarned < 1000000) return 0;
        return Math.floor(Math.sqrt(this.totalEnergyEarned / 1000000));
    }
    
    prestige() {
        const gain = this.calculatePrestigeGain();
        if (gain === 0) {
            alert('Вам нужно заработать минимум 1M энергии для престижа!');
            return;
        }
        
        if (confirm(`Вы получите ${gain} звёзд престижа. Весь прогресс будет сброшен. Продолжить?`)) {
            this.prestigeStars += gain;
            
            // Сброс прогресса
            this.energy = 0;
            this.clickPower = 1;
            this.energyPerSecond = 0;
            this.totalEnergyEarned = 0;
            
            Object.keys(this.upgrades).forEach(key => {
                this.upgrades[key].count = 0;
                this.upgrades[key].cost = this.getInitialCost(key);
            });
            
            this.updateDisplay();
            this.checkAchievements();
            this.saveGame();
            
            this.showPrestigeEffect();
        }
    }
    
    getInitialCost(upgradeType) {
        const costs = {
            cursor: 15, generator: 100, factory: 1100, mine: 12000,
            spaceship: 130000, blackhole: 1500000, galaxy: 15000000, universe: 150000000
        };
        return costs[upgradeType];
    }
    
    showPrestigeEffect() {
        const effect = document.createElement('div');
        effect.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%);
            z-index: 1500;
            animation: prestigeFlash 2s ease;
            pointer-events: none;
        `;
        
        document.body.appendChild(effect);
        
        setTimeout(() => {
            effect.remove();
        }, 2000);
    }
    
    updateDisplay() {
        // Основные показатели
        document.getElementById('score').textContent = this.formatNumber(this.energy);
        document.getElementById('energyPerSec').textContent = this.formatNumber(this.energyPerSecond * this.getPrestigeMultiplier());
        document.getElementById('clickPower').textContent = this.formatNumber(this.clickPower * this.getPrestigeMultiplier());
        document.getElementById('totalClicks').textContent = this.formatNumber(this.totalClicks);
        document.getElementById('playTime').textContent = this.formatTime(this.playTime);
        
        // Престиж информация
        const prestigeStarsEl = document.getElementById('prestigeStars');
        const prestigeMultiplierEl = document.getElementById('prestigeMultiplier');
        const prestigeGainEl = document.getElementById('prestigeGain');
        
        if (prestigeStarsEl) prestigeStarsEl.textContent = this.prestigeStars;
        if (prestigeMultiplierEl) prestigeMultiplierEl.textContent = this.getPrestigeMultiplier().toFixed(1);
        if (prestigeGainEl) prestigeGainEl.textContent = this.calculatePrestigeGain();
        
        // Улучшения
        Object.keys(this.upgrades).forEach(upgradeType => {
            const upgrade = this.upgrades[upgradeType];
            const upgradeElement = document.querySelector(`[data-upgrade="${upgradeType}"]`);
            
            if (upgradeElement) {
                const costEl = document.getElementById(`${upgradeType}Cost`);
                const countEl = document.getElementById(`${upgradeType}Count`);
                
                if (costEl) costEl.textContent = this.formatNumber(upgrade.cost);
                if (countEl) countEl.textContent = this.formatNumber(upgrade.count);
                
                if (this.energy >= upgrade.cost) {
                    upgradeElement.classList.add('affordable');
                } else {
                    upgradeElement.classList.remove('affordable');
                }
            }
        });
    }
    
    formatNumber(num) {
        if (num < 1000) return Math.floor(num);
        if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
        if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
        if (num < 1000000000000) return (num / 1000000000).toFixed(1) + 'B';
        if (num < 1000000000000000) return (num / 1000000000000).toFixed(1) + 'T';
        return (num / 1000000000000000).toFixed(1) + 'Q';
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) return `${hours}ч ${minutes}м`;
        if (minutes > 0) return `${minutes}м ${secs}с`;
        return `${secs}с`;
    }
    
    startGameLoop() {
        setInterval(() => {
            if (this.energyPerSecond > 0) {
                const gain = (this.energyPerSecond * this.getPrestigeMultiplier()) / 10;
                this.energy += gain;
                this.totalEnergyEarned += gain;
                this.updateDisplay();
            }
            
            this.playTime = (Date.now() - this.startTime) / 1000;
            this.checkAchievements();
        }, 100);
        
        // Обновление времени игры
        setInterval(() => {
            this.playTime = (Date.now() - this.startTime) / 1000;
            document.getElementById('playTime').textContent = this.formatTime(this.playTime);
        }, 1000);
        
        // Автосохранение
        setInterval(() => {
            this.saveGame();
        }, 30000);
    }
    
    saveGame() {
        const gameData = {
            energy: this.energy,
            clickPower: this.clickPower,
            energyPerSecond: this.energyPerSecond,
            totalClicks: this.totalClicks,
            totalEnergyEarned: this.totalEnergyEarned,
            playTime: this.playTime,
            prestigeStars: this.prestigeStars,
            upgrades: this.upgrades,
            achievements: this.achievements,
            startTime: this.startTime,
            lastSave: Date.now()
        };
        
        localStorage.setItem('advancedSpaceClickerSave', JSON.stringify(gameData));
    }
    
    loadGame() {
        const savedData = localStorage.getItem('advancedSpaceClickerSave');
        
        if (savedData) {
            const gameData = JSON.parse(savedData);
            this.energy = gameData.energy || 0;
            this.clickPower = gameData.clickPower || 1;
            this.energyPerSecond = gameData.energyPerSecond || 0;
            this.totalClicks = gameData.totalClicks || 0;
            this.totalEnergyEarned = gameData.totalEnergyEarned || 0;
            this.playTime = gameData.playTime || 0;
            this.prestigeStars = gameData.prestigeStars || 0;
            this.upgrades = { ...this.upgrades, ...gameData.upgrades };
            this.achievements = gameData.achievements || this.achievements;
            this.startTime = gameData.startTime || Date.now();
            this.lastSave = gameData.lastSave || Date.now();
        }
    }
    
    calculateOfflineProgress() {
        const now = Date.now();
        const timeDiff = (now - this.lastSave) / 1000;
        
        if (timeDiff > 60 && this.energyPerSecond > 0) {
            const offlineEarnings = this.energyPerSecond * this.getPrestigeMultiplier() * Math.min(timeDiff, 3600 * 24);
            
            if (offlineEarnings > 0) {
                this.energy += offlineEarnings;
                this.totalEnergyEarned += offlineEarnings;
                this.showOfflineModal(offlineEarnings, timeDiff);
            }
        }
    }
    
    showOfflineModal(earnings, timeAway) {
        const hours = Math.floor(timeAway / 3600);
        const minutes = Math.floor((timeAway % 3600) / 60);
        
        let timeText = '';
        if (hours > 0) timeText += `${hours}ч `;
        if (minutes > 0) timeText += `${minutes}м`;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.3);
                box-shadow: 0 0 50px rgba(102, 126, 234, 0.5);
                max-width: 400px;
            ">
                <h2 style="margin-bottom: 15px; color: white;">🚀 Добро пожаловать обратно!</h2>
                <p style="margin-bottom: 10px; color: #ccc;">Вы отсутствовали: ${timeText}</p>
                <p style="margin-bottom: 20px; font-size: 1.5rem; color: #4ecdc4; text-shadow: 0 0 10px rgba(78, 205, 196, 0.8);">
                    Заработано: +${this.formatNumber(earnings)} энергии
                </p>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 10px 30px;
                    border-radius: 25px;
                    cursor: pointer;
                    font-size: 1rem;
                ">Продолжить</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
}

// Инициализация игры
document.addEventListener('DOMContentLoaded', () => {
    new AdvancedSpaceClicker();
});

// Дополнительные эффекты и анимации
document.addEventListener('DOMContentLoaded', () => {
    // Параллакс эффект
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        const background = document.querySelector('.background');
        if (background) {
            background.style.transform = `translate(${mouseX * 20}px, ${mouseY * 20}px)`;
        }
    });
    
    // Эффект ряби при клике
    const clickButton = document.getElementById('clickButton');
    if (clickButton) {
        clickButton.addEventListener('click', () => {
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
                width: 300px;
                height: 300px;
                left: 0;
                top: 0;
            `;
            
            clickButton.appendChild(ripple);
            
            setTimeout(() => {
                if (clickButton.contains(ripple)) {
                    ripple.remove();
                }
            }, 600);
        });
    }
    
    // CSS анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes prestigeFlash {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
});