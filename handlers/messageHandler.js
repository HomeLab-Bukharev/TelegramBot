const { exec } = require('child_process');
const fs = require('fs');
const { userStates } = require('./startHandler');

async function handleMessage(bot, msg, startTime) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!userStates[chatId] || userStates[chatId] === 'choosing_platform') {
        return;
    }

    const platform = userStates[chatId];
    delete userStates[chatId];

    if (!text.startsWith('http')) {
        bot.sendMessage(chatId, 'Пожалуйста, отправьте корректную ссылку.');
        return;
    }

    if (platform === 'Instagram') {
        let currentMessage = await bot.sendMessage(chatId, 'Принято в работу: 0%');

        const tempOutputPath = `downloads/temp_video_${Date.now()}.mp4`;
        const finalOutputPath = tempOutputPath.replace('temp_', '');
        const cookiesPath = 'config/cookies.txt';

        if (!fs.existsSync(cookiesPath)) {
            await bot.editMessageText('Ошибка: Файл cookies отсутствует.', {
                chat_id: chatId,
                message_id: currentMessage.message_id,
            });
            return;
        }

        try {
            await updateProgress(bot, chatId, currentMessage.message_id, 'Скачивание видео', 25);
            const downloadCommand = `yt-dlp --cookies ${cookiesPath} -f bestvideo+bestaudio --merge-output-format mp4 -o "${tempOutputPath}" "${text}"`;
            await execPromise(downloadCommand);

            await updateProgress(bot, chatId, currentMessage.message_id, 'Перекодировка видео', 60);
            const ffmpegCommand = `ffmpeg -i "${tempOutputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart "${finalOutputPath}"`;
            await execPromise(ffmpegCommand);

            await updateProgress(bot, chatId, currentMessage.message_id, 'Отправка видео', 75);
            await bot.sendVideo(chatId, finalOutputPath);

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            await updateProgress(bot, chatId, currentMessage.message_id, `Успешно отправлено!\n\n✅ Выполнено за ${elapsedTime} секунд`, 100);
            
            bot.sendMessage(chatId, 'Откуда скачаем еще?', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Instagram', callback_data: 'Instagram' },
                        { text: 'YouTube', callback_data: 'YouTube' }
                    ]],
                    remove_keyboard: true
                },
            });
            userStates[chatId] = 'choosing_platform';
            
        } catch (error) {
            console.error(error.message);
            await bot.editMessageText('Ошибка при скачивании видео.', {
                chat_id: chatId,
                message_id: currentMessage.message_id,
            });
        } finally {
            if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
        }
    }
}

async function updateProgress(bot, chatId, messageId, stage, progress) {
    await bot.editMessageText(`Принято в работу: ${progress}%\n\nЭтап: ${stage}`, {
        chat_id: chatId,
        message_id: messageId,
    });
}

function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout.trim());
        });
    });
}

module.exports = { handleMessage };
