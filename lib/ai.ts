export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

async function gemini(
  messages: ChatMessage[],
  model: string,
  system: string
) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY belum diset");
  }

  const contents = messages
    .filter((x) => x.role !== "system")
    .map((x) => ({
      role: x.role === "assistant" ? "model" : "user",
      parts: [{ text: x.content }],
    }));

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
        },
      }),
    }
  );
}

async function groq(
  messages: ChatMessage[],
  model: string,
  system: string
) {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error("GROQ_API_KEY belum diset");
  }

  return fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: system,
          },
          ...messages,
        ],
        temperature: 0.7,
        stream: true,
      }),
    }
  );
}

export async function providerStream(
  provider: string,
  messages: ChatMessage[],
  model: string,
  system: string
) {
  if (provider === "groq") {
    const response = await groq(
      messages,
      model || "llama-3.3-70b-versatile",
      system
    );

    if (response.ok) {
      return response;
    }

    const error = await response.text();
    console.error("GROQ_ERROR:", error);

    throw new Error(
      "Groq gagal memberikan response."
    );
  }

  const response = await gemini(
    messages,
    model || "gemini-2.5-flash",
    system
  );

  if (response.ok) {
    return response;
  }

  const error = await response.text();
  console.error("GEMINI_ERROR:", error);

  throw new Error(
    "Gemini gagal memberikan response."
  );
}

export function normalizeStream(
  provider: string,
  upstream: ReadableStream<Uint8Array>
) {
  const reader = upstream.getReader();

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } =
          await reader.read();

        if (done) {
          controller.close();
          return;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line.startsWith("data:")) {
            continue;
          }

          const data = line
            .slice(5)
            .trim();

          if (!data || data === "[DONE]") {
            continue;
          }

          try {
            const json = JSON.parse(data);

            let text = "";

            if (provider === "groq") {
              text =
                json.choices?.[0]?.delta
                  ?.content || "";
            } else {
              text =
                json.candidates?.[0]
                  ?.content?.parts?.[0]
                  ?.text || "";
            }

            if (text) {
              controller.enqueue(
                encoder.encode(text)
              );
            }
          } catch {
            // Abaikan potongan SSE yang belum lengkap.
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },

    cancel() {
      reader.cancel();
    },
  });
}
