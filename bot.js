const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const fs = require('fs');

// Токен вашего бота
const BOT_TOKEN = '';


// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Функция для обновления прогресса
const updateProgress = async (chatId, messageId, stage, progress) => {
  await bot.editMessageText(
    `Принято в работу: ${progress}%\n\nЭтап: ${stage}`,
    { chat_id: chatId, message_id: messageId }
  );
};

// Обёртка для exec в виде промиса
const execPromise = (command) =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });

// Обработчик команд
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Привет! Отправь мне ссылку на рилс, и я скачаю его для тебя.');
});

// Основной обработчик сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const url = msg.text.trim();

  if (!url.startsWith('http')) {
    bot.sendMessage(chatId, 'Пожалуйста, отправь корректную ссылку.');
    return;
  }

  // Отправляем стартовое сообщение
  let currentMessage = await bot.sendMessage(chatId, 'Принято в работу: 0%');

  const tempOutputPath = `downloads/temp_video_${Date.now()}.mp4`; // Временный файл
  const finalOutputPath = tempOutputPath.replace('temp_', '');     // Итоговый файл
  const cookiesPath = 'config/cookies.txt'; // Путь к cookies

  // Проверяем наличие cookies
  if (!fs.existsSync(cookiesPath)) {
    await bot.editMessageText(
      'Ошибка: Файл cookies отсутствует. Убедитесь, что файл config/cookies.txt существует.',
      { chat_id: chatId, message_id: currentMessage.message_id }
    );
    return;
  }

  try {
    // 🔥 ШАГ 1: Скачивание видео
    await updateProgress(chatId, currentMessage.message_id, 'Скачивание видео', 25);
    const downloadCommand = `yt-dlp --cookies ${cookiesPath} -f bestvideo+bestaudio --merge-output-format mp4 -o "${tempOutputPath}" "${url}"`;
    await execPromise(downloadCommand);

    // 🔥 ШАГ 2: Проверка разрешения и кодека
    await updateProgress(chatId, currentMessage.message_id, 'Анализ видео', 40);
    const resolutionCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${tempOutputPath}"`;
    const resolution = await execPromise(resolutionCommand);
    const [width, height] = resolution.split(',');

    console.log(`Видео разрешение: ${width}x${height}`);

    const checkCodecCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${tempOutputPath}"`;
    const codec = await execPromise(checkCodecCommand);

    console.log(`Кодек видео: ${codec}`);

    // 🔥 ШАГ 3: Перекодировка для Telegram
    await updateProgress(chatId, currentMessage.message_id, 'Перекодировка видео', 60);

    const ffmpegCommand = `ffmpeg -i "${tempOutputPath}" -vf "scale=${width}:${height},setsar=1:1,format=yuv420p" \
      -c:v libx264 -profile:v baseline -level 3.0 -preset fast -crf 23 \
      -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart \
      "${finalOutputPath}"`;

    await execPromise(ffmpegCommand);

    // 🔥 ШАГ 4: Отправка видео
    await updateProgress(chatId, currentMessage.message_id, 'Отправка видео', 75);
    await bot.sendVideo(chatId, finalOutputPath);
    await updateProgress(chatId, currentMessage.message_id, 'Успешно отправлено!', 100);
  } catch (error) {
    console.error(error.message);

    let errorMessage = 'Произошла ошибка при скачивании видео.';

    if (error.message.includes('rate-limit')) {
      errorMessage = 'Ошибка: Instagram временно ограничил доступ (rate-limit). Попробуйте позже.';
    } else if (error.message.includes('login required')) {
      errorMessage = 'Ошибка: Требуется авторизация. Проверьте файл cookies.txt.';
    } else if (error.message.includes('Unable to extract video url')) {
      errorMessage = 'Ошибка: Не удалось извлечь URL видео. Проверьте ссылку.';
    } else {
      errorMessage += `\n\nЛог:\n${error.message}`;
    }

    await bot.editMessageText(errorMessage, {
      chat_id: chatId,
      message_id: currentMessage.message_id,
    });
  } finally {
    // Очистка файлов
    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
  }
});