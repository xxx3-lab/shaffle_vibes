import { NextResponse } from "next/server";
import { aiRequest } from "@/lib/ai";
import { getSettings } from "@/lib/store";

export async function POST() {
  const settings = getSettings();
  try {
    const reply = await aiRequest(
      settings,
      [{ role: "user", content: "Ответь одним словом: работает?" }],
      0.1
    );
    return NextResponse.json({ ok: true, reply: reply.slice(0, 200) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error).message || e) },
      { status: 500 }
    );
  }
}
