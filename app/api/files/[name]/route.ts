import { NextResponse } from "next/server";
import { mimeByExt, readLocalImage } from "@/lib/images";

export async function GET(
  _request: Request,
  { params }: { params: { name: string } }
) {
  const buffer = readLocalImage(params.name);
  if (!buffer) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeByExt(params.name),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
