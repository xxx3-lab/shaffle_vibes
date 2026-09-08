import { NextResponse } from "next/server";
import { generateMotivation, type MotivationMode } from "@/lib/ai";
import { fetchImage, saveLocalImage, scrapePage, uploadExternal } from "@/lib/images";
import { addHistoryEntry, getSettings, uid } from "@/lib/store";
import type { PinResult } from "@/lib/types";

export async function POST(request: Request) {
  const inputs: (
    | { type: "link"; value: string }
    | { type: "file"; name: string; buffer: Buffer; mime: string; context: string }
  )[] = [];
  let theme = "";
  let mode = "";

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (key === "links" && typeof value === "string" && value.trim()) {
          inputs.push({ type: "link", value: value.trim() });
        } else if (key === "theme" && typeof value === "string") {
          theme = value;
        } else if (key === "mode" && typeof value === "string") {
          mode = value;
        } else if (value instanceof File && value.size > 0) {
          if (value.type && !value.type.startsWith("image/")) continue;
          inputs.push({
            type: "file",
            name: value.name || "upload.png",
            buffer: Buffer.from(await value.arrayBuffer()),
            mime: value.type || "image/png",
            context: value.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "),
          });
        }
      }
    } else {
      const body = await request.json();
      const links: string[] = Array.isArray(body.links) ? body.links : [];
      theme = String(body.theme || "");
      mode = String(body.mode || "");
      links.filter(Boolean).forEach((l: string) => inputs.push({ type: "link", value: l.trim() }));
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Не удалось разобрать запрос: " + String((e as Error).message) },
      { status: 400 }
    );
  }

  if (!inputs.length) {
    return NextResponse.json(
      { error: "Ничего не передано: добавьте ссылки или файлы" },
      { status: 400 }
    );
  }
  if (inputs.length > 8) {
    return NextResponse.json({ error: "Максимум 8 картинок за раз" }, { status: 400 });
  }

  const settings = getSettings();
  const results: PinResult[] = [];
  const errors: string[] = [];

  for (const input of inputs) {
    try {
      let buffer: Buffer;
      let mime = "image/png";
      let context = "";
      let title = "";

      if (input.type === "file") {
        buffer = input.buffer;
        mime = input.mime;
        context = input.context;
        title = input.name;
      } else {
        const url = input.value;
        // Прямая ссылка на картинку (например i.pinimg.com) или страница пина
        const looksLikeImage = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);
        if (looksLikeImage) {
          const img = await fetchImage(url);
          buffer = img.buffer;
          mime = img.mime;
          title = url.split("/").pop()?.split("?")[0] || url;
        } else {
          const page = await scrapePage(url);
          if (!page.imageUrl) {
            throw new Error(
              "Не удалось найти картинку на странице. Откройте пин, скопируйте адрес картинки (i.pinimg.com/...) и вставьте его."
            );
          }
          const img = await fetchImage(page.imageUrl);
          buffer = img.buffer;
          mime = img.mime;
          title = page.title || url;
          context = [page.title, page.description].filter(Boolean).join(". ");
        }
      }

      // Локальное хранение — основная картинка (работает всегда),
      // внешняя ссылка catbox/litterbox — бонус для шаринга.
      const localUrl = saveLocalImage(buffer, mime);
      const remoteUrl = await uploadExternal(buffer, title.slice(0, 40).replace(/\s+/g, "_") + ".png");
      const ai = await generateMotivation(settings, { theme, context, mode: mode as MotivationMode });

      const item: PinResult = {
        imageUrl: localUrl,
        remoteUrl,
        title: title || "Пин",
        context,
        text: ai.text,
        usedFallback: ai.usedFallback,
      };
      results.push(item);

      addHistoryEntry({
        id: uid(),
        kind: "pin",
        title: item.title,
        sourceName: "пин",
        postText: ai.text,
        imageUrl: localUrl,
        remoteUrl,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      errors.push(String((e as Error).message || e));
    }
  }

  return NextResponse.json({ results, errors });
}
