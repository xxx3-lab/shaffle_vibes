// Деплой Штатива на сервер по SSH.
// Использование: node scripts/deploy.js <этап>   (этапы: upload | setup | build | start | status)
// Данные сервера читаются из scripts/deploy.local.json (не коммитится):
// { "host": "...", "user": "root", "password": "..." }
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "deploy.local.json"), "utf-8")
);
const HOST = cfg.host;
const USER = cfg.user || "root";
const PASS = cfg.password;
const DIR = cfg.dir || "/opt/shtativ";

const stage = process.argv[2] || "upload";

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", reject)
      .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 25000 });
  });
}

function run(conn, cmd, timeoutMs = 600000) {
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
    const fastPut = s.fastPut.bind(s);
    fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
}

(async () => {
  const conn = await connect();
  console.log("=== SSH: подключено ===");

  if (stage === "upload") {
    console.log("=== Загрузка архива ===");
    const s = await sftp(conn);
    await run(conn, `mkdir -p ${DIR} /tmp/deploy`);
    await sftpPut(s, process.env.TARBALL, "/tmp/deploy/shtativ.tar.gz");
    console.log("=== Распаковка ===");
    await run(conn, `cd ${DIR} && find . -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} + && tar -xzf /tmp/deploy/shtativ.tar.gz -C ${DIR} && ls ${DIR} | head -20`);
    await run(conn, `rm /tmp/deploy/shtativ.tar.gz`);
    console.log("=== Загружено ===");
  }

  if (stage === "setup") {
    console.log("=== Установка Node.js ===");
    await run(conn, `node -v 2>/dev/null || (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs npm)`, 900000);
    await run(conn, `node -v && npm -v`);
    // Если Node старее 18 — ставим NodeSource 20
    const { out } = await run(conn, `node -v | grep -oP '\\d+' | head -1`);
    const major = parseInt(out.trim(), 10);
    if (!major || major < 18) {
      console.log("=== Node устарел, ставим Node 20 из NodeSource ===");
      await run(conn, `curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs`, 900000);
      await run(conn, `node -v && npm -v`);
    }
    console.log("=== npm install (может занять несколько минут) ===");
    await run(conn, `cd ${DIR} && npm install --no-audit --no-fund 2>&1 | tail -5`, 900000);
  }

  if (stage === "build") {
    console.log("=== Сборка Next.js ===");
    await run(conn, `cd ${DIR} && NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -15`, 900000);
  }

  if (stage === "start") {
    console.log("=== Настройка systemd-сервиса ===");
    const unit = `[Unit]
Description=Shtativ - AI news poster
After=network.target

[Service]
Type=simple
WorkingDirectory=${DIR}
Environment=NODE_ENV=production
Environment=PORT=80
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
MemoryMax=1800M

[Install]
WantedBy=multi-user.target
`;
    await run(conn, `cat > /etc/systemd/system/shtativ.service << 'EOF'\n${unit}\nEOF`);
    await run(conn, `systemctl daemon-reload && systemctl enable shtativ && systemctl restart shtativ`);
    await run(conn, `sleep 4 && systemctl is-active shtativ && (ufw status | grep -q "Status: active" && ufw allow 80/tcp || echo "ufw неактивен")`);
    await run(conn, `curl -s -o /dev/null -w "локальный ответ: %{http_code}\\n" http://localhost/ || true`);
  }

  if (stage === "status") {
    await run(conn, `systemctl is-active shtativ; systemctl status shtativ --no-pager -l | head -12; curl -s -o /dev/null -w "локальный ответ: %{http_code}\\n" http://localhost/ || true`);
  }

  conn.end();
  console.log(`=== Этап "${stage}" завершён ===`);
  process.exit(0);
})().catch((e) => {
  console.error("ОШИБКА:", e.message);
  process.exit(1);
});
