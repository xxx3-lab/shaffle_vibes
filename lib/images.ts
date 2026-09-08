import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function mimeByExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  return "application/octet-stream";
}

// Локальное хранение: файл живёт в data/uploads и отдаётся через /api/files/<name>.
// Работает всегда, без внешних сервисов.
export function saveLocalImage(buffer: Buffer, mime = "image/png"): string {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const ext = EXT_BY_MIME[mime] || "png";
  const name = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
  return `/api/files/${name}`;
}

export function readLocalImage(name: string): Buffer | null {
  if (!/^[a-z0-9]+\.(png|jpe?g|gif|webp|avif)$/i.test(name)) return null;
  const filePath = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

// Внешний хостинг (бонус для шаринга): catbox.moe, затем litterbox (72h).
// Оба — без регистрации. Возвращает URL или null, если сеть недоступна.
export async function uploadExternal(buffer: Buffer, filename = "image.png"): Promise<string | null> {
  const tryHost = async (url: string, extra: Record<string, string>): Promise<string | null> => {
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(extra)) fd.append(k, v);
      fd.append("fileToUpload", new Blob([new Uint8Array(buffer)], { type: "image/png" }), filename);
      const res = await fetch(url, { method: "POST", body: fd, signal: AbortSignal.timeout(60000) });
      const text = (await res.text()).trim();
      if (res.ok && text.startsWith("http")) return text;
      return null;
    } catch {
      return null;
    }
  };

  return (
    (await tryHost("https://catbox.moe/user/api.php", { reqtype: "fileupload" })) ||
    (await tryHost("https://litterbox.catbox.moe/resources/internals/api.php", {
      reqtype: "fileupload",
      time: "72h",
    }))
  );
}

export interface ScrapedPage {
  imageUrl: string | null;
  title: string;
  description: string;
}

function metaContent(html: string, prop: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return "";
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

// Скачивает HTML страницы (например, пина) и достаёт og:image + контекст.
export async function scrapePage(url: string): Promise<ScrapedPage> {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html,*/*" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Страница недоступна (HTTP ${res.status})`);
  const html = (await res.text()).slice(0, 400000);

  const imageUrlRaw = metaContent(html, "og:image");
  let imageUrl = imageUrlRaw ? decodeEntities(imageUrlRaw) : null;
  if (imageUrl && imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;

  const title = decodeEntities(metaContent(html, "og:title") || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || ""));
  const description = decodeEntities(metaContent(html, "og:description") || metaContent(html, "description"));

  return { imageUrl, title, description };
}

// Скачивает картинку и проверяет, что это действительно изображение.
export async function fetchImage(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "image/*,*/*" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Картинка недоступна (HTTP ${res.status})`);

  const mime = res.headers.get("content-type") || "";
  if (!mime.startsWith("image/")) {
    throw new Error(`Это не изображение (${mime || "неизвестный тип"}). Нужна прямая ссылка на картинку.`);
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_IMAGE_BYTES) throw new Error("Картинка больше 15 МБ");
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length < 100) throw new Error("Файл картинки пустой");
  return { buffer, mime };
}

