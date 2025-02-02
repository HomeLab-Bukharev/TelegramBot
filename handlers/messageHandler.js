const { exec } = require('child_process');
const fs = require('fs');

async function handleMessage(bot, msg, startTime) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!text.startsWith('http')) {
        bot.sendMessage(chatId, 'Пожалуйста, отправьте корректную ссылку.');
        return;
    }

    const platform = detectPlatform(text);

    if (platform === 'unknown') {
        bot.sendMessage(chatId, 'Не удалось определить соцсеть. Поддерживаются только Instagram.');
        return;
    }

    if (platform === 'YouTube') {
        bot.sendMessage(chatId, 'Функционал для скачивания с YouTube еще в разработке.');
        return;
    }

    if (platform === 'Instagram') {
        let currentMessage = await bot.sendMessage(chatId, `Определен: ${platform}\nЭтап: 0% | Начинаем загрузку...`);

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
            await updateProgress(bot, chatId, currentMessage.message_id, 'Скачивание видео', 25, platform);
            const downloadCommand = `yt-dlp --cookies ${cookiesPath} -f bestvideo+bestaudio --merge-output-format mp4 -o "${tempOutputPath}" "${text}"`;
            await execPromise(downloadCommand);

            await updateProgress(bot, chatId, currentMessage.message_id, 'Перекодировка видео', 60, platform);
            const ffmpegCommand = `ffmpeg -i "${tempOutputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart "${finalOutputPath}"`;
            await execPromise(ffmpegCommand);

            await updateProgress(bot, chatId, currentMessage.message_id, 'Отправка видео', 75, platform);
            await bot.sendVideo(chatId, finalOutputPath);

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            await updateProgress(bot, chatId, currentMessage.message_id, `✅ Успешно отправлено!`, 100, platform, elapsedTime);
            
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

function detectPlatform(url) {
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    return 'unknown';
}

async function updateProgress(bot, chatId, messageId, stage, progress, platform, elapsedTime = null) {
    let statusMessage = `Определен: ${platform}\nЭтап: ${progress}% | ${stage}`;
    
    if (progress === 100) {
        statusMessage = `Определен: ${platform}\nЭтап: 100% | Успешно отправлено!\n✅ Выполнено за ${elapsedTime} секунд`;
    }
    
    await bot.editMessageText(statusMessage, {
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