import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { providerStream, normalizeStream } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: "LOGIN_REQUIRED" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const assistant = await db.assistant.findUnique({
      where: {
        id: body.assistantId,
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

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    const system = [
      assistant.systemPrompt,

      user.profile?.name
        ? `Nama pengguna: ${user.profile.name}`
        : "",

      user.profile?.nickname
        ? `Panggilan pengguna: ${user.profile.nickname}`
        : "",

      `Nama asisten: ${assistant.name}`,

      user.profile?.language
        ? `Bahasa pengguna: ${user.profile.language}`
        : "",

      user.profile?.communicationStyle
        ? `Gaya komunikasi pengguna: ${user.profile.communicationStyle}`
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
      throw new Error(
        "AI tidak mengembalikan response."
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
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada AI",
      },
      {
        status: 500,
      }
    );
  }
}
