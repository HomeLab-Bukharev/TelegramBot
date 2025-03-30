require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleMessage } = require('./handlers/messageHandler');
const { pool, addUser, isAuthorized, getUserStats, getPlatformStats } = require('./handlers/database');

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

/**
 * Показывает статистику пользователя
 */
async function showUserStats(bot, msg) {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || "пользователь";

    try {
        // Загружаем общую статистику
        const userStats = await getUserStats(chatId);
        const platformStats = await getPlatformStats(chatId);
        
        // Форматируем дату последней загрузки
        let lastDownloadDate = 'Нет загрузок';
        if (userStats.last_download) {
            const date = new Date(userStats.last_download);
            lastDownloadDate = date.toLocaleDateString('ru-RU', {
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // Форматируем платформы
        let platformsText = '';
        if (platformStats && platformStats.length > 0) {
            platformsText = platformStats.map(p => 
                `• ${p.platform}: ${p.successful}/${p.downloads} (${Math.round(p.successful/p.downloads*100)}%)`
            ).join('\n');
        } else {
            platformsText = '• Нет данных';
        }

        // Общий объем в понятном формате
        const totalSizeFormatted = userStats.total_size > 0 
            ? `${parseFloat(userStats.total_size).toFixed(2)} MB` 
            : '0 MB';
        
        const statsMessage = `
📊 Статистика для ${name}:

🔢 Количество загрузок: ${userStats.successful_downloads}/${userStats.total_downloads}
📦 Общий объем загруженных видео: ${totalSizeFormatted}
🕒 Последняя загрузка: ${lastDownloadDate}

📱 По платформам:
${platformsText}
        `;
        
        bot.sendMessage(chatId, statsMessage);
    } catch (error) {
        console.error('❌ Ошибка при получении статистики:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка при получении статистики.');
    }
}

// Обработка сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || "Unknown";
    const text = msg.text || "";

    await addUser(chatId, name);

    const authorized = await isAuthorized(chatId);
    if (!authorized) {
        bot.sendMessage(chatId, 'Вы не авторизованы. Дождитесь подтверждения администратора.');
        return;
    }

    // Обработка кнопок меню
    if (text === '📊 Статистика') {
        await showUserStats(bot, msg);
        return;
    } else if (text === '❓ Помощь') {
        const helpMessage = `
🐀 Справка по использованию бота:

1️⃣ Просто отправь мне ссылку на видео из Instagram
2️⃣ Я скачаю его и пришлю тебе
3️⃣ Чтобы узнать статистику, нажми кнопку "📊 Статистика"

⚠️ В данный момент поддерживается только Instagram
        `;
        bot.sendMessage(chatId, helpMessage);
        return;
    }

    // Если это не команда меню, обрабатываем как ссылку
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
    
    // Создаем клавиатуру меню с кнопками
    const mainMenu = {
        reply_markup: {
            keyboard: [
                [{ text: '📊 Статистика' }],
                [{ text: '❓ Помощь' }]
            ],
            resize_keyboard: true,
            persistent: true
        }
    };
    
    bot.sendMessage(chatId, greetingMessage, mainMenu);
});

// Поддерживаем также текстовую команду /stats для совместимости
bot.onText(/\/stats/, async (msg) => {
    await showUserStats(bot, msg);
});

// Обработчик callback кнопок
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    // Обработка кнопки "Повторить загрузку"
    if (data.startsWith('retry_')) {
        const url = data.substring(6); // Получаем URL из callback_data
        
        // Сообщаем пользователю о повторной попытке
        await bot.answerCallbackQuery(query.id, {
            text: 'Повторная загрузка...'
        });
        
        // Создаем объект сообщения для передачи в handleMessage
        const fakeMsg = {
            chat: { id: chatId },
            text: url,
            message_id: query.message.message_id
        };
        
        // Вместо удаления сообщения с кнопкой повтора, мы обновим его
        // это реализовано внутри handleMessage
        await handleMessage(bot, fakeMsg);
    }
});