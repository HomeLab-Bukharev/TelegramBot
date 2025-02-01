const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const fs = require('fs');

// Токен вашего бота
const BOT_TOKEN = ;

// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Привет! Отправь мне ссылку на рилс, и я скачаю его для тебя.');
});

// Обработчик текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const url = msg.text.trim();

  // Проверяем, является ли сообщение ссылкой
  if (!url.startsWith('http')) {
    bot.sendMessage(chatId, 'Пожалуйста, отправь корректную ссылку.');
    return;
  }

  bot.sendMessage(chatId, 'Скачиваю видео, подожди немного...');

  const outputPath = `downloads/video_${Date.now()}.mp4`;

  // Скачивание видео с помощью yt-dlp
  exec(`yt-dlp -o "${outputPath}" "${url}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка при скачивании: ${error.message}`);
      bot.sendMessage(chatId, 'Не удалось скачать видео. Попробуй другую ссылку.');
      return;
    }

    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }

    console.log(`stdout: ${stdout}`);

    // Отправляем видео пользователю
    bot.sendVideo(chatId, outputPath)
      .then(() => {
        // Удаляем файл после отправки
        fs.unlinkSync(outputPath);
      })
      .catch((err) => {
        console.error(`Ошибка при отправке файла: ${err.message}`);
        bot.sendMessage(chatId, 'Ошибка при отправке видео.');
      });
  });
});