// Загрузка картинки: локальный файл или URL. Возвращает буфер и mime.
export async function loadImage(
  src: string
): Promise<{ buffer: Buffer; mime: string }> {
  // Локальный файл (сохранённый ранее через saveLocalImage)
  if (src.startsWith("/api/files/")) {
    const name = src.replace("/api/files/", "");
    const buffer = readLocalImage(name);
    if (!buffer) throw new Error("Локальная картинка не найдена");
    return { buffer, mime: mimeByExt(name) };
  }

  const res = await fetch(src, {
    headers: { "User-Agent": BROWSER_UA, Accept: "image/*,*/*" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Картинка недоступна (HTTP ${res.status})`);

  const mime = res.headers.get("content-type") || "";
  if (!mime.startsWith("image/")) {
    throw new Error(`Это не изображение (${mime || "неизвестный тип"}). Нужна прямая ссылка на картинку.`);
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_IMAGE_BYTES) throw new Error("Картинка больше 15 МБ");
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length < 100) throw new Error("Файл картинки пустой");
  return { buffer, mime };
}

// ===== Постеры: размеры, шрифты, раскладки =====

export const POSTER_SIZES: Record<string, { w: number; h: number; label: string }> = {
  "4:5": { w: 1080, h: 1350, label: "Пост 4:5" },
  "1:1": { w: 1080, h: 1080, label: "Квадрат 1:1" },
  "9:16": { w: 1080, h: 1920, label: "Сторис 9:16" },
  "16:9": { w: 1280, h: 720, label: "Обложка 16:9" },
};

// Шрифты, которые гарантированно есть в Windows и доступны движку рендера
export const POSTER_FONTS = [
  "Arial Black",
  "Impact",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Times New Roman",
  "Consolas",
  "Comic Sans MS",
];

export const POSTER_LAYOUTS = ["meme", "bottom", "top", "center", "band", "panel"] as const;
export type PosterLayout = (typeof POSTER_LAYOUTS)[number];

export const LAYOUT_LABELS: Record<PosterLayout, string> = {
  meme: "Мем-постер",
  bottom: "Внизу",
  top: "Вверху",
  center: "По центру",
  band: "Плашка",
  panel: "Панель",
};

export interface MemeLayoutTexts {
  script: string;
  main: string;
  quips: string[];
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? current + " " + w : w;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 14);
}

export async function makePoster(
  imageBuffer: Buffer,
  text: string,
  opts?: {
    size?: string;
    font?: string;
    layout?: PosterLayout;
    memeTexts?: MemeLayoutTexts;
    color?: string;
  }
): Promise<Buffer> {
  const size = POSTER_SIZES[opts?.size || ""] || POSTER_SIZES["4:5"];
  const W = size.w;
  const H = size.h;
  const font = POSTER_FONTS.includes(opts?.font || "") ? opts!.font! : "Arial Black";
  const layout: PosterLayout = (opts?.layout as PosterLayout) || "bottom";

  // Кадрируем под выбранный формат с покрытием.
  let coverOp = sharp(imageBuffer, { failOn: "none" })
    .rotate()
    .resize(W, H, { fit: "cover", position: sharp.strategy.attention });

  if (layout === "meme") {
    // Мем-постер: светлая мягкая подложка, как в референсе
    coverOp = coverOp.modulate({ brightness: 1.08, saturation: 0.9 });
  } else {
    coverOp = coverOp.modulate({ saturation: 1.05 });
  }
  const cover = await coverOp.toBuffer();

  // Адаптивный кегль: короткая фраза — крупно, длинная речь — мельче.
  const baseFont =
    text.length <= 90 ? 83 : text.length <= 200 ? 63 : text.length <= 350 ? 49 : 41;
  const fontSize = Math.max(22, Math.round(baseFont * (W / 1080)));
  // Поля 7% с каждой стороны; средняя ширина жирного кириллического символа ~0.63em
  const usable = W * 0.86;
  const maxChars = Math.max(10, Math.floor(usable / (fontSize * 0.63)));
  const lines = wrapText(text, maxChars);
  const lineHeight = Math.round(fontSize * 1.25);
  const blockH = lines.length * lineHeight;
  const margin = Math.round(W * 0.07);

  const tspansAt = (startY: number, x: number) =>
    lines
      .map(
        (line, i) =>
          `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("");

  const textEl = (startY: number, fill: string, x: number, anchor: "start" | "middle" = "start") =>
    `<text font-family="${font}" font-weight="700" font-size="${fontSize}" fill="${fill}" text-anchor="${anchor}" xml:space="preserve">${tspansAt(startY, x)}</text>`;

  let svg = "";

  if (layout === "meme") {
    const m = opts?.memeTexts;
    const accent = /^#[0-9a-fA-F]{6}$/.test(opts?.color || "") ? opts!.color! : "#5e7031";
    const quipColor = "#3c4030";
    const quipFont = Math.max(13, Math.round((W / 1080) * 30));
    const scriptFont = Math.round((W / 1080) * 92);
    const mainFont = Math.round((W / 1080) * 108);

    const mainLineMax = Math.max(6, Math.floor((W * 0.8) / (mainFont * 0.72)));
    const mainLines = wrapText((m?.main || text || "СДЕЛАЙ САМ").toUpperCase(), mainLineMax).slice(0, 3);
    const mainLineH = Math.round(mainFont * 1.08);
    const scriptTxt = (m?.script || "").slice(0, 24);

    const quipEls: string[] = [];
    const quipAt = (str: string, x: number, y: number, anchor: "start" | "end", light = false) => {
      if (!str) return "";
      const main = `<text x="${x}" y="${y}" font-family="Verdana" font-size="${quipFont}" fill="${light ? "#ffffff" : quipColor}" text-anchor="${anchor}" xml:space="preserve">${escapeXml(str)}</text>`;
      return light
        ? `<text x="${x + 2}" y="${y + 2}" font-family="Verdana" font-size="${quipFont}" fill="rgba(0,0,0,0.55)" text-anchor="${anchor}" xml:space="preserve">${escapeXml(str)}</text>` + main
        : main;
    };

    const quips = m?.quips || [];
    const qx1 = margin;
    const qx2 = W - margin;
    const qy1 = Math.round(H * 0.075);
    const qy2 = Math.round(H - Math.round(H * 0.045) - quipFont);
    quipEls.push(
      quipAt(quips[0] || "", qx1, qy1, "start"),
      quipAt(quips[1] || "", qx2, qy1, "end"),
      quipAt(quips[2] || "", qx1, qy2, "start", true),
      quipAt(quips[3] || "", qx2, qy2, "end", true)
    );

    const scriptY = Math.round(H * 0.245);
    const mainY = Math.round(H * 0.335);

    svg = `
      <defs>
        <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(255,255,255,0.82)"/>
          <stop offset="0.42" stop-color="rgba(255,255,255,0.5)"/>
          <stop offset="0.62" stop-color="rgba(255,255,255,0.12)"/>
          <stop offset="1" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="rgba(255,255,255,0.14)"/>
      <rect width="${W}" height="${H}" fill="url(#w)"/>
      ${quipEls.join("\n      ")}
      ${
        scriptTxt
          ? `<text x="${Math.round(W / 2)}" y="${scriptY}" font-family="Segoe Script" font-size="${scriptFont}" fill="${accent}" text-anchor="middle" xml:space="preserve">${escapeXml(scriptTxt)}</text>`
          : ""
      }
      ${mainLines
        .map(
          (line, i) =>
            `<text x="${Math.round(W / 2)}" y="${mainY + i * mainLineH}" font-family="Arial Black" font-weight="700" font-size="${mainFont}" fill="${accent}" text-anchor="middle" letter-spacing="2" xml:space="preserve">${escapeXml(line)}</text>`
        )
        .join("\n      ")}`;
  } else if (layout === "bottom" || layout === "top") {
    const topHeavy = layout === "top";
    svg = `
      <defs>
        <linearGradient id="g" x1="0" y1="${topHeavy ? 0 : 1}" x2="0" y2="${topHeavy ? 1 : 0}">
          <stop offset="0" stop-color="rgba(0,0,0,0.85)"/>
          <stop offset="0.55" stop-color="rgba(0,0,0,0.35)"/>
          <stop offset="1" stop-color="rgba(0,0,0,0.05)"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      ${textEl(topHeavy ? Math.round(H * 0.08) + fontSize : Math.max(Math.round(H * 0.07), H - blockH - Math.round(H * 0.09)), "#ffffff", margin)}`;
  } else if (layout === "center") {
    svg = `
      <rect width="${W}" height="${H}" fill="rgba(0,0,0,0.52)"/>
      ${textEl(Math.round((H - blockH) / 2 + fontSize * 0.85), "#ffffff", Math.round(W / 2), "middle")}`;
  } else if (layout === "band") {
    const bandPad = Math.round(fontSize * 0.8);
    const bandH = blockH + bandPad * 2;
    const bandY = H - bandH - Math.round(H * 0.06);
    svg = `
      <rect width="${W}" height="${H}" fill="rgba(0,0,0,0.12)"/>
      <rect x="0" y="${bandY}" width="${W}" height="${bandH}" fill="rgba(20,19,18,0.92)"/>
      <rect x="0" y="${bandY}" width="${Math.round(W * 0.014)}" height="${bandH}" fill="#5b2ee5"/>
      ${textEl(bandY + bandPad + Math.round(fontSize * 0.85), "#ffffff", margin)}`;
  } else {
    // panel: белая панель снизу, тёмный текст, акцентная полоса
    const pad = Math.round(fontSize * 0.75);
    const panelH = blockH + pad * 2;
    const panelY = H - panelH;
    svg = `
      <rect x="0" y="${panelY}" width="${W}" height="${panelH}" fill="#f7f4ee"/>
      <rect x="0" y="${panelY}" width="${W}" height="10" fill="#5b2ee5"/>
      ${textEl(panelY + pad + Math.round(fontSize * 0.85), "#141312", margin)}`;
  }

  const overlay = Buffer.from(`<svg width="${W}" height="${H}">${svg}</svg>`);

  return sharp(cover)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ quality: 92 })
    .toBuffer();
}

// ===== Подбор стоковых картинок по теме (Wikimedia Commons, без регистрации) =====

export interface StockImage {
  title: string;
  url: string;
  pageUrl: string;
  width: number;
  height: number;
}

export async function searchCommonsImages(query: string, offset = 0): Promise<StockImage[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrnamespace", "6");
  u.searchParams.set("gsrsearch", query + " filetype:bitmap");
  u.searchParams.set("gsrlimit", "10");
  u.searchParams.set("gsroffset", String(offset));
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("iiprop", "url|size|mime");
  u.searchParams.set("iiurlwidth", "1400");
  u.searchParams.set("format", "json");
  u.searchParams.set("origin", "*");

  const res = await fetch(u, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const pages: Record<string, {
    title?: string;
    imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number; mime?: string; descriptionurl?: string }[];
  }>[] = [data.query?.pages || {}];
  const list = Object.values(pages[0]) as {
    title?: string;
    imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number; mime?: string; descriptionurl?: string }[];
  }[];

  return list
    .map((p) => {
      const ii = p.imageinfo?.[0];
      return {
        title: (p.title || "").replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
        url: ii?.thumburl || ii?.url || "",
        pageUrl: ii?.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title || "")}`,
        width: ii?.width || 0,
        height: ii?.height || 0,
        mime: ii?.mime || "",
      };
    })
    .filter((r) => r.url && /image\/(jpeg|png|webp)/.test(r.mime) && r.width >= 700)
    .slice(0, 10);
}

// Пробует скачать первые подходящие картинки; возвращает первую успешную.
export async function pickStockImage(
  query: string,
  offset = 0
): Promise<{ buffer: Buffer; mime: string; image: StockImage } | null> {
  const candidates = (await searchCommonsImages(query, offset)).filter(
    (c) => c.height === 0 || c.width / Math.max(c.height, 1) < 3.5
  );
  if (!candidates.length) {
    // Слишком узкий запрос — пробуем первые два слова
    const short = query.split(/s+/).slice(0, 2).join(" ");
    if (short && short !== query) return pickStockImage(short, offset);
    return null;
  }
  for (const candidate of candidates.slice(0, 4)) {
    try {
      const { buffer, mime } = await fetchImage(candidate.url);
      return { buffer, mime, image: candidate };
    } catch {
      // пробуем следующую
    }
  }
  return null;
}
