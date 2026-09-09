// Деплой Штатива на сервер в Docker одной командой:
//   node scripts/deploy.js            # полный деплой: упаковка → заливка → docker compose up -d --build
//   node scripts/deploy.js status     # состояние контейнеров и ответ на :80
//   node scripts/deploy.js logs       # свежие логи приложения
//
// Данные сервера читаются из scripts/deploy.local.json (не коммитится):
// { "host": "...", "user": "root", "password": "...", "dir": "/opt/shtativ" }
//
// Каталог DIR/data на сервере не трогается: настройки, история и картинки
// монтируются в контейнер как ./data:/app/data.
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "deploy.local.json"), "utf-8")
);
const HOST = cfg.host;
const USER = cfg.user || "root";
const PASS = cfg.password;
const DIR = cfg.dir || "/opt/shtativ";

const stage = process.argv[2] || "deploy";

// Что уезжает на сервер. Секреты (.env, deploy.local.json) и данные (data/)
// в пакет не входят никогда.
const INCLUDE = [
  "app",
  "components",
  "lib",
  "public",
  "docker",
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "tsconfig.json",
  "tailwind.config.ts",
  "postcss.config.mjs",
  ".eslintrc.json",
  "Dockerfile",
  "docker-compose.yml",
  ".dockerignore",
];

function buildTarball() {
  const files = INCLUDE.filter((f) => fs.existsSync(path.join(__dirname, "..", f)));
  const missing = INCLUDE.filter((f) => !fs.existsSync(path.join(__dirname, "..", f)));
  if (missing.length) {
    console.log(`(!) В пакете нет (файл не найден): ${missing.join(", ")}`);
  }
  const tarball = path.join(os.tmpdir(), "shtativ-deploy.tar.gz").replace(/\\/g, "/");
  console.log("=== Упаковка проекта ===");
  execFileSync("tar", ["-czf", tarball, ...files], { cwd: path.join(__dirname, "..") });
  const mb = (fs.statSync(tarball).size / 1024 / 1024).toFixed(1);
  console.log(`    ${tarball} (${mb} МБ)`);
  return tarball;
}

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", reject)
      .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 25000 });
  });
}

function run(conn, cmd, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      let errOut = "";
      const timer = setTimeout(() => stream.close(), timeoutMs);
      stream
        .on("data", (d) => {
          out += d;
          process.stdout.write(d);
        })
        .stderr.on("data", (d) => {
          errOut += d;
          process.stderr.write(d);
        })
        .on("close", (code) => {
          clearTimeout(timer);
          resolve({ code, out, errOut });
        });
    });
  });
}

function sftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
}

function sftpPut(s, local, remote) {
  return new Promise((resolve, reject) => {
    s.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
}

(async () => {
  const conn = await connect();
  console.log("=== SSH: подключено ===");

  if (stage === "deploy") {
    // 1. Старая установка на systemd держала порт 80 — гасим её и удаляем юнит.
    console.log("=== Убираем старый systemd-сервис (если был) ===");
    await run(conn, `systemctl disable --now shtativ >/dev/null 2>&1 || true; rm -f /etc/systemd/system/shtativ.service; systemctl daemon-reload >/dev/null 2>&1 || true`);

    // 2. Docker и compose-плагин, если их нет.
    console.log("=== Проверяем Docker ===");
    await run(conn, `command -v docker >/dev/null 2>&1 || (echo "Ставлю Docker..." && curl -fsSL https://get.docker.com | sh)`, 1200000);
    await run(conn, `docker compose version >/dev/null 2>&1 && echo "docker compose: ok" || (command -v docker-compose >/dev/null 2>&1 && echo "docker-compose: ok" || (echo "нет docker compose" && exit 1))`);

    // 3. Пакуем и заливаем исходники (каталог data на сервере не трогаем).
    const tarball = buildTarball();
    console.log("=== Загрузка архива ===");
    const s = await sftp(conn);
    await run(conn, `mkdir -p ${DIR} /tmp/deploy`);
    await sftpPut(s, tarball, "/tmp/deploy/shtativ.tar.gz");
    fs.unlinkSync(tarball);
    console.log("=== Распаковка ===");
    await run(conn, `cd ${DIR} && find . -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} + && tar -xzf /tmp/deploy/shtativ.tar.gz -C ${DIR} && rm /tmp/deploy/shtativ.tar.gz && ls ${DIR} | head -20`);

    // 4. Сборка образа и запуск. Лог сборки целиком — в /tmp/shtativ-deploy.log.
    console.log("=== docker compose up -d --build (сборка может занять несколько минут) ===");
    const up = await run(conn, `cd ${DIR} && if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi && $DC up -d --build > /tmp/shtativ-deploy.log 2>&1; code=$?; tail -n 30 /tmp/shtativ-deploy.log; exit $code`, 1800000);
    if (up.code !== 0) {
      throw new Error("docker compose up завершился с ошибкой — смотрите вывод выше");
    }

    // 5. Ждём готовности и проверяем.
    console.log("=== Ждём ответа на :80 ===");
    await run(conn, `code=000; for i in $(seq 1 40); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ || true); [ "$code" = "200" ] && break; sleep 3; done; echo "HTTP $code"; [ "$code" = "200" ]`, 180000);
    await run(conn, `(ufw status 2>/dev/null | grep -q "Status: active" && ufw allow 80/tcp || echo "ufw неактивен")`);
    await run(conn, `cd ${DIR} && if docker compose version >/dev/null 2>&1; then docker compose ps; else docker-compose ps; fi`);
  }

  if (stage === "status") {
    await run(conn, `cd ${DIR} && if docker compose version >/dev/null 2>&1; then docker compose ps; else docker-compose ps; fi; curl -s -o /dev/null -w "локальный ответ: %{http_code}\\n" http://127.0.0.1/ || true; df -h / | tail -1`);
  }

  if (stage === "logs") {
    await run(conn, `cd ${DIR} && if docker compose version >/dev/null 2>&1; then docker compose logs --tail=200 app; else docker-compose logs --tail=200 app; fi`);
  }

  conn.end();
  console.log(`=== Этап "${stage}" завершён ===`);
  process.exit(0);
})().catch((e) => {
  console.error("ОШИБКА:", e.message);
  process.exit(1);
});
