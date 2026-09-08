import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/store";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: Request) {
  const body = await request.json();
  const current = getSettings();

  const next: Settings = {
    aiHost: String(body.aiHost ?? current.aiHost).trim(),
    aiPort: Number(body.aiPort) || current.aiPort,
    aiModel: String(body.aiModel ?? current.aiModel).trim(),
    aiTemperature: Number(body.aiTemperature) || current.aiTemperature,
    aiMaxTokens: Number(body.aiMaxTokens) || current.aiMaxTokens,
    minPostLength: Number(body.minPostLength) || current.minPostLength,
    maxPostLength: Number(body.maxPostLength) || current.maxPostLength,
    newsLimitPerSource: Number(body.newsLimitPerSource) || current.newsLimitPerSource,
    similarityLimit: Number(body.similarityLimit) || current.similarityLimit,
  };

  saveSettings(next);
  return NextResponse.json(next);
}
