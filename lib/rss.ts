import Parser from "rss-parser";
import type { NewsItem, Source } from "./types";
import { cleanHtml } from "./ai";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
  },
  timeout: 20000,
});

function extractImage(item: Parser.Item): string | null {
  const custom = item as Record<string, unknown>;
  const candidates: (string | undefined)[] = [
    item.enclosure?.url,
    typeof custom["media:content"] === "string"
      ? (custom["media:content"] as string)
      : undefined,
  ];

  const htmlish = [
    item.content,
    typeof custom["content:encoded"] === "string"
      ? (custom["content:encoded"] as string)
      : undefined,
    item.contentSnippet,
    item.summary,
  ]
    .filter(Boolean)
    .join(" ");

  const match = htmlish.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) candidates.push(match[1]);

  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    let url = c.trim();
    const mediaMatch = url.match(/url=("([^"]+)"|[^"'\s>]+)/);
    if (url.includes("media:content") || mediaMatch?.[1]) {
      url = (mediaMatch?.[2] || mediaMatch?.[1] || url).trim();
    }
    if (url.startsWith("//")) return "https:" + url;
    if (/^https?:\/\//.test(url)) return url;
  }
  return null;
}

export async function fetchNewsFromSource(
  source: Source,
  limit: number
): Promise<NewsItem[]> {
  const feed = await parser.parseURL(source.url);
  const items = (feed.items || []).slice(0, limit);

  return items.map((item) => {
    const guid = item.guid || item.link || item.title || "";
    const categories = (item.categories || []).filter(Boolean).map(String);
    return {
      sourceId: source.id,
      sourceName: source.name,
      guid,
      title: cleanHtml(item.title || "Без заголовка"),
      link: item.link || "",
      pubDate: item.isoDate || item.pubDate || "",
      description: cleanHtml(item.contentSnippet || item.content || item.summary || ""),
      imageUrl: extractImage(item),
      author: typeof item.creator === "string" ? item.creator : "",
      categories,
    };
  });
}

export async function fetchNewsFromAllSources(
  sources: Source[],
  limitPerSource: number
): Promise<{ news: NewsItem[]; errors: string[] }> {
  const news: NewsItem[] = [];
  const errors: string[] = [];

  const results = await Promise.allSettled(
    sources.filter((s) => s.enabled).map((s) => fetchNewsFromSource(s, limitPerSource))
  );

  results.forEach((res, i) => {
    const source = sources.filter((s) => s.enabled)[i];
    if (res.status === "fulfilled") {
      news.push(...res.value);
    } else {
      errors.push(`${source?.name || "источник"}: ${String(res.reason?.message || res.reason)}`);
    }
  });

  return { news, errors };
}
