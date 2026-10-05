export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIResult = {
  text: string;
  provider: "gemini" | "groq";
};

/* =====================================================
   API KEYS
===================================================== */

function getApiKey(provider: "gemini" | "groq") {
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error("GEMINI_API_KEY belum diset");
    }

    return key;
  }

  const key = process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error("GROQ_API_KEY belum diset");
  }

  return key;
}

/* =====================================================
   GEMINI
===================================================== */

async function callGemini(
  messages: ChatMessage[],
  system: string
): Promise<AIResult> {
  const apiKey = getApiKey("gemini");

  const model = "gemini-3.8-flash";

  const contents = messages
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role:
        m.role === "assistant"
          ? "model"
          : "user",
      parts: [
        {
          text: m.content,
        },
      ],
    }));

  if (contents.length === 0) {
    throw new Error("Pesan kosong.");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: system,
          },
        ],
      },

      contents,

      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    }),
  });

  const raw = await response.text();

  let data: any = null;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini mengirim response yang tidak valid. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.error?.status ||
      raw;

    throw new Error(
      `Gemini HTTP ${response.status}: ${detail}`
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    throw new Error(
      "Gemini tidak mengembalikan teks jawaban."
    );
  }

  return {
    text,
    provider: "gemini",
  };
}

/* =====================================================
   GROQ
===================================================== */

async function callGroq(
  messages: ChatMessage[],
  system: string
): Promise<AIResult> {
  const apiKey = getApiKey("groq");

  const model = "openai/gpt-oss-120b";

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model,

        messages: [
          {
            role: "system",
            content: system,
          },

          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],

        temperature: 0.7,

        max_completion_tokens: 2048,

        stream: false,
      }),
    }
  );

  const raw = await response.text();

  let data: any = null;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `Groq mengirim response yang tidak valid. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.error?.code ||
      raw;

    throw new Error(
      `Groq HTTP ${response.status}: ${detail}`
    );
  }

  const text =
    data?.choices?.[0]?.message?.content
      ?.trim() || "";

  if (!text) {
    throw new Error(
      "Groq tidak mengembalikan teks jawaban."
    );
  }

  return {
    text,
    provider: "groq",
  };
}

/* =====================================================
   MAIN AI
===================================================== */

export async function generateAIResponse(
  messages: ChatMessage[],
  system: string
): Promise<AIResult> {
  try {
    console.log(
      "PUTRA → mencoba Gemini"
    );

    const result =
      await callGemini(
        messages,
        system
      );

    console.log(
      "PUTRA → Gemini berhasil"
    );

    return result;
  } catch (geminiError) {
    const message =
      geminiError instanceof Error
        ? geminiError.message
        : String(geminiError);

    console.error(
      "GEMINI FAILED:",
      message
    );

    /*
     * Kalau Gemini gagal karena apa pun,
     * coba Groq.
     *
     * Jadi fallback tidak hanya bergantung
     * pada 429/503.
     */

    try {
      console.log(
        "PUTRA → fallback ke Groq"
      );

      const result =
        await callGroq(
          messages,
          system
        );

      console.log(
        "PUTRA → Groq berhasil"
      );

      return result;
    } catch (groqError) {
      const groqMessage =
        groqError instanceof Error
          ? groqError.message
          : String(groqError);

      console.error(
        "GROQ FAILED:",
        groqMessage
      );

      throw new Error(
        `Gemini gagal: ${message}\n\nGroq gagal: ${groqMessage}`
      );
    }
  }
}
