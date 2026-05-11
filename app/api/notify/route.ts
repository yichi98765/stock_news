import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AlertPayload {
  id: string;
  message: string;
  tone?: "up" | "down" | "neutral";
}

function enabledChannels() {
  return {
    slack: Boolean(process.env.SLACK_WEBHOOK_URL),
    pushover: Boolean(process.env.PUSHOVER_APP_TOKEN && process.env.PUSHOVER_USER_KEY),
    line: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID),
    email: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO),
    webhook: Boolean(process.env.ALERT_WEBHOOK_URL)
  };
}

async function sendSlack(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
}

async function sendPushover(text: string) {
  const token = process.env.PUSHOVER_APP_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) return;
  const body = new URLSearchParams({
    token,
    user,
    title: "Stock Finder Alert",
    message: text
  });
  await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
}

async function sendLine(text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;
  if (!token || !userId) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text }]
    })
  });
}

async function sendEmail(text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || "Stock Finder <onboarding@resend.dev>",
      to: to.split(",").map((v) => v.trim()).filter(Boolean),
      subject: "Stock Finder Alert",
      text
    })
  });
}

async function sendWebhook(alerts: AlertPayload[]) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "stock-finder",
      sentAt: new Date().toISOString(),
      alerts
    })
  });
}

export async function GET() {
  return NextResponse.json({ channels: enabledChannels() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { alerts?: AlertPayload[] } | null;
  const alerts = body?.alerts?.filter((a) => a.id && a.message).slice(0, 10) ?? [];
  if (alerts.length === 0) {
    return NextResponse.json({ sent: false, channels: enabledChannels(), error: "alerts is empty" });
  }

  const text = alerts.map((alert) => `- ${alert.message}`).join("\n");
  const results = await Promise.allSettled([
    sendSlack(text),
    sendPushover(text),
    sendLine(text),
    sendEmail(text),
    sendWebhook(alerts)
  ]);

  return NextResponse.json({
    sent: true,
    channels: enabledChannels(),
    failures: results.filter((r) => r.status === "rejected").length
  });
}
