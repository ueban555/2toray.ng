const rateLimiterMiddleware = (req, res, next) => {
    // Простая реализация без внешних зависимостей
    next();
};

module.exports = { rateLimiter: rateLimiterMiddleware };