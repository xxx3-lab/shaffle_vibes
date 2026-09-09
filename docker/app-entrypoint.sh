#!/bin/sh
set -e

# Приложение обязано работать от непривилегированного пользователя, но ему нужен
# доступ на запись в /app/data (volume). Контейнер стартует от root, чинит права
# на каталог данных и сразу понижает себя до nextjs. Если контейнер запущен с
# --user, просто выполняем команду как есть.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  if [ "$(stat -c %u /app/data)" != "1001" ]; then
    # на Windows-биндмаунтах chown ничего не делает — не считаем это ошибкой
    chown -R nextjs:nodejs /app/data 2>/dev/null || true
  fi
  exec su-exec nextjs:nodejs "$@"
fi

exec "$@"
