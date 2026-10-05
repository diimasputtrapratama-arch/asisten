export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderResponse = {
  body: ReadableStream<Uint8Array>;
  provider: "gemini" | "groq";
};

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

async function gemini(
  messages: ChatMessage[],
  system: string
): Promise<ProviderResponse> {
  const apiKey = getApiKey("gemini");

  const contents = messages
    .filter((message) => message.content?.trim())
    .map((message) => ({
      role:
        message.role === "assistant"
          ? "model"
          : "user",

      parts: [
        {
          text: message.content,
        },
      ],
    }));

  if (contents.length === 0) {
    throw new Error("Pesan kosong.");
  }

  const model = "gemini-3.8-flash";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              system ||
              "Kamu adalah Putra, AI assistant yang ramah, cerdas, cepat, dan membantu pengguna dalam bahasa Indonesia.",
          },
        ],
      },

      contents,

      generationConfig: {
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    let detail = errorText;

    try {
      const json = JSON.parse(errorText);

      detail =
        json?.error?.message ||
        json?.error?.status ||
        errorText;
    } catch {}

    throw new Error(
      `Gemini HTTP ${response.status}: ${detail}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Gemini tidak mengirim response."
    );
  }

  return {
    body: response.body,
    provider: "gemini",
  };
}

/* =====================================================
   GROQ
===================================================== */

async function groq(
  messages: ChatMessage[],
  system: string
): Promise<ProviderResponse> {
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
            content:
              system ||
              "Kamu adalah Putra, AI assistant yang ramah, cerdas, cepat, dan membantu pengguna dalam bahasa Indonesia.",
          },

          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],

        temperature: 0.7,

        max_tokens: 2048,

        stream: true,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    let detail = errorText;

    try {
      const json = JSON.parse(errorText);

      detail =
        json?.error?.message ||
        json?.error?.status ||
        errorText;
    } catch {}

    throw new Error(
      `Groq HTTP ${response.status}: ${detail}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Groq tidak mengirim response."
    );
  }

  return {
    body: response.body,
    provider: "groq",
  };
}

/* =====================================================
   PROVIDER + FALLBACK
===================================================== */

export async function providerStream(
  provider: string,
  messages: ChatMessage[],
  _model: string,
  system: string
): Promise<ProviderResponse> {
  const normalized =
    provider.toLowerCase();

  if (
    normalized === "gemini" ||
    normalized === "google"
  ) {
    try {
      return await gemini(
        messages,
        system
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        "GEMINI FAILED:",
        message
      );

      const shouldFallback =
        message.includes("HTTP 429") ||
        message.includes("HTTP 500") ||
        message.includes("HTTP 503") ||
        message.includes("high demand") ||
        message.includes("overload") ||
        message.includes("temporarily");

      if (shouldFallback) {
        console.log(
          "PUTRA: GEMINI FAILED → FALLBACK TO GROQ"
        );

        return await groq(
          messages,
          system
        );
      }

      throw error;
    }
  }

  if (normalized === "groq") {
    return await groq(
      messages,
      system
    );
  }

  throw new Error(
    `Provider tidak didukung: ${provider}`
  );
}

/* =====================================================
   STREAM NORMALIZER
===================================================== */

export function normalizeStream(
  provider: "gemini" | "groq",
  body: ReadableStream<Uint8Array>
) {
  const reader = body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result =
          await reader.read();

        if (result.done) {
          if (buffer.trim()) {
            processBuffer(
              provider,
              buffer,
              controller
            );
          }

          controller.close();

          return;
        }

        buffer += decoder.decode(
          result.value,
          {
            stream: true,
          }
        );

        const lines =
          buffer.split(/\r?\n/);

        buffer =
          lines.pop() ?? "";

        for (const line of lines) {
          processLine(
            provider,
            line,
            controller
          );
        }
      } catch (error) {
        controller.error(error);
      }
    },

    async cancel() {
      try {
        await reader.cancel();
      } catch {}
    },
  });
}

function processBuffer(
  provider: "gemini" | "groq",
  buffer: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  const lines =
    buffer.split(/\r?\n/);

  for (const line of lines) {
    processLine(
      provider,
      line,
      controller
    );
  }
}

function processLine(
  provider: "gemini" | "groq",
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  const trimmed =
    line.trim();

  if (!trimmed) {
    return;
  }

  let data = trimmed;

  if (data.startsWith("data:")) {
    data =
      data.slice(5).trim();
  }

  if (
    !data ||
    data === "[DONE]"
  ) {
    return;
  }

  try {
    const json =
      JSON.parse(data);

    let text = "";

    /* -----------------------------
       GEMINI
    ----------------------------- */

    if (provider === "gemini") {
      text =
        json
          ?.candidates?.[0]
          ?.content?.parts
          ?.map(
            (
              part: {
                text?: string;
              }
            ) =>
              part?.text || ""
          )
          .join("") || "";
    }

    /* -----------------------------
       GROQ
    ----------------------------- */

    if (provider === "groq") {
      text =
        json
          ?.choices?.[0]
          ?.delta?.content || "";
    }

    if (text) {
      controller.enqueue(
        new TextEncoder().encode(text)
      );
    }
  } catch {
    // Abaikan data SSE yang belum lengkap/tidak valid.
  }
}
