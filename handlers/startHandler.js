const userStates = {};

function handleStart(bot, msg) {
    const chatId = msg.chat.id;

    // Очищаем состояние пользователя при новом старте
    delete userStates[chatId];

    userStates[chatId] = 'choosing_platform';

    bot.sendMessage(chatId, 'Привет! Из какой соцсети будем скачивать видео?', {
        reply_markup: {
            inline_keyboard: [[
                { text: 'Instagram', callback_data: 'Instagram' },
                { text: 'YouTube', callback_data: 'YouTube' }
            ]],
            remove_keyboard: true
        },
    });
}

module.exports = { handleStart, userStates };
