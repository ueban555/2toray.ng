class SpaceClicker {
    constructor() {
        this.energy = 0;
        this.clickPower = 1;
        this.energyPerSecond = 0;
        
        this.upgrades = {
            cursor: { count: 0, cost: 15, power: 1, costMultiplier: 1.15 },
            generator: { count: 0, cost: 100, power: 1, costMultiplier: 1.15 },
            factory: { count: 0, cost: 1100, power: 8, costMultiplier: 1.15 },
            mine: { count: 0, cost: 12000, power: 47, costMultiplier: 1.15 },
            spaceship: { count: 0, cost: 130000, power: 260, costMultiplier: 1.15 }
        };
        
        this.lastSave = Date.now();
        this.init();
    }
    
    init() {
        this.loadGame();
        this.bindEvents();
        this.updateDisplay();
        this.startGameLoop();
        this.calculateOfflineProgress();
    }
    
    bindEvents() {
        const clickButton = document.getElementById('clickButton');
        clickButton.addEventListener('click', (e) => this.handleClick(e));
        
        // Добавляем обработчики для улучшений
        document.querySelectorAll('.upgrade').forEach(upgrade => {
            upgrade.addEventListener('click', () => {
                const upgradeType = upgrade.dataset.upgrade;
                this.buyUpgrade(upgradeType);
            });
        });
    }
    
    handleClick(e) {
        this.energy += this.clickPower;
        this.createClickEffect(e);
        this.createFloatingNumber(e, this.clickPower);
        this.updateDisplay();
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
        
        // Случайная позиция вокруг клика
        const x = Math.random() * 200 - 100;
        const y = Math.random() * 50 - 25;
        
        number.style.left = `${150 + x}px`;
        number.style.top = `${150 + y}px`;
        
        floatingNumbers.appendChild(number);
        
        setTimeout(() => {
            floatingNumbers.removeChild(number);
        }, 1000);
    }
    
    buyUpgrade(upgradeType) {
        const upgrade = this.upgrades[upgradeType];
        
        if (this.energy >= upgrade.cost) {
            this.energy -= upgrade.cost;
            upgrade.count++;
            
            // Увеличиваем стоимость
            upgrade.cost = Math.ceil(upgrade.cost * upgrade.costMultiplier);
            
            // Обновляем силу клика или производство
            if (upgradeType === 'cursor') {
                this.clickPower += upgrade.power;
            } else {
                this.energyPerSecond += upgrade.power;
            }
            
            this.updateDisplay();
            this.saveGame();
            
            // Визуальный эффект
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
    
    updateDisplay() {
        // Обновляем основные показатели
        document.getElementById('score').textContent = this.formatNumber(this.energy);
        document.getElementById('energyPerSec').textContent = this.formatNumber(this.energyPerSecond);
        document.getElementById('clickPower').textContent = this.formatNumber(this.clickPower);
        
        // Обновляем информацию об улучшениях
        Object.keys(this.upgrades).forEach(upgradeType => {
            const upgrade = this.upgrades[upgradeType];
            const upgradeElement = document.querySelector(`[data-upgrade="${upgradeType}"]`);
            
            document.getElementById(`${upgradeType}Cost`).textContent = this.formatNumber(upgrade.cost);
            document.getElementById(`${upgradeType}Count`).textContent = this.formatNumber(upgrade.count);
            
            // Показываем доступность покупки
            if (this.energy >= upgrade.cost) {
                upgradeElement.classList.add('affordable');
            } else {
                upgradeElement.classList.remove('affordable');
            }
        });
    }
    
    formatNumber(num) {
        if (num < 1000) return Math.floor(num);
        if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
        if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
        if (num < 1000000000000) return (num / 1000000000).toFixed(1) + 'B';
        return (num / 1000000000000).toFixed(1) + 'T';
    }
    
    startGameLoop() {
        setInterval(() => {
            if (this.energyPerSecond > 0) {
                this.energy += this.energyPerSecond / 10; // Обновляем каждые 100мс
                this.updateDisplay();
            }
        }, 100);
        
        // Автосохранение каждые 30 секунд
        setInterval(() => {
            this.saveGame();
        }, 30000);
    }
    
    saveGame() {
        const gameData = {
            energy: this.energy,
            clickPower: this.clickPower,
            energyPerSecond: this.energyPerSecond,
            upgrades: this.upgrades,
            lastSave: Date.now()
        };
        
        localStorage.setItem('spaceClickerSave', JSON.stringify(gameData));
    }
    
    loadGame() {
        const savedData = localStorage.getItem('spaceClickerSave');
        
        if (savedData) {
            const gameData = JSON.parse(savedData);
            this.energy = gameData.energy || 0;
            this.clickPower = gameData.clickPower || 1;
            this.energyPerSecond = gameData.energyPerSecond || 0;
            this.upgrades = { ...this.upgrades, ...gameData.upgrades };
            this.lastSave = gameData.lastSave || Date.now();
        }
    }
    
    calculateOfflineProgress() {
        const now = Date.now();
        const timeDiff = (now - this.lastSave) / 1000; // в секундах
        
        if (timeDiff > 60 && this.energyPerSecond > 0) { // Если прошло больше минуты
            const offlineEarnings = this.energyPerSecond * Math.min(timeDiff, 3600 * 24); // Максимум 24 часа
            
            if (offlineEarnings > 0) {
                this.energy += offlineEarnings;
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
        
        // Создаем модальное окно
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

// Инициализация игры когда страница загружена
document.addEventListener('DOMContentLoaded', () => {
    new SpaceClicker();
});

// Дополнительные эффекты
document.addEventListener('DOMContentLoaded', () => {
    // Эффект параллакса для фона
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        const background = document.querySelector('.background');
        background.style.transform = `translate(${mouseX * 20}px, ${mouseY * 20}px)`;
    });
    
    // Звуковые эффекты (без реального звука, только визуальные)
    const clickButton = document.getElementById('clickButton');
    clickButton.addEventListener('click', () => {
        // Добавляем рябь при клике
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;
        
        const rect = clickButton.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = '0px';
        ripple.style.top = '0px';
        
        clickButton.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
    
    // CSS для анимации ряби
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});