import { NextResponse } from "next/server";
import { runCycle } from "@/lib/pipeline";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const maxItems = Math.min(Number(body.maxItems) || 3, 10);

  try {
    const result = await runCycle(maxItems);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message || e) },
      { status: 500 }
    );
  }
}
