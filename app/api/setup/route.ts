import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (key !== process.env.SETUP_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // =========================
    // 1. PROVIDER GEMINI
    // =========================
    const provider = await db.provider.upsert({
      where: {
        name: "Gemini",
      },
      update: {
        type: "gemini",
        enabled: true,
        apiKeyEnv: "GEMINI_API_KEY",
      },
      create: {
        name: "Gemini",
        type: "gemini",
        enabled: true,
        apiKeyEnv: "GEMINI_API_KEY",
      },
    });

    // =========================
    // 2. MODEL GEMINI
    // =========================
    await db.modelConfig.upsert({
      where: {
        id: "gemini-flash-primary",
      },
      update: {
        providerId: provider.id,
        name: "Gemini Flash",
        model: "gemini-2.5-flash",
        enabled: true,
        priority: 0,
      },
      create: {
        id: "gemini-flash-primary",
        providerId: provider.id,
        name: "Gemini Flash",
        model: "gemini-2.5-flash",
        enabled: true,
        priority: 0,
      },
    });

    // =========================
    // 3. VOICE PUTRA
    // =========================
    const voice = await db.voice.upsert({
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
        description: "Voice Putra menggunakan browser",
        enabled: true,
      },
    });

    // =========================
    // 4. ASSISTANT PUTRA
    // =========================
    const assistant = await db.assistant.upsert({
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
        providerId: provider.id,
        voiceId: voice.id,
      },
      create: {
        name: "Putra",
        slug: "putra",
        description:
          "AI Assistant pribadi untuk percakapan, cerita, dan bantuan sehari-hari.",
        systemPrompt:
          "Kamu adalah Putra, AI assistant yang ramah, cerdas, cepat, natural, dan membantu pengguna dalam bahasa Indonesia.",
        enabled: true,
        providerId: provider.id,
        voiceId: voice.id,
      },
    });

    // =========================
    // SELESAI
    // =========================
    return NextResponse.json({
      success: true,
      message: "Putra berhasil dibuat/diaktifkan.",
      assistant: {
        id: assistant.id,
        name: assistant.name,
        slug: assistant.slug,
        enabled: assistant.enabled,
      },
      provider: {
        id: provider.id,
        name: provider.name,
      },
    });
  } catch (error) {
    console.error("SETUP_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Setup gagal",
      },
      { status: 500 }
    );
  }
}
