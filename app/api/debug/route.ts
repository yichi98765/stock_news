import { NextResponse } from "next/server";
import { getModelChain } from "@/lib/ai/geminiClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const chain = getModelChain();

  const checks = {
    hasGeminiKey: !!apiKey,
    keyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : null,
    modelChain: chain
  };

  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "no_key", ...checks });
  }

  const probes: { model: string; status: number; ok: boolean; bodyPreview?: string }[] = [];

  for (const model of chain) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: 'Reply ONLY with JSON: {"text":"こんにちは"}' }] }
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" }
        })
      });
      const body = await res.text();
      probes.push({
        model,
        status: res.status,
        ok: res.ok,
        bodyPreview: body.slice(0, 400)
      });
      if (res.ok) break;
    } catch (e) {
      probes.push({ model, status: 0, ok: false, bodyPreview: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: probes.some((p) => p.ok),
    ...checks,
    probes
  });
}
