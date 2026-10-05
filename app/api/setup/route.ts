import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const key =
      url.searchParams.get("key");

    if (
      key !== process.env.SETUP_KEY
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    /* =================================================
       GEMINI PROVIDER
    ================================================= */

    const gemini =
      await db.provider.upsert({
        where: {
          name: "Gemini",
        },

        update: {
          type: "gemini",
          enabled: true,
          apiKeyEnv:
            "GEMINI_API_KEY",
        },

        create: {
          name: "Gemini",
          type: "gemini",
          enabled: true,
          apiKeyEnv:
            "GEMINI_API_KEY",
        },
      });

    /* =================================================
       GEMINI MODEL
    ================================================= */

    await db.modelConfig.upsert({
      where: {
        id: "gemini-flash-primary",
      },

      update: {
        providerId: gemini.id,
        name: "Gemini 3.8 Flash",
        model: "gemini-3.8-flash",
        enabled: true,
        priority: 0,
      },

      create: {
        id: "gemini-flash-primary",
        providerId: gemini.id,
        name: "Gemini 3.8 Flash",
        model: "gemini-3.8-flash",
        enabled: true,
        priority: 0,
      },
    });

    /* =================================================
       GROQ PROVIDER
    ================================================= */

    const groq =
      await db.provider.upsert({
        where: {
          name: "Groq",
        },

        update: {
          type: "groq",
          enabled: true,
          apiKeyEnv:
            "GROQ_API_KEY",
        },

        create: {
          name: "Groq",
          type: "groq",
          enabled: true,
          apiKeyEnv:
            "GROQ_API_KEY",
        },
      });

    /* =================================================
       GROQ MODEL
    ================================================= */

    await db.modelConfig.upsert({
      where: {
        id: "groq-llama-primary",
      },

      update: {
        providerId: groq.id,
        name: "Groq GPT-OSS 120B",
        model:
          "openai/gpt-oss-120b",
        enabled: true,
        priority: 0,
      },

      create: {
        id: "groq-llama-primary",
        providerId: groq.id,
        name: "Groq GPT-OSS 120B",
        model:
          "openai/gpt-oss-120b",
        enabled: true,
        priority: 0,
      },
    });

    /* =================================================
       PUTRA VOICE
    ================================================= */

    const voice =
      await db.voice.upsert({
        where: {
          id: "putra-browser-voice",
        },

        update: {
          name: "Putra Voice",
          provider: "browser",
          language: "id-ID",
          enabled: true,
        },

        create: {
          id: "putra-browser-voice",
          name: "Putra Voice",
          provider: "browser",
          language: "id-ID",
          description:
            "Voice Putra menggunakan browser",
          enabled: true,
        },
      });

    /* =================================================
       PUTRA ASSISTANT
    ================================================= */

    const assistant =
      await db.assistant.upsert({
        where: {
          slug: "putra",
        },

        update: {
          name: "Putra",

          description:
            "AI Assistant pribadi untuk percakapan, cerita, dan bantuan sehari-hari.",

          systemPrompt:
            "Kamu adalah Putra, AI assistant yang ramah, cerdas, cepat, natural, dan membantu pengguna dalam bahasa Indonesia.",

          enabled: true,

          providerId:
            gemini.id,

          voiceId:
            voice.id,
        },

        create: {
          name: "Putra",

          slug: "putra",

          description:
            "AI Assistant pribadi untuk percakapan, cerita, dan bantuan sehari-hari.",

          systemPrompt:
            "Kamu adalah Putra, AI assistant yang ramah, cerdas, cepat, natural, dan membantu pengguna dalam bahasa Indonesia.",

          enabled: true,

          providerId:
            gemini.id,

          voiceId:
            voice.id,
        },
      });

    /* =================================================
       RESULT
    ================================================= */

    return NextResponse.json({
      success: true,

      message:
        "Putra AI berhasil diinisialisasi.",

      assistant: {
        id: assistant.id,
        name: assistant.name,
        slug: assistant.slug,
        enabled:
          assistant.enabled,
      },

      providers: {
        gemini: {
          id: gemini.id,
          name: gemini.name,
        },

        groq: {
          id: groq.id,
          name: groq.name,
        },
      },

      models: {
        gemini:
          "gemini-3.8-flash",

        groq:
          "openai/gpt-oss-120b",
      },
    });
  } catch (error) {
    console.error(
      "SETUP_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Setup gagal",
      },

      {
        status: 500,
      }
    );
  }
}
