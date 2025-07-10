# 🚀 Развертывание Космического Кликера

## Способы запуска игры в интернете

### 🟢 1. GitHub Pages (Рекомендуется - бесплатно)

1. **Создайте репозиторий на GitHub:**
   - Зайдите на [github.com](https://github.com)
   - Нажмите "New repository"
   - Назовите репозиторий (например: `space-clicker`)
   - Поставьте галочку "Public"

2. **Загрузите файлы:**
   - Загрузите все файлы игры: `index.html`, `styles.css`, `script.js`, `README.md`
   - Или используйте Git команды:
   ```bash
   git init
   git add .
   git commit -m "Добавил космическую кликер-игру"
   git branch -M main
   git remote add origin https://github.com/ВАШ_ЛОГИН/space-clicker.git
   git push -u origin main
   ```

3. **Активируйте GitHub Pages:**
   - Зайдите в Settings репозитория
   - Найдите раздел "Pages"
   - В Source выберите "Deploy from a branch"
   - Выберите "main" branch
   - Нажмите "Save"

4. **Получите ссылку:**
   - Ваша игра будет доступна по адресу:
   - `https://ВАШ_ЛОГИН.github.io/space-clicker/`

---

### 🟠 2. Netlify (Бесплатно)

1. Зайдите на [netlify.com](https://netlify.com)
2. Нажмите "Add new site" → "Deploy manually"
3. Перетащите папку с файлами игры
4. Получите случайный URL (можно изменить в настройках)

---

### 🟡 3. Vercel (Бесплатно)

1. Зайдите на [vercel.com](https://vercel.com)
2. Импортируйте проект из GitHub или загрузите файлы
3. Автоматическое развертывание

---

### 🔵 4. Surge.sh (Бесплатно)

```bash
npm install -g surge
cd /путь/к/игре
surge
```

---

### 🟣 5. Firebase Hosting (Бесплатно)

1. Установите Firebase CLI: `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init hosting`
4. `firebase deploy`

---

## 🌐 Локальный доступ через интернет

### С помощью ngrok (требует регистрации):

1. Зарегистрируйтесь на [ngrok.com](https://ngrok.com)
2. Получите authtoken
3. `ngrok config add-authtoken ВАШ_ТОКЕН`
4. `ngrok http 8000`

### С помощью localtunnel (бесплатно):

```bash
npm install -g localtunnel
lt --port 8000
```

---

## 📱 Быстрый старт для игры

Игра уже готова к работе! Просто откройте `index.html` в браузере или используйте любой из способов выше.

### Локальный запуск:
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

Затем откройте: `http://localhost:8000`

---

## ✨ Особенности игры:

- 🎮 **Полноценная кликер-игра** с 8 типами улучшений
- 🏆 **12 достижений** для разблокировки
- 🌟 **Система престижа** для долгосрочной игры
- 💾 **Автосохранение** в браузере
- 🕐 **Оффлайн прогресс**
- 📱 **Адаптивный дизайн**
- 🎨 **Красивые анимации**

## 🎯 Готово к игре!

Выберите любой способ развертывания и наслаждайтесь покорением космоса! 🌌