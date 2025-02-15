const { exec } = require('child_process');
const fs = require('fs');
const { detectPlatform, logTask, updateTaskStatus } = require('./database');

async function handleMessage(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!text.startsWith('http')) {
        bot.sendMessage(chatId, '❌ Пожалуйста, отправьте корректную ссылку.');
        return;
    }

    const platform = detectPlatform(text);
    if (platform === 'unknown') {
        bot.sendMessage(chatId, '❌ Не удалось определить соцсеть.');
        return;
    }

    // Логируем задачу в БД
    const taskId = await logTask(chatId, text, platform);

    // Отправляем первое сообщение с прогрессом
    let progressMessage = await bot.sendMessage(chatId, `🔄 Обработка видео...`);

    // Пути для сохранения файлов
    const tempOutputPath = `downloads/temp_video_${Date.now()}.mp4`;
    const finalOutputPath = tempOutputPath.replace('temp_', '');

    try {
        // Обновляем сообщение с прогрессом
        await updateProgress(bot, chatId, progressMessage.message_id, '📥 Скачивание', 25, platform);

        // Скачивание видео
        const downloadCommand = `yt-dlp -f bestvideo+bestaudio --merge-output-format mp4 -o "${tempOutputPath}" "${text}"`;
        await execPromise(downloadCommand);

        // Обновляем прогресс
        await updateProgress(bot, chatId, progressMessage.message_id, '🎞 Перекодировка', 60, platform);

        // Перекодировка
        const ffmpegCommand = `ffmpeg -i "${tempOutputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${finalOutputPath}"`;
        await execPromise(ffmpegCommand);

        // Обновляем прогресс
        await updateProgress(bot, chatId, progressMessage.message_id, '📤 Отправка видео', 90, platform);

        // Отправляем видео
        await bot.sendVideo(chatId, finalOutputPath);

        // Обновляем прогресс и логируем успешное выполнение
        await updateProgress(bot, chatId, progressMessage.message_id, '✅ Успешно отправлено!', 100, platform);
        await updateTaskStatus(taskId, 'success');

    } catch (error) {
        console.error("❌ Ошибка:", error.message);
        await bot.editMessageText('❌ Ошибка при скачивании видео.', {
            chat_id: chatId,
            message_id: progressMessage.message_id,
        });
        await updateTaskStatus(taskId, 'failed');
    } finally {
        if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
    }
}

/**
 * Функция обновления прогресса в чате
 */
async function updateProgress(bot, chatId, messageId, stage, progress, platform) {
    let statusMessage = `🔄 Платформа: ${platform}\n📊 Прогресс: ${progress}%\n${stage}`;
    await bot.editMessageText(statusMessage, {
        chat_id: chatId,
        message_id: messageId,
    });
}

/**
 * Запуск команд в терминале с промисами
 */
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
