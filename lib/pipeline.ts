import { pickStyle, generatePost } from "./ai";
import { fetchNewsFromAllSources } from "./rss";
import {
  addHistoryEntry,
  addSentGuid,
  getHistory,
  getSentGuids,
  getSettings,
  getSources,
  uid,
} from "./store";
import type { NewsItem } from "./types";

export interface CycleResult {
  generated: number;
  errors: string[];
  results: {
    newsTitle: string;
    sourceName: string;
    style: string;
    usedFallback: boolean;
    imageUrl: string | null;
    error?: string;
  }[];
}

// Полный цикл: спарсить источники и подготовить посты (картинка + текст).
// Ничего никуда не публикуется — результаты попадают в историю и студию.
export async function runCycle(
  maxItems: number,
  onProgress?: (msg: string) => void
): Promise<CycleResult> {
  const settings = getSettings();
  const sources = getSources();
  const sent = new Set(getSentGuids());

  const result: CycleResult = { generated: 0, errors: [], results: [] };

  if (!sources.some((s) => s.enabled)) {
    result.errors.push("Нет активных источников — добавьте их на странице «Источники»");
    return result;
  }

  onProgress?.("Парсим источники...");
  const { news, errors } = await fetchNewsFromAllSources(
    sources,
    settings.newsLimitPerSource
  );
  result.errors.push(...errors);

  const fresh: NewsItem[] = news.filter((n) => n.guid && !sent.has(n.guid));
  onProgress?.(`Найдено ${fresh.length} новых материалов`);

  for (const item of fresh.slice(0, maxItems)) {
    onProgress?.(`Генерируем пост: ${item.title.slice(0, 60)}...`);

    const history = getHistory();
    const style = pickStyle(history);
    const { postText, usedFallback } = await generatePost(item, settings, history, style);

    result.generated += 1;
    result.results.push({
      newsTitle: item.title,
      sourceName: item.sourceName,
      style,
      usedFallback,
      imageUrl: item.imageUrl,
    });

    addSentGuid(item.guid);
    addHistoryEntry({
      id: uid(),
      kind: "news",
      title: item.title,
      sourceName: item.sourceName,
      newsLink: item.link,
      style,
      postText,
      imageUrl: item.imageUrl,
      createdAt: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 1200));
  }

  return result;
}
