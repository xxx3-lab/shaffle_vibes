# Штатив — AI-генератор постов и пинов

Next.js 14. Всё приложение работает в Docker: Next.js-сервер + nginx-реверс-прокси.
Настройки, источники, история и загруженные картинки лежат в `./data` и переживают
любые пересборки контейнеров.

## Запуск локально (одна команда)

```bash
docker compose up -d --build
```

Открыть http://localhost. Если порт 80 занят:

```bash
HTTP_PORT=8080 docker compose up -d --build
```

Полезное:

```bash
docker compose logs -f app   # логи приложения
docker compose down          # остановить (данные в ./data останутся)
```

## Деплой на сервер (одна команда)

Скрипт запускается **с локальной машины** — он сам заливает код на сервер по SSH:

```bash
node scripts/deploy.js
# или
npm run deploy
```

Если код уже скачан прямо на сервере (`git clone`), скрипт не нужен — там
достаточно `docker compose up -d --build`.

Данные сервера берутся из `scripts/deploy.local.json` (не коммитится):

```json
{ "host": "1.2.3.4", "user": "root", "password": "...", "dir": "/opt/shtativ" }
```

Скрипт сам: пакует исходники (без `data/` и секретов), заливает по SSH, ставит
Docker, если его нет, гасит старый systemd-сервис и выполняет на сервере
`docker compose up -d --build`, затем ждёт HTTP 200 на порту 80.

Состояние и логи:

```bash
node scripts/deploy.js status
node scripts/deploy.js logs
```

## Как это устроено

- `Dockerfile` — multi-stage: полные `node_modules` → сборка Next.js
  (`output: "standalone"`) → минимальный runtime-образ. Внутри приложение
  работает от непривилегированного пользователя `nextjs` (uid 1001).
- `docker/app-entrypoint.sh` — при старте чинит права на `/app/data` и
  понижает права до `nextjs`.
- `docker-compose.yml` — сервисы `app` (Next.js, порт 3000 наружу не
  опубликован) и `nginx` (80 → `app:3000`). Приложение под healthcheck;
  nginx стартует, когда оно готово.
- `docker/nginx.conf` — прокси с заголовками `X-Forwarded-*`, кэшем на год
  для `/_next/static/` и таймаутом 300 с (генерация пачки постов через AI
  может идти несколько минут).

Обновление на сервере — та же команда `node scripts/deploy.js`; каталог
`data/` на сервере при этом не трогается.
