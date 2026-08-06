import { NextResponse } from "next/server";
import { resolveCurrentSlot } from "@/lib/slot";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await ctx.params;
  const url = new URL(req.url);
  const atParam = url.searchParams.get("at");
  const at = atParam ? new Date(atParam) : new Date();

  const resolved = await resolveCurrentSlot(publicId, at);
  if (!resolved.room) {
    return NextResponse.json({ message: "Salle introuvable" }, { status: 404 });
  }
  return NextResponse.json(resolved);
}
