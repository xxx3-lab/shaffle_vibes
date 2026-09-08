export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSources, saveSources, uid } from "@/lib/store";
import type { Source } from "@/lib/types";

export async function GET() {
  return NextResponse.json(getSources());
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  const url = String(body.url || "").trim();

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json(
      { error: "Укажите корректный URL (начинается с http/https)" },
      { status: 400 }
    );
  }

  const sources = getSources();
  const source: Source = {
    id: uid(),
    name: name || new URL(url).hostname,
    url,
    enabled: body.enabled !== false,
    createdAt: new Date().toISOString(),
  };
  sources.push(source);
  saveSources(sources);
  return NextResponse.json(source);
}
