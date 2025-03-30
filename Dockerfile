FROM node:20-slim

# Устанавливаем необходимые зависимости
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем yt-dlp через официальный скрипт
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы проекта
COPY . .

# Создаем директорию для загрузок
RUN mkdir -p downloads

# Запускаем бота
CMD ["node", "bot.js"]