import { NextResponse } from "next/server";

import { db } from "@/lib/db";

import { currentUser } from "@/lib/auth";

import {
  providerStream,
  normalizeStream,
} from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(
  req: Request
) {
  try {
    /* =========================================
       USER
    ========================================= */

    const user =
      await currentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "LOGIN_REQUIRED",
        },
        {
          status: 401,
        }
      );
    }

    /* =========================================
       BODY
    ========================================= */

    const body =
      await req.json();

    const assistantId =
      body?.assistantId;

    const messages =
      Array.isArray(body?.messages)
        ? body.messages
        : [];

    if (!assistantId) {
      return NextResponse.json(
        {
          error:
            "Assistant ID tidak ditemukan.",
        },
        {
          status: 400,
        }
      );
    }

    if (messages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Pesan kosong.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       ASSISTANT
    ========================================= */

    const assistant =
      await db.assistant.findUnique({
        where: {
          id: assistantId,
        },
      });

    if (
      !assistant ||
      !assistant.enabled
    ) {
      return NextResponse.json(
        {
          error:
            "Assistant tidak tersedia.",
        },
        {
          status: 404,
        }
      );
    }

    /* =========================================
       SYSTEM PROMPT
    ========================================= */

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

Jawablah secara natural,
jelas, membantu, dan tidak terlalu
bertele-tele kecuali pengguna meminta
penjelasan yang detail.

Gunakan bahasa Indonesia kecuali
pengguna meminta bahasa lain.

Jangan mengatakan bahwa kamu adalah
database, API, sistem backend, atau
program kecuali pengguna sedang
membahas hal teknis tersebut.
`,
    ]
      .filter(Boolean)
      .join("\n");

    /* =========================================
       PRIMARY PROVIDER
    ========================================= */

    const primaryProvider =
      "gemini";

    const primaryModel =
      "gemini-3.8-flash";

    console.log(
      "PUTRA CHAT START",
      {
        assistant:
          assistant.name,

        provider:
          primaryProvider,

        model:
          primaryModel,

        messages:
          messages.length,
      }
    );

    /* =========================================
       AI
    ========================================= */

    const result =
      await providerStream(
        primaryProvider,
        messages,
        primaryModel,
        system
      );

    /*
      PENTING:

      provider di sini adalah provider
      SEBENARNYA yang berhasil.

      Kalau Gemini gagal lalu Groq berhasil,
      result.provider = "groq".
    */

    console.log(
      "PUTRA CHAT PROVIDER",
      result.provider
    );

    /* =========================================
       NORMALIZE STREAM
    ========================================= */

    const stream =
      normalizeStream(
        result.provider,
        result.body
      );

    /* =========================================
       RESPONSE
    ========================================= */

    return new Response(
      stream,
      {
        status: 200,

        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          "X-Accel-Buffering":
            "no",

          Connection:
            "keep-alive",
        },
      }
    );
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
