import { NextResponse } from "next/server";
import { generateAuthorPost, generateImageKeywords, pickStyle } from "@/lib/ai";
import { pickStockImage, saveLocalImage } from "@/lib/images";
import { addHistoryEntry, getHistory, getSettings, uid } from "@/lib/store";
import { STYLE_SEQUENCE } from "@/lib/content";

// Авторский пост на произвольную тему + картинка, подобранная по теме.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const topic = String(body?.topic || "").trim();
  if (!topic) {
    return NextResponse.json({ error: "Укажите тему поста" }, { status: 400 });
  }

  const settings = getSettings();
  const history = getHistory();

  let style: string = body?.style;
  if (!style || !STYLE_SEQUENCE.includes(style)) {
    style = pickStyle(history);
  }

  const { postText, usedFallback } = await generateAuthorPost(
    topic,
    settings,
    history,
    style
  );

  // Картинка: тема → английские ключевые слова → Wikimedia Commons
  const keywords = await generateImageKeywords(settings, topic);
  let imageUrl: string | null = null;
  let imageSourceUrl: string | null = null;
  let imageTitle = "";
  const stock = await pickStockImage(keywords);
  if (stock) {
    imageUrl = saveLocalImage(stock.buffer, stock.mime);
    imageSourceUrl = stock.image.pageUrl;
    imageTitle = stock.image.title;
  }

  addHistoryEntry({
    id: uid(),
    kind: "author",
    title: topic,
    sourceName: "авторский пост",
    style,
    postText,
    imageUrl,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    postText,
    style,
    usedFallback,
    imageUrl,
    imageSourceUrl,
    imageTitle,
    keywords,
  });
}
