import { NextResponse } from "next/server";
import { generateMotivation, type MotivationMode } from "@/lib/ai";
import { getSettings } from "@/lib/store";

// Перегенерация мотивационного текста для уже созданного пина.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const theme = String(body?.theme || "");
  const context = String(body?.context || "");
  const mode = String(body?.mode || "caption") as MotivationMode;

  const settings = getSettings();
  const ai = await generateMotivation(settings, { theme, context, mode });
  return NextResponse.json(ai);
}
