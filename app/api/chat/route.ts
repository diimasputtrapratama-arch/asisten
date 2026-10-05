import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import {
  providerStream,
  normalizeStream,
} from "@/lib/ai";

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

    const assistantId = body?.assistantId;

    const messages = Array.isArray(body?.messages)
      ? body.messages
      : [];

    if (!assistantId) {
      return NextResponse.json(
        { error: "Assistant ID tidak ditemukan." },
        { status: 400 }
      );
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Pesan kosong." },
        { status: 400 }
      );
    }

    const assistant =
      await db.assistant.findUnique({
        where: {
          id: assistantId,
        },
      });

    if (!assistant || !assistant.enabled) {
      return NextResponse.json(
        {
          error:
            "Assistant tidak tersedia.",
        },
        { status: 404 }
      );
    }

    /*
     * =====================================================
     * PUTRA AI
     * Untuk sementara model Gemini DIPAKSA di sini.
     * Tidak mengambil model lama dari database.
     * =====================================================
     */

    const provider = "gemini";

    const model = "gemini-3.8-flash";

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

      `
Kamu adalah Putra AI.

Jawablah secara natural, jelas, membantu,
dan gunakan bahasa Indonesia kecuali pengguna
meminta bahasa lain.

Jangan mengatakan bahwa kamu adalah sistem,
database, API, atau program kecuali memang
sedang membahas hal teknis tersebut.
      `,
    ]
      .filter(Boolean)
      .join("\n");

    console.log("PUTRA CHAT:", {
      assistantId,
      assistant: assistant.name,
      provider,
      model,
      messageCount: messages.length,
    });

    const result = await providerStream(
      provider,
      messages,
      model,
      system
    );

    if (!result?.body) {
      throw new Error(
        "Gemini tidak mengembalikan response."
      );
    }

    const stream = normalizeStream(
      provider,
      result.body
    );

    return new Response(stream, {
      status: 200,

      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",

        "Cache-Control":
          "no-cache, no-transform",

        "X-Accel-Buffering":
          "no",
      },
    });
  } catch (error) {
    console.error(
      "CHAT_API_ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada Putra AI.",
      },
      {
        status: 500,
      }
    );
  }
}
