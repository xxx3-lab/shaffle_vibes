export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchNewsFromAllSources } from "@/lib/rss";
import { getSentGuids, getSettings, getSources } from "@/lib/store";

export async function GET() {
  const sources = getSources();
  const settings = getSettings();
  const { news, errors } = await fetchNewsFromAllSources(
    sources,
    settings.newsLimitPerSource
  );
  const sent = new Set(getSentGuids());
  return NextResponse.json({
    news: news.map((n) => ({ ...n, isNew: !sent.has(n.guid) })),
    errors,
  });
}
