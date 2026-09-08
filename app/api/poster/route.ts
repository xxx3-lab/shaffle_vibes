import { NextResponse } from "next/server";
import { generateMemeTexts } from "@/lib/ai";
import {
  LAYOUT_LABELS,
  POSTER_LAYOUTS,
  loadImage,
  makePoster,
  saveLocalImage,
  uploadExternal,
  type PosterLayout,
} from "@/lib/images";
import { getSettings } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = String(body?.text || "").trim();
  const imageUrl = String(body?.imageUrl || "").trim();
  const size = String(body?.size || "4:5");
  const font = String(body?.font || "Arial Black");
  const layout = String(body?.layout || "bottom") as PosterLayout;
  const color = String(body?.color || "");
  const theme = String(body?.theme || "");
  const context = String(body?.context || "");
  const wantVariants = Boolean(body?.variants);

  if (!text) {
    return NextResponse.json({ error: "Нет текста для наложения" }, { status: 400 });
  }
  if (!imageUrl) {
    return NextResponse.json({ error: "Нет ссылки на картинку" }, { status: 400 });
  }

  try {
    const { buffer } = await loadImage(imageUrl);

    // Для мем-раскладки генерируем заголовок и угловые фразы (один раз на запрос)
    const needsMeme = wantVariants || layout === "meme";
    const memeTexts = needsMeme
      ? await generateMemeTexts(getSettings(), { theme, context, phrase: text })
      : undefined;

    if (wantVariants) {
      // Все раскладки одним размером и шрифтом
      const variants = [];
      for (const l of POSTER_LAYOUTS) {
        const poster = await makePoster(buffer, text, {
          size,
          font,
          layout: l,
          memeTexts,
          color,
        });
        variants.push({
          layout: l,
          label: LAYOUT_LABELS[l],
          posterUrl: saveLocalImage(poster, "image/png"),
        });
      }
      return NextResponse.json({ variants });
    }

    const poster = await makePoster(buffer, text, { size, font, layout, memeTexts, color });
    const posterUrl = saveLocalImage(poster, "image/png");
    const remoteUrl = await uploadExternal(poster, "poster.png");
    return NextResponse.json({ posterUrl, remoteUrl });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message || e) },
      { status: 500 }
    );
  }
}
