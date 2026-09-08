import http from "http";
import type { Settings } from "./types";
import type { HistoryEntry } from "./types";
import {
  STYLE_LIBRARY,
  STYLE_SEQUENCE,
  EMOJI_MAP,
  GREETINGS,
  CLOSINGS,
  randomChoice,
  randomHashtags,
} from "./content";

function escapeHtml(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function cleanHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function removeMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/```html/g, "")
    .replace(/```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/(?<!\w)\*(.*?)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_(.*?)_(?!\w)/g, "$1")
    .trim();
}

function normalizeForSimilarity(text: string): string {
  if (!text) return "";
  return cleanHtml(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#[\wа-яё-]+/gi, " ")
    .replace(/[^a-zа-яё0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getIntro(text: string, words = 24): string {
  return normalizeForSimilarity(text).split(" ").slice(0, words).join(" ");
}

// Триграммная похожесть — аналог difflib.SequenceMatcher из скрипта.
export function similarity(a: string, b: string): number {
  const na = normalizeForSimilarity(a);
  const nb = normalizeForSimilarity(b);
  if (!na || !nb) return 0;
  const gram = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 2; i++) {
      const g = s.slice(i, i + 3);
      set.set(g, (set.get(g) || 0) + 1);
    }
    return set;
  };
  const ga = gram(na);
  const gb = gram(nb);
  let overlap = 0;
  for (const [g, count] of ga) overlap += Math.min(count, gb.get(g) || 0);
  const total =
    [...ga.values()].reduce((s, v) => s + v, 0) +
    [...gb.values()].reduce((s, v) => s + v, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

function postFingerprint(text: string): string {
  return Buffer.from(normalizeForSimilarity(text), "utf-8").toString("base64");
}

function trimToLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const linkMatch = text.match(/<a\b[^>]*href="([^"]+)"[^>]*>.*?<\/a>/is);
  const link = linkMatch ? linkMatch[0] : "";

  const body = text.replace(/\n*<a\b[^>]*>.*?<\/a>\s*/gis, "").trim();
  const hashtags = body.match(/#[\wа-яё-]+/gi) || [];
  const bodyWithoutTags = body.replace(/\s*(#[\wа-яё-]+(?:\s+|$))+/gi, " ").trim();

  const suffix = link ? "\n\n" + link : "";
  const available = maxLength - suffix.length;
  if (available < 100) return body.slice(0, maxLength);

  let candidate = bodyWithoutTags.slice(0, available).replace(/\s+$/, "");

  while (candidate.split("<").length > candidate.split(">").length && candidate) {
    candidate = candidate.slice(0, -1);
  }

  const cutPoints = [
    candidate.lastIndexOf("\n"),
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
  ];
  const best = Math.max(...cutPoints);
  if (best > available * 0.6) {
    candidate = candidate.slice(0, best + 1).replace(/\s+$/, "");
  }

  if (hashtags.length) {
    const tagLine = [...new Set(hashtags.slice(0, 3))].join(" ");
    if (candidate.length + tagLine.length + 2 + suffix.length <= maxLength) {
      candidate += "\n\n" + tagLine;
    }
  }

  return (candidate + suffix).slice(0, maxLength);
}

// ===== AI =====

export async function aiRequest(
  settings: Settings,
  messages: { role: string; content: string }[],
  temperature?: number
): Promise<string> {
  const payload = JSON.stringify({
    model: settings.aiModel,
    messages,
    temperature: temperature ?? settings.aiTemperature,
    max_tokens: settings.aiMaxTokens,
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: settings.aiHost,
        port: settings.aiPort,
        path: "/v1/chat/completions",
        method: "POST",
        timeout: 60000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`AI HTTP ${res.statusCode}: ${raw.slice(0, 500)}`));
              return;
            }
            const data = JSON.parse(raw);
            const choices = data.choices || [];
            if (!choices.length) {
              reject(new Error("AI не вернул choices"));
              return;
            }
            resolve(String(choices[0].message.content).trim());
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("AI timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function buildHistoryContext(history: HistoryEntry[]): string {
  if (!history.length) return "История публикаций отсутствует. Можно писать свободно.";
  return history
    .slice(0, 6)
    .map(
      (h) =>
        `- стиль: ${h.style}; заголовок: ${h.title}; начало: ${getIntro(h.postText)}`
    )
    .join("\n");
}

function buildPrompt(
  news: { title: string; description: string; link: string; author: string; categories: string[] },
  style: string,
  settings: Settings,
  history: HistoryEntry[],
  attempt: number
): string {
  const title = cleanHtml(news.title);
  const description = cleanHtml(news.description).slice(0, 1800);
  const emojis = EMOJI_MAP[style] || EMOJI_MAP.minimalistic;
  const greeting = randomChoice(GREETINGS);
  const closing = randomChoice(CLOSINGS);
  const hashtags = randomHashtags();
  const styleDesc = STYLE_LIBRARY[style] || STYLE_LIBRARY.minimalistic;
  const availableEmojis = (emojis.list || ["⚡", "🔥", "💡"]).join(", ");
  const catContext = news.categories.length
    ? `Категории: ${news.categories.slice(0, 3).join(", ")}. `
    : "";
  const extra =
    attempt > 1
      ? "\nПРЕДЫДУЩАЯ ПОПЫТКА ПОЛУЧИЛАСЬ СЛИШКОМ ПОХОЖЕЙ НА ИМЕЮЩИЕСЯ ПОСТЫ.\nСейчас полностью поменяй композицию, начало и ритм текста.\nНе повторяй клише и первые фразы из истории.\n"
      : "";

  return `
Ты — сильный русскоязычный редактор технологического Telegram-канала.
Твоя задача — превращать исходную новость в короткий самостоятельный пост,
который хочется дочитать.

${styleDesc}

ИСХОДНЫЕ ДАННЫЕ:
Заголовок: ${title}
Описание: ${description}
Автор: ${news.author || "не указан"}
${catContext}
Ссылка: ${news.link}

ПОСЛЕДНИЕ ПУБЛИКАЦИИ. НЕ ПОВТОРЯЙ ИХ:
${buildHistoryContext(history)}

ДОСТУПНЫЕ ЭМОДЗИ ДЛЯ ЭТОГО СТИЛЯ:
${availableEmojis}
Ты МОЖЕШЬ и ДОЛЖЕН использовать эти эмодзи в посте, но НЕ ЗЛОУПОТРЕБЛЯЙ (максимум 3-4 штуки на весь пост).

ТРЕБОВАНИЯ К ТЕКСТУ:
1. Длина готового поста: примерно ${settings.minPostLength}–${settings.maxPostLength} символов.
2. Только русский язык.
3. Пост должен быть уникальным по формулировкам, ритму и композиции.
4. Не начинай каждый пост с «Стало известно», «Компания представила», «Учёные разработали», «В мире технологий» и подобных штампов.
5. Не используй одинаковую схему «заголовок → три пункта → вопрос».
6. Не выдумывай цифры, факты, цитаты, названия продуктов или последствия.
7. Не пересказывай RSS буквально — переформулируй материал.
8. Используй 0–4 эмодзи только там, где они действительно помогают.
9. Абзацы должны быть короткими: 1–3 предложения.
10. Заголовок должен быть частью текста и выделяться <b>.
11. Можно использовать <b>, <i>, <u>, <code> и <a href="...">.
12. Не используй Markdown.
13. Не добавляй отдельную строку «Источник:».
14. В конце обязательно поставь ссылку:
<a href="${escapeHtml(news.link)}">Читать полностью →</a>
15. Хэштеги — максимум 3, только релевантные теме.
16. Не добавляй никаких комментариев о том, что ты AI или выполняешь задание.
17. Верни ТОЛЬКО готовый Telegram-пост, без кавычек и без пояснений.

РЕКОМЕНДАЦИИ ПО СТРУКТУРЕ:
- Вступление можно начать с приветствия: ${greeting}
- Заключение: ${closing}
- Используй эмодзи для оформления
- Пример хэштегов: ${hashtags}

ВАЖНАЯ РЕДАКТОРСКАЯ ЦЕЛЬ:
Человек должен почувствовать, что это не автоматически сгенерированный
шаблонный дайджест, а аккуратно отредактированная заметка живого канала.
Каждый новый пост должен звучать иначе предыдущего.
${extra}`;
}

const SYSTEM_PROMPT = `Ты — редактор технологического Telegram-канала высокого уровня.
Главные критерии: точность, естественный русский язык, разнообразие,
сильная композиция, отсутствие шаблонности.
Не выдумывай факты.
Возвращай только готовый HTML-текст поста.
ОБЯЗАТЕЛЬНО используй эмодзи в посте (3-4 штуки), следуя указанному стилю.`;

function finalizeAiPost(rawPost: string, link: string, maxLength: number): string {
  let post = removeMarkdown(rawPost);
  post = post.replace(/^\s*<post>\s*/i, "").replace(/\s*<\/post>\s*$/i, "").trim();

  if (link && !post.includes(link)) {
    post += `\n\n<a href="${escapeHtml(link)}">Читать полностью →</a>`;
  }
  if (!post.includes("#")) {
    post += `\n\n${randomHashtags()}`;
  }

  post = post.replace(
    /<\s*(script|style|iframe|img|video|form)\b.*?>.*?<\/\s*\1\s*>/gis,
    ""
  );

  return trimToLength(post, maxLength);
}

function postIsTooSimilar(post: string, history: HistoryEntry[], limit: number): boolean {
  for (const old of history.slice(0, 12)) {
    if (postFingerprint(post) === postFingerprint(old.postText)) return true;
    const full = similarity(post, old.postText);
    const intro = similarity(getIntro(post), getIntro(old.postText));
    if (full >= limit || intro >= 0.82) return true;
  }
  return false;
}

export function generateFallbackPost(
  news: { title: string; description: string; link: string },
  maxLength: number
): string {
  const title = escapeHtml(news.title || "Без заголовка");
  const description = escapeHtml(cleanHtml(news.description).slice(0, 400));
  const link = escapeHtml(news.link);
  const emojis = EMOJI_MAP.minimalistic;

  const post = [
    `${emojis.header} ${randomChoice(GREETINGS)}`,
    "",
    `<b>${title}</b>`,
    "",
    description,
    "",
    emojis.divider,
    "",
    `${emojis.footer} ${randomChoice(CLOSINGS)}`,
    "",
    `<a href="${link}">Читать полностью →</a>`,
    "",
    randomHashtags(),
  ].join("\n");

  return trimToLength(post, maxLength);
}

export async function generatePost(
  news: { title: string; description: string; link: string; author: string; categories: string[] },
  settings: Settings,
  history: HistoryEntry[],
  style: string
): Promise<{ postText: string; usedFallback: boolean; attempts: number }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const prompt = buildPrompt(news, style, settings, history, attempt);
      const raw = await aiRequest(
        settings,
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        Math.min(settings.aiTemperature + (attempt - 1) * 0.05, 1.0)
      );

      const post = finalizeAiPost(raw, news.link, settings.maxPostLength);

      if (post.length < settings.minPostLength) continue;
      if (postIsTooSimilar(post, history, settings.similarityLimit)) continue;

      return { postText: post, usedFallback: false, attempts: attempt };
    } catch {
      // следующая попытка
    }
  }

  return {
    postText: generateFallbackPost(news, settings.maxPostLength),
    usedFallback: true,
    attempts: 3,
  };
}

export function pickStyle(history: HistoryEntry[]): string {
  return STYLE_SEQUENCE[history.length % STYLE_SEQUENCE.length];
}

// ===== Мотивационные подписи для пинов =====

export type MotivationMode = "phrase" | "speech" | "caption";

const MOTIVATION_FALLBACKS: Record<MotivationMode, string[]> = {
  phrase: [
    "Тихие шаги каждый день громче громких обещаний раз в год.",
    "Дисциплина — это свобода, которую ты заметишь позже.",
    "Начатое вчера уже опережает идеальное, которое ждёт понедельника.",
    "Маленькое дело сейчас сильнее большого плана когда-нибудь.",
    "Ты не опоздал. Ты просто ещё не сделал первый шаг.",
  ],
  speech: [
    "Слушай. Не нужно ждать идеального момента — его не будет. Будет сегодня, немного уставший ты и дело на двадцать минут. Сделай его. Потом ещё одно. Через месяц ты не узнаешь себя, а через год не поверишь, что сомневался.",
    "Знаешь, в чём секрет? Никакого секрета нет. Есть ты, который либо делает, либо придумывает причины. Выбирай первое хотя бы сегодня. Завод будешь искать завтра, а сегодня — просто шаг.",
  ],
  caption: [
    "Каждый шаг, который кажется слишком маленьким, складывается в дистанцию, о которой другие только мечтают.",
    "Комфорт красиво стоит на месте. Рост выглядит неопрятно, зато движется.",
    "Тихая работа важнее громких планов. Результат всегда догоняет того, кто не остановился.",
  ],
};

const MODE_PROMPTS: Record<MotivationMode, string> = {
  phrase: `Придумай короткую мотивирующую фразу для постера (в стиле популярных цитат).
ТРЕБОВАНИЯ:
1. Только русский язык.
2. Одна фраза, максимум 90 символов.
3. Звучит как афоризм или слоган: ёмко, хлёстко, легко запоминается.
4. Можно лёгкий парадокс или сравнение.
5. Без хэштегов, без кавычек, без эмодзи.
6. Без штампов вроде «Не сдавайся», «Верь в себя», «Мечтай смелее».
7. Верни ТОЛЬКО фразу, ничего больше.`,
  speech: `Напиши короткую мотивационную речь для постера.
ТРЕБОВАНИЯ:
1. Только русский язык.
2. Обращение к читателю на «ты».
3. 3–5 коротких предложений, суммарно 120–350 символов.
4. Энергично и конкретно: сначала захват внимания, затем суть, в конце — короткий толчок к действию.
5. Без штампов вроде «Не сдавайся», «Верь в себя», без хэштегов, кавычек и эмодзи.
6. Верни ТОЛЬКО текст речи, ничего больше.`,
  caption: `Придумай короткий мотивационный текст для картинки-постера (в стиле Pinterest).
ТРЕБОВАНИЯ:
1. Только русский язык.
2. Объём: 1–2 предложения, суммарно 80–200 символов.
3. Живой язык, свежая метафора, конкретика вместо абстракций.
4. Без штампов вроде «Не сдавайся», «Верь в себя», «Мечтай смелее».
5. Без хэштегов, без кавычек вокруг текста, без эмодзи.
6. Верни ТОЛЬКО текст подписи, ничего больше.`,
};

const MODE_LIMITS: Record<MotivationMode, { min: number; max: number }> = {
  phrase: { min: 10, max: 130 },
  speech: { min: 60, max: 500 },
  caption: { min: 20, max: 300 },
};

export async function generateMotivation(
  settings: Settings,
  opts: { theme?: string; context?: string; mode?: MotivationMode }
): Promise<{ text: string; usedFallback: boolean; mode: MotivationMode }> {
  const mode: MotivationMode =
    opts.mode && MODE_PROMPTS[opts.mode] ? opts.mode : "caption";
  const theme = (opts.theme || "").trim();
  const context = (opts.context || "").trim().slice(0, 600);

  const prompt = `${MODE_PROMPTS[mode]}
${theme ? `Тема: ${theme}. ` : ""}${context ? `Контекст изображения/пина: ${context}. ` : "Без привязки к картинке — универсальный текст."}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiRequest(
        settings,
        [
          {
            role: "system",
            content:
              "Ты — автор коротких мотивационных текстов для постеров. Пишешь по-русски, ёмко и без клише. Возвращаешь только сам текст.",
          },
          { role: "user", content: prompt },
        ],
        0.95
      );
      const text = raw
        .replace(/^["'«»\s]+|["'«»\s]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const limits = MODE_LIMITS[mode];
      if (text.length >= limits.min && text.length <= limits.max) {
        return { text, usedFallback: false, mode };
      }
    } catch {
      // пробуем ещё раз, затем fallback
    }
  }

  const pool = MOTIVATION_FALLBACKS[mode];
  return {
    text: pool[Math.floor(Math.random() * pool.length)],
    usedFallback: true,
    mode,
  };
}

// ===== Авторский пост на произвольную тему =====

export async function generateAuthorPost(
  topic: string,
  settings: Settings,
  history: HistoryEntry[],
  style: string
): Promise<{ postText: string; usedFallback: boolean }> {
  const cleanTopic = cleanHtml(topic).slice(0, 200);

  const buildAuthorPrompt = (attempt: number) => {
    const emojis = EMOJI_MAP[style] || EMOJI_MAP.minimalistic;
    const styleDesc = STYLE_LIBRARY[style] || STYLE_LIBRARY.minimalistic;
    const extra =
      attempt > 1
        ? "\nПРЕДЫДУЩАЯ ПОПЫТКА ПОЛУЧИЛАСЬ СЛИШКОМ ПОХОЖЕЙ НА ИМЕЮЩИЕСЯ ПОСТЫ. Полностью поменяй композицию и ритм.\n"
        : "";
    return `
Ты — сильный русскоязычный автор и редактор.
Напиши авторский пост на тему: «${cleanTopic}».

${styleDesc}

ПОСЛЕДНИЕ ПУБЛИКАЦИИ. НЕ ПОВТОРЯЙ ИХ:
${buildHistoryContext(history)}

ТРЕБОВАНИЯ:
1. Только русский язык. Длина: ${settings.minPostLength}–${settings.maxPostLength} символов.
2. Это авторский материал: рассуждение, наблюдение, разбор — не пересказ чужой новости.
3. Опирайся на общеизвестные факты о теме. Не выдумывай цифры, цитаты и события.
4. Дай читателю инсайт или новый угол зрения на тему.
5. Абзацы короткие: 1–3 предложения.
6. Заголовок выдели <b>. Разрешены <b>, <i>, <u>, <code>. Без Markdown.
7. 0–4 эмодзи из набора: ${(emojis.list || []).join(", ")}.
8. В конце — 1–3 релевантных хэштега.
9. Никаких ссылок и упоминаний источников.
10. Верни ТОЛЬКО готовый пост, без кавычек и пояснений.
${extra}`;
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiRequest(
        settings,
        [
          {
            role: "system",
            content:
              "Ты — яркий русскоязычный автор с сильной композицией и живым языком. Не выдумываешь факты. Возвращаешь только готовый HTML-текст поста.",
          },
          { role: "user", content: buildAuthorPrompt(attempt) },
        ],
        Math.min(settings.aiTemperature + (attempt - 1) * 0.05, 1.0)
      );

      const post = finalizeAiPost(raw, "", settings.maxPostLength);
      if (post.length < Math.min(300, settings.minPostLength)) continue;
      if (postIsTooSimilar(post, history, settings.similarityLimit)) continue;
      return { postText: post, usedFallback: false };
    } catch {
      // следующая попытка
    }
  }

  const fallback = `<b>${escapeHtml(cleanTopic)}</b>\n\nТема, которую стоит обсудить спокойно и без спешки. ${randomChoice(CLOSINGS)}\n\n${randomHashtags()}`;
  return { postText: trimToLength(fallback, settings.maxPostLength), usedFallback: true };
}

// Английские ключевые слова для поиска картинки по теме
export async function generateImageKeywords(
  settings: Settings,
  topic: string
): Promise<string> {
  try {
    const raw = await aiRequest(
      settings,
      [
        { role: "system", content: "Ты переводишь темы в поисковые запросы для стоковых фото." },
        {
          role: "user",
          content: `Тема: «${cleanHtml(topic).slice(0, 200)}». Какая фотография лучше всего иллюстрирует эту тему? Верни 1-2 английских слова — конкретный фотогеничный визуальный образ (например: sunrise mountains, morning run, coffee cup, city night). Только слова, ничего больше.`,
        },
      ],
      0.3
    );
    const words = raw
      .replace(/[^a-zA-Z\s,]/g, " ")
      .split(/[,\s]+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
      .toLowerCase();
    return words || topic.slice(0, 60);
  } catch {
    return topic.slice(0, 60);
  }
}

// ===== Тексты для мем-постера (заголовок + угловые фразы) =====

export interface MemeTexts {
  script: string;
  main: string;
  quips: string[];
}

const MEME_FALLBACK: MemeTexts = {
  script: "Честный совет",
  main: "СДЕЛАЙ САМ",
  quips: ["а то все такие умные", "жизнь сама подскажет", "зарядись и вперёд", "сколько можно ждать"],
};

export async function generateMemeTexts(
  settings: Settings,
  opts: { theme?: string; context?: string; phrase?: string }
): Promise<MemeTexts> {
  const theme = (opts.theme || "").trim();
  const context = (opts.context || "").trim().slice(0, 300);
  const phrase = (opts.phrase || "").trim().slice(0, 200);

  const prompt = `Придумай тексты для постера в дерзком мотивационном стиле (как вирусные картинки-цитатники).
${theme ? `Тема: ${theme}. ` : ""}${phrase ? `Главная мысль: «${phrase}». ` : ""}${context ? `Контекст: ${context}. ` : ""}
Верни СТРОГО JSON без markdown:
{"script":"1-2 слова с заглавной буквы — рукописная строка над заголовком","main":"2-3 слова ЗАГЛАВНЫМИ — главный заголовок-пуант","quips":["4 короткие дерзкие фразы по 2-4 слова, разговорные, с иронией"]}
Правила: всё по-русски; без эмодзи и кавычек внутри; фразы quips — как колкие наблюдения в тему, без повторов слов между собой; main — пуант, который хочется перечитать.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiRequest(
        settings,
        [
          { role: "system", content: "Ты пишешь тексты для вирусных постеров-цитатников. Отвечаешь только валидным JSON." },
          { role: "user", content: prompt },
        ],
        0.95
      );
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Partial<MemeTexts>;
        const script = String(parsed.script || "").trim();
        const main = String(parsed.main || "").trim();
        const quips = Array.isArray(parsed.quips)
          ? parsed.quips.map((q) => String(q).trim()).filter(Boolean).slice(0, 4)
          : [];
        if (script && main && quips.length === 4) {
          return { script, main: main.toUpperCase(), quips };
        }
      }
    } catch {
      // следующая попытка, затем fallback
    }
  }

  return MEME_FALLBACK;
}
