export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getHistory, resetSentGuids, saveHistory } from "@/lib/store";

export async function GET() {
  return NextResponse.json(getHistory());
}

export async function DELETE() {
  saveHistory([]);
  resetSentGuids();
  return NextResponse.json({ ok: true });
}
