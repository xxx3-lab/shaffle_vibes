import { NextResponse } from "next/server";
import { pickStockImage, saveLocalImage } from "@/lib/images";

// Подбор другой картинки по теме (для кнопки «Другая картинка» в студии).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const keywords = String(body?.keywords || "").trim();
  const offset = Math.max(0, Number(body?.offset) || 0);

  if (!keywords) {
    return NextResponse.json({ error: "Нет ключевых слов для поиска" }, { status: 400 });
  }

  const stock = await pickStockImage(keywords, offset);
  if (!stock) {
    return NextResponse.json(
      { error: "Картинок по теме больше не нашлось — попробуйте изменить тему" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    imageUrl: saveLocalImage(stock.buffer, stock.mime),
    imageSourceUrl: stock.image.pageUrl,
    imageTitle: stock.image.title,
  });
}
