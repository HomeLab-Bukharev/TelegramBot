require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userStates = {}; // Храним состояние пользователя

bot.onText(/\/start/, (msg) => {
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
});

bot.on('callback_query', async (callbackQuery) => {
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
});

bot.on('message', async (msg) => {
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
      await updateProgress(chatId, currentMessage.message_id, 'Скачивание видео', 25);
      const downloadCommand = `yt-dlp --cookies ${cookiesPath} -f bestvideo+bestaudio --merge-output-format mp4 -o "${tempOutputPath}" "${text}"`;
      await execPromise(downloadCommand);

      await updateProgress(chatId, currentMessage.message_id, 'Перекодировка видео', 60);
      const ffmpegCommand = `ffmpeg -i "${tempOutputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart "${finalOutputPath}"`;
      await execPromise(ffmpegCommand);

      await updateProgress(chatId, currentMessage.message_id, 'Отправка видео', 75);
      await bot.sendVideo(chatId, finalOutputPath);
      await updateProgress(chatId, currentMessage.message_id, 'Успешно отправлено!', 100);
      
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
});

async function updateProgress(chatId, messageId, stage, progress) {
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
