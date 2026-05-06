import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  const checks = {
    hasGeminiKey: !!apiKey,
    keyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : null,
    model
  };

  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "no_key", ...checks });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: 'Reply ONLY with JSON: {"text":"こんにちは"}' }]
          }
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" }
      })
    });
    const body = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      ...checks,
      responseBody: body.slice(0, 2000)
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      ...checks,
      error: (e as Error).message
    });
  }
}
