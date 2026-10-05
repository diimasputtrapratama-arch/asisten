export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ProviderResponse = {
  body: ReadableStream<Uint8Array> | null;
};

function getApiKey(provider: string) {
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error("GEMINI_API_KEY belum diset");
    }

    return key;
  }

  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY;

    if (!key) {
      throw new Error("GROQ_API_KEY belum diset");
    }

    return key;
  }

  throw new Error(`Provider tidak didukung: ${provider}`);
}

function normalizeRole(role: ChatMessage["role"]) {
  return role === "assistant" ? "model" : "user";
}

async function gemini(
  messages: ChatMessage[],
  model: string,
  system: string
): Promise<ProviderResponse> {
  const apiKey = getApiKey("gemini");

  const contents = messages
    .filter((message) => message.content?.trim())
    .map((message) => ({
      role: normalizeRole(message.role),
      parts: [
        {
          text: message.content,
        },
      ],
    }));

  if (contents.length === 0) {
    throw new Error("Pesan kosong.");
  }

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

    console.error("GEMINI HTTP ERROR:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });

    let detail = errorText;

    try {
      const json = JSON.parse(errorText);

      detail =
        json?.error?.message ||
        json?.error?.status ||
        errorText;
    } catch {
      // response bukan JSON
    }

    throw new Error(
      `Gemini HTTP ${response.status}: ${detail}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Gemini tidak mengirim response body."
    );
  }

  return {
    body: response.body,
  };
}

async function groq(
  messages: ChatMessage[],
  model: string,
  system: string
): Promise<ProviderResponse> {
  const apiKey = getApiKey("groq");

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

    console.error("GROQ HTTP ERROR:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });

    let detail = errorText;

    try {
      const json = JSON.parse(errorText);

      detail =
        json?.error?.message ||
        json?.error?.status ||
        errorText;
    } catch {
      // response bukan JSON
    }

    throw new Error(
      `Groq HTTP ${response.status}: ${detail}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Groq tidak mengirim response body."
    );
  }

  return {
    body: response.body,
  };
}

export async function providerStream(
  provider: string,
  messages: ChatMessage[],
  model: string,
  system: string
): Promise<ProviderResponse> {
  const normalized =
    provider.toLowerCase();

  if (
    normalized === "gemini" ||
    normalized === "google"
  ) {
    return gemini(messages, model, system);
  }

  if (normalized === "groq") {
    return groq(messages, model, system);
  }

  throw new Error(
    `Provider tidak didukung: ${provider}`
  );
}

export function normalizeStream(
  provider: string,
  body: ReadableStream<Uint8Array>
) {
  const reader = body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } =
          await reader.read();

        if (done) {
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

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines =
          buffer.split("\n");

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
      await reader.cancel();
    },
  });
}

function processBuffer(
  provider: string,
  buffer: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  const lines = buffer.split("\n");

  for (const line of lines) {
    processLine(
      provider,
      line,
      controller
    );
  }
}

function processLine(
  provider: string,
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  const trimmed = line.trim();

  if (!trimmed) return;

  let data = trimmed;

  if (data.startsWith("data:")) {
    data = data.slice(5).trim();
  }

  if (!data || data === "[DONE]") {
    return;
  }

  try {
    const json = JSON.parse(data);

    let text = "";

    if (
      provider === "gemini" ||
      provider === "google"
    ) {
      text =
        json?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) =>
            part?.text || ""
          )
          .join("") || "";
    }

    if (provider === "groq") {
      text =
        json?.choices?.[0]?.delta?.content ||
        "";
    }

    if (text) {
      controller.enqueue(
        new TextEncoder().encode(text)
      );
    }
  } catch {
    // Abaikan chunk SSE yang bukan JSON.
  }
}
