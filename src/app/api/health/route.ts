import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service:
      "export-command-center",
    status: "healthy",
    version: "smart-v6",
    timestamp:
      new Date().toISOString(),
  });
}
