import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { providerStream, normalizeStream } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const u = await currentUser();

    if (!u) {
      return NextResponse.json(
        { error: "LOGIN_REQUIRED" },
        { status: 401 }
      );
    }

    const b = await req.json();

    const assistant = await db.assistant.findUnique({
      where: {
        id: b.assistantId,
      },
      include: {
        provider: {
          include: {
            models: {
              where: {
                enabled: true,
              },
              orderBy: {
                priority: "asc",
              },
            },
          },
        },
      },
    });

    if (!assistant || !assistant.enabled) {
      return NextResponse.json(
        { error: "Assistant tidak tersedia" },
        { status: 404 }
      );
    }

    const messages = Array.isArray(b.messages)
      ? b.messages
      : [];

    const system = [
      assistant.systemPrompt,
      u.profile?.name
        ? `Nama pengguna: ${u.profile.name}`
        : "",
      u.profile?.nickname
        ? `Panggilan pengguna: ${u.profile.nickname}`
        : "",
      `Nama asisten: ${assistant.name}`,
      u.profile?.language
        ? `Bahasa pengguna: ${u.profile.language}`
        : "",
      u.profile?.communicationStyle
        ? `Gaya komunikasi pengguna: ${u.profile.communicationStyle}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    let provider =
      assistant.provider?.type || "gemini";

    if (provider === "google") {
      provider = "gemini";
    }

    const model =
  assistant.provider?.models?.[0]?.model ||
  (provider === "gemini"
    ? "gemini-2.5-flash"
    : "llama-3.3-70b-versatile");

    const result = await providerStream(
      provider,
      messages,
      model,
      system
    );

    if (!result?.body) {
      return NextResponse.json(
        { error: "AI tidak mengembalikan response" },
        { status: 502 }
      );
    }

    return new Response(
      normalizeStream(provider, result.body),
      {
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      }
    );
  } catch (error) {
    console.error("CHAT_API_ERROR", error);

    return NextResponse.json(
      {
        error: "Terjadi kesalahan pada AI",
      },
      {
        status: 500,
      }
    );
  }
}
