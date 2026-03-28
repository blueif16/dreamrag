import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_API_KEY not set" }, { status: 500 });
  }

  const arrayBuffer = await req.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = req.headers.get("x-audio-mime") || "audio/webm";

  const body = {
    contents: [
      {
        parts: [
          { text: "Transcribe the speech in this audio exactly. Return only the transcript text, nothing else." },
          { inline_data: { mime_type: mimeType, data: base64Audio } },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[STT] Gemini error:", res.status, err);
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  console.log("[STT] transcript:", transcript);

  return NextResponse.json({ transcript });
}
