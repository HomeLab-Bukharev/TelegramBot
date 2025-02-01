const { userStates } = require('./startHandler');

function handleCallbackQuery(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const platform = callbackQuery.data;

    userStates[chatId] = platform;

    if (platform === 'YouTube') {
        bot.sendMessage(chatId, 'Функционал для скачивания с YouTube еще в разработке.');
        delete userStates[chatId];
    } else {
        bot.sendMessage(chatId, 'Отправьте ссылку на видео.', {
            reply_markup: { remove_keyboard: true },
        });
    }
    bot.answerCallbackQuery(callbackQuery.id);
}

module.exports = { handleCallbackQuery };
