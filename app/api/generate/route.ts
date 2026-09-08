import { NextResponse } from "next/server";
import { generatePost, pickStyle } from "@/lib/ai";
import { addHistoryEntry, getHistory, getSettings, uid } from "@/lib/store";
import { STYLE_SEQUENCE } from "@/lib/content";

export async function POST(request: Request) {
  const body = await request.json();
  const news = body.news;
  if (!news?.title || !news?.link) {
    return NextResponse.json(
      { error: "Нужна новость: news.title и news.link" },
      { status: 400 }
    );
  }

  const settings = getSettings();
  const history = getHistory();

  let style: string = body.style;
  if (!style || !STYLE_SEQUENCE.includes(style)) {
    style = pickStyle(history);
  }

  const { postText, usedFallback, attempts } = await generatePost(
    news,
    settings,
    history,
    style
  );

  // Каждый сгенерированный пост сохраняется в историю — публиковать его можно когда угодно.
  addHistoryEntry({
    id: uid(),
    kind: "news",
    title: news.title,
    sourceName: news.sourceName || "новость",
    newsLink: news.link,
    style,
    postText,
    imageUrl: news.imageUrl || null,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    postText,
    style,
    usedFallback,
    attempts,
    imageUrl: news.imageUrl || null,
  });
}
