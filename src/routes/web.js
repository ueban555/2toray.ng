const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPN Config Aggregator</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .header { text-align: center; margin-bottom: 30px; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #0056b3; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .logs { background: #2d3748; color: white; padding: 20px; border-radius: 10px; font-family: monospace; max-height: 300px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 VPN Config Aggregator</h1>
        <p>Автоматический сборщик и агрегатор VPN-конфигураций</p>
    </div>
    
    <div class="status">
        <h3>Статус системы</h3>
        <div id="status">Система запущена</div>
        <button class="btn" onclick="startCollection()">Запустить сбор</button>
        <button class="btn" onclick="getStats()">Обновить статистику</button>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h4>Всего сборов</h4>
            <div id="total-collections">0</div>
        </div>
        <div class="stat-card">
            <h4>Успешных</h4>
            <div id="successful-collections">0</div>
        </div>
        <div class="stat-card">
            <h4>Валидных нод</h4>
            <div id="valid-nodes">0</div>
        </div>
        <div class="stat-card">
            <h4>Время работы</h4>
            <div id="uptime">0s</div>
        </div>
    </div>
    
    <div class="logs" id="logs">
        Логи системы появятся здесь...
    </div>
    
    <script>
        function startCollection() {
            fetch('/api/collect', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    document.getElementById('status').innerText = 'Сбор запущен...';
                    addLog('Ручной сбор запущен');
                })
                .catch(e => addLog('Ошибка: ' + e.message));
        }
        
        function getStats() {
            fetch('/api/stats')
                .then(r => r.json())
                .then(data => {
                    document.getElementById('uptime').innerText = Math.round(data.uptime || 0) + 's';
                    addLog('Статистика обновлена');
                })
                .catch(e => addLog('Ошибка получения статистики: ' + e.message));
        }
        
        function addLog(message) {
            const logs = document.getElementById('logs');
            const time = new Date().toLocaleTimeString();
            logs.innerHTML += '\\n[' + time + '] ' + message;
            logs.scrollTop = logs.scrollHeight;
        }
        
        // Автообновление каждые 10 секунд
        setInterval(getStats, 10000);
        getStats();
    </script>
</body>
</html>
    `);
});

module.exports = router;