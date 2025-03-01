const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { detectPlatform, logTask, updateTaskStatus, updateDownloadSize, updateFinalSize } = require('./database');

async function handleMessage(bot, msg) {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const text = msg.text.trim();

    if (text.startsWith('/')) {
        return; // Игнорируем команды, например /start
    }

    if (!text.startsWith('http')) {
        bot.sendMessage(chatId, '❌ Пожалуйста, отправьте корректную ссылку.');
        return;
    }

    const platform = detectPlatform(text);
    if (platform === 'unknown') {
        bot.sendMessage(chatId, '❌ Не удалось определить соцсеть.');
        return;
    }

    // Удаляем сообщение пользователя с ссылкой
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (error) {
        console.log("Не удалось удалить сообщение: ", error.message);
        // Продолжаем работу даже если не удалось удалить (например, в групповых чатах)
    }

    const taskId = await logTask(chatId, text, platform);

    // Создаем сообщение с прогрессом, включая ссылку
    const initialMessage = `🔗 <b>Ссылка:</b> ${text}\n\n🔄 <b>Обработка видео...</b>`;
    let progressMessage = await bot.sendMessage(chatId, initialMessage, {parse_mode: 'HTML'});

    const startTime = Date.now();
    const tempOutputPath = `downloads/temp_video_${Date.now()}.mp4`;
    const finalOutputPath = tempOutputPath.replace('temp_', '');

    // Создаем директорию для загрузок, если ее нет
    const downloadsDir = path.dirname(tempOutputPath);
    if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
    }

    try {
        await updateProgress(bot, chatId, progressMessage.message_id, '📥 Скачивание', 25, platform, text);

        const downloadCommand = `yt-dlp -f bestvideo+bestaudio --merge-output-format mp4 -o "${tempOutputPath}" "${text}"`;
        await execPromise(downloadCommand);

        const downloadSize = getFileSize(tempOutputPath);
        await updateDownloadSize(taskId, downloadSize); // Сохраняем размер скачанного файла

        await updateProgress(bot, chatId, progressMessage.message_id, '🎞 Перекодировка', 60, platform, text);

        const ffmpegCommand = `ffmpeg -i "${tempOutputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${finalOutputPath}"`;
        await execPromise(ffmpegCommand);

        const finalSize = getFileSize(finalOutputPath);
        await updateFinalSize(taskId, finalSize); // Сохраняем размер отправленного файла

        await updateProgress(bot, chatId, progressMessage.message_id, '📤 Отправка видео', 90, platform, text);

        // Вычисляем время выполнения
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1); // в секундах

        // Формируем итоговый текст с информацией
        const successCaption = `
🎥 <b>Видео успешно загружено!</b>
🔗 <a href="${text}">Исходная ссылка</a>
⏱ Время загрузки: ${duration} сек.
📦 Размер файла: ${finalSize} MB
📱 Платформа: ${platform}
        `;

        // Отправляем видео с подписью
        await bot.sendVideo(chatId, finalOutputPath, {
            caption: successCaption,
            parse_mode: 'HTML'
        });

        // Удаляем сообщение с прогрессом после успешной отправки видео
        await bot.deleteMessage(chatId, progressMessage.message_id);

        await updateTaskStatus(taskId, 'success');

    } catch (error) {
        console.error("❌ Ошибка:", error.message);
        
        // Создаем кнопку "Повторить" для неудачной загрузки
        const retryButton = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Повторить загрузку', callback_data: `retry_${text}` }]
                ]
            }
        };
        
        // Обновляем сообщение с информацией об ошибке и кнопкой повтора
        await bot.editMessageText(`❌ <b>Ошибка при загрузке видео</b>\n\n🔗 <a href="${text}">Исходная ссылка</a>\n\n${error.message}`, {
            chat_id: chatId,
            message_id: progressMessage.message_id,
            parse_mode: 'HTML',
            ...retryButton
        });
        
        await updateTaskStatus(taskId, 'failed');
    } finally {
        // Удаляем временные файлы
        if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
    }
}

async function updateProgress(bot, chatId, messageId, stage, progress, platform, url) {
    let statusMessage = `🔗 <b>Ссылка:</b> <a href="${url}">${url}</a>\n\n`;
    statusMessage += `🔄 <b>Платформа:</b> ${platform}\n`;
    statusMessage += `📊 <b>Прогресс:</b> ${progress}%\n`;
    statusMessage += `${stage}`;
    
    await bot.editMessageText(statusMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML'
    });
}

function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return (stats.size / (1024 * 1024)).toFixed(2);
    } catch (error) {
        console.error("❌ Ошибка получения размера файла:", error.message);
        return null;
    }
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