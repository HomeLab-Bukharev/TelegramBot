require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleStart } = require('./handlers/startHandler');
const { handleCallbackQuery } = require('./handlers/callbackHandler');
const { handleMessage } = require('./handlers/messageHandler');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.on('callback_query', (callbackQuery) => handleCallbackQuery(bot, callbackQuery));
bot.on('message', async (msg) => {
    const startTime = Date.now();
    await handleMessage(bot, msg, startTime);
});
