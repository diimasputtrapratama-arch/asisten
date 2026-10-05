import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // =========================
  // PROVIDERS
  // =========================

  const google = await db.provider.upsert({
    where: {
      name: "Gemini",
    },
    update: {
      enabled: true,
    },
    create: {
      name: "Gemini",
      type: "gemini",
      enabled: true,
      apiKeyEnv: "GEMINI_API_KEY",
    },
  });

  const groq = await db.provider.upsert({
    where: {
      name: "Groq",
    },
    update: {
      enabled: true,
    },
    create: {
      name: "Groq",
      type: "groq",
      enabled: true,
      apiKeyEnv: "GROQ_API_KEY",
    },
  });

  // =========================
  // MODELS
  // =========================

  const geminiModel = await db.modelConfig.upsert({
    where: {
      id: "gemini-flash-primary",
    },
    update: {
      enabled: true,
      priority: 0,
    },
    create: {
      id: "gemini-flash-primary",
      providerId: google.id,
      name: "Gemini Flash",
      model: "gemini-3.8-flash",
      enabled: true,
      priority: 0,
    },
  });

  await db.modelConfig.upsert({
    where: {
      id: "groq-llama-primary",
    },
    update: {
      enabled: true,
      priority: 0,
    },
    create: {
      id: "groq-llama-primary",
      providerId: groq.id,
      name: "Llama Instant",
      model: "llama-3.3-70b-versatile",
      enabled: true,
      priority: 0,
    },
  });

  // =========================
  // VOICE
  // =========================

  const putraVoice = await db.voice.upsert({
    where: {
      id: "putra-browser-voice",
    },
    update: {
      enabled: true,
    },
    create: {
      id: "putra-browser-voice",
      name: "Putra Default",
      provider: "browser",
      voiceId: null,
      language: "id-ID",
      description:
        "Voice default Putra menggunakan browser SpeechSynthesis.",
      enabled: true,
    },
  });

  // =========================
  // ASSISTANT PUTRA
  // =========================

  const putra = await db.assistant.upsert({
    where: {
      slug: "putra",
    },
    update: {
      name: "Putra",
      description: "Asisten AI utama Putra.",
      systemPrompt:
        "Kamu adalah Putra, asisten AI yang natural, ramah, cepat, jujur, dan membantu. Gunakan Bahasa Indonesia secara default. Jawab dengan jelas dan tidak bertele-tele. Jika pengguna meminta cerita, bantu mencari, merekomendasikan, atau membuat cerita. Jika pengguna bertanya tentang dirinya berdasarkan profil yang tersedia, gunakan informasi profil secara tepat dan jangan mengarang.",
      enabled: true,
      providerId: google.id,
      voiceId: putraVoice.id,
    },
    create: {
      name: "Putra",
      slug: "putra",
      description: "Asisten AI utama Putra.",
      systemPrompt:
        "Kamu adalah Putra, asisten AI yang natural, ramah, cepat, jujur, dan membantu. Gunakan Bahasa Indonesia secara default. Jawab dengan jelas dan tidak bertele-tele. Jika pengguna meminta cerita, bantu mencari, merekomendasikan, atau membuat cerita. Jika pengguna bertanya tentang dirinya berdasarkan profil yang tersedia, gunakan informasi profil secara tepat dan jangan mengarang.",
      enabled: true,
      providerId: google.id,
      voiceId: putraVoice.id,
    },
  });

  // =========================
  // ADMIN USER
  // =========================

  const adminEmail =
    process.env.ADMIN_EMAIL?.toLowerCase();

  const adminPassword =
    process.env.ADMIN_INITIAL_PASSWORD;

  if (adminEmail && adminPassword) {
    const bcrypt =
      await import("bcryptjs");

    const passwordHash =
      await bcrypt.hash(adminPassword, 12);

    await db.user.upsert({
      where: {
        email: adminEmail,
      },
      update: {
        role: "ADMIN",
        disabled: false,
      },
      create: {
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        disabled: false,
      },
    });
  }

  console.log("Putra AI seed completed.");
  console.log("Gemini:", google.id);
  console.log("Groq:", groq.id);
  console.log("Gemini model:", geminiModel.id);
  console.log("Putra:", putra.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
