import { NextResponse } from "next/server";

import { db } from "@/lib/db";

import { currentUser } from "@/lib/auth";

import {
  generateAIResponse,
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
       REQUEST
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
ramah, jelas, dan membantu.

Gunakan bahasa Indonesia kecuali
pengguna meminta bahasa lain.

Jangan terlalu panjang kecuali
pengguna meminta penjelasan detail.

Jangan menyebut database, API,
backend, provider, model AI, atau
sistem internal kecuali pengguna
sedang membicarakan hal teknis.
`,
    ]
      .filter(Boolean)
      .join("\n");

    /* =========================================
       AI
    ========================================= */

    const result =
      await generateAIResponse(
        messages,
        system
      );

    console.log(
      "PUTRA RESPONSE:",
      {
        provider:
          result.provider,

        length:
          result.text.length,
      }
    );

    /* =========================================
       RESPONSE
    ========================================= */

    return NextResponse.json({
      success: true,

      provider:
        result.provider,

      message:
        result.text,
    });
  } catch (error) {
    console.error(
      "CHAT_API_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

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
