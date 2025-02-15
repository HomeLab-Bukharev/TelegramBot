require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleMessage } = require('./handlers/messageHandler');
const { pool, addUser, isAuthorized } = require('./handlers/database');

// Проверка переменных окружения
if (!process.env.BOT_TOKEN || !process.env.DATABASE_URL) {
    console.error("❌ Ошибка: Не найдены BOT_TOKEN или DATABASE_URL в .env");
    process.exit(1);
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Проверка подключения к БД
async function checkDatabase() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log(`✅ Подключение к БД установлено: ${res.rows[0].now}`);
    } catch (error) {
        console.error("❌ Ошибка подключения к БД:", error);
        process.exit(1);
    }
}

(async () => {
    console.log("🔄 Инициализация бота...");
    await checkDatabase();
    console.log("🚀 Бот запущен и готов к работе!");
})();

// Обработка сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || "Unknown";

    await addUser(chatId, name);

    const authorized = await isAuthorized(chatId);
    if (!authorized) {
        bot.sendMessage(chatId, 'Вы не авторизованы. Дождитесь подтверждения администратора.');
        return;
    }

    await handleMessage(bot, msg);
});

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || "друг";

    const greetingMessage = `
🐀 Привет, ${name}! 🐀
Я – шустрая видеомышь! 🎥
Сбегаю в соцсети и утащу для тебя нужное видео. Просто скинь ссылку!

📌 Где могу порыться:

✅ Instagram
🚫 TikTok
🚫 YouTube
🚫 Twitter (X)
🚫 Facebook

⚠️ Доступ к норке выдается вручную. Если у тебя нет прав – жди одобрения от администратора.
    `;
    
    bot.sendMessage(chatId, greetingMessage);
});

