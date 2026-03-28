import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.REMOTE_ACTION_URL?.replace(/\/copilotkit$/, "") ||
  "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${BACKEND_URL}/widget-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
