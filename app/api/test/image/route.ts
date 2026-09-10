import { NextResponse } from "next/server";
import { generateYandexImage } from "@/lib/ai";
import { saveLocalImage } from "@/lib/images";
import { getSettings } from "@/lib/store";

// Проверка YandexART: генерирует маленькую тестовую картинку.
// Тратит один запрос генерации — но зато проверяет и ключ, и каталог, и модель.
export async function POST() {
  const settings = getSettings();
  try {
    const buffer = await generateYandexImage(
      settings,
      "Простой тест: зелёное яблоко на светлым фоне, минимализм, фото",
      "512x512"
    );
    return NextResponse.json({ ok: true, imageUrl: saveLocalImage(buffer, "image/png") });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error).message || e) },
      { status: 500 }
    );
  }
}
