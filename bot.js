require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { handleMessage } = require('./handlers/messageHandler');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    if (msg.text === '/start') {
        bot.sendMessage(msg.chat.id, 'Отправьте ссылку на видео.');
    }
});

bot.on('message', async (msg) => {
    if (msg.text.startsWith('/')) return; // Игнорируем команды кроме /start
    
    const startTime = Date.now();
    await handleMessage(bot, msg, startTime);
});