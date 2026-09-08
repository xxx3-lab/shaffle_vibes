import { NextResponse } from "next/server";
import { getSources, saveSources } from "@/lib/store";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const sources = getSources();
  const source = sources.find((s) => s.id === params.id);
  if (!source) {
    return NextResponse.json({ error: "Источник не найден" }, { status: 404 });
  }
  if (typeof body.enabled === "boolean") source.enabled = body.enabled;
  if (typeof body.name === "string") source.name = body.name;
  if (typeof body.url === "string") source.url = body.url;
  saveSources(sources);
  return NextResponse.json(source);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const sources = getSources();
  const filtered = sources.filter((s) => s.id !== params.id);
  saveSources(filtered);
  return NextResponse.json({ ok: true });
}
