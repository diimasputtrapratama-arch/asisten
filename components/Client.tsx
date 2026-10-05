"use client";

import { useEffect, useRef, useState } from "react";

type Assistant = {
  id: string;
  name: string;
  description?: string | null;
};

type User = {
  id: string;
  email: string;
  role: string;
  profile?: {
    name?: string | null;
    nickname?: string | null;
  } | null;
};

type Props = {
  user: User | null;
  assistants: Assistant[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

export default function Client({
  user,
  assistants,
}: Props) {
  const [assistantId, setAssistantId] = useState(
    assistants[0]?.id ?? ""
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceState, setVoiceState] =
    useState<VoiceState>("idle");
  const [autoSpeak, setAutoSpeak] = useState(true);

  const abortRef =
    useRef<AbortController | null>(null);

  const recognitionRef =
    useRef<any>(null);

  const mountedRef =
    useRef(true);

  const assistant =
    assistants.find(
      (item) => item.id === assistantId
    ) ?? assistants[0];

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  async function sendMessage(
    messageText?: string,
    speakResponse = false
  ) {
    const text = (
      messageText ?? input
    ).trim();

    if (!text) return;

    if (!assistantId) {
      setError("Assistant belum tersedia.");
      return;
    }

    if (loading) return;

    setError("");

    const userMessage: Message = {
      role: "user",
      content: text,
    };

    const conversation = [
      ...messages,
      userMessage,
    ];

    setMessages(conversation);

    if (!messageText) {
      setInput("");
    }

    setLoading(true);

    if (speakResponse) {
      setVoiceState("processing");
    }

    const controller =
      new AbortController();

    abortRef.current = controller;

    try {
      const response =
        await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          signal:
            controller.signal,
          body: JSON.stringify({
            assistantId,
            messages:
              conversation,
          }),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Server error ${response.status}`
        );
      }

      if (
        !data?.message ||
        typeof data.message !== "string"
      ) {
        throw new Error(
          "Putra tidak mengirim jawaban."
        );
      }

      const answer =
        data.message.trim();

      if (!answer) {
        throw new Error(
          "Putra mengirim jawaban kosong."
        );
      }

      setMessages([
        ...conversation,
        {
          role: "assistant",
          content: answer,
        },
      ]);

      if (
        speakResponse ||
        autoSpeak
      ) {
        speak(answer);
      } else {
        setVoiceState("idle");
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === "AbortError"
      ) {
        setVoiceState("idle");
        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan.";

      console.error(
        "CHAT ERROR:",
        err
      );

      setError(message);

      setMessages([
        ...conversation,
        {
          role: "assistant",
          content:
            `⚠️ ${message}`,
        },
      ]);

      setVoiceState("idle");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }

      abortRef.current = null;
    }
  }

  /* =====================================================
     STOP
  ===================================================== */

  function stopGeneration() {
    abortRef.current?.abort();

    abortRef.current = null;

    if (
      typeof window !== "undefined"
    ) {
      window.speechSynthesis?.cancel();
    }

    recognitionRef.current?.abort();

    recognitionRef.current = null;

    setLoading(false);
    setVoiceState("idle");
  }

  /* =====================================================
     TEXT TO SPEECH
  ===================================================== */

  function speak(text: string) {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    if (
      !("speechSynthesis" in window)
    ) {
      setVoiceState("idle");
      return;
    }

    window.speechSynthesis.cancel();

    const speech =
      new SpeechSynthesisUtterance(
        text
      );

    speech.lang = "id-ID";
    speech.rate = 1;
    speech.pitch = 1;

    speech.onstart = () => {
      if (mountedRef.current) {
        setVoiceState("speaking");
      }
    };

    speech.onend = () => {
      if (mountedRef.current) {
        setVoiceState("idle");
      }
    };

    speech.onerror = () => {
      if (mountedRef.current) {
        setVoiceState("idle");
      }
    };

    window.speechSynthesis.speak(
      speech
    );
  }

  /* =====================================================
     VOICE INPUT
  ===================================================== */

  function startVoiceInput() {
    if (loading) {
      return;
    }

    /* STOP SPEAKING */

    if (
      voiceState === "speaking"
    ) {
      window.speechSynthesis?.cancel();

      setVoiceState("idle");

      return;
    }

    /* STOP LISTENING */

    if (
      voiceState === "listening"
    ) {
      recognitionRef.current?.stop();

      recognitionRef.current = null;

      setVoiceState("idle");

      return;
    }

    /* SPEECH RECOGNITION */

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any)
            .SpeechRecognition ||
          (window as any)
            .webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setError(
        "Browser ini tidak mendukung voice input."
      );

      return;
    }

    setError("");

    const recognition =
      new SpeechRecognition();

    recognitionRef.current =
      recognition;

    recognition.lang = "id-ID";

    recognition.continuous = false;

    recognition.interimResults = false;

    recognition.maxAlternatives = 1;

    setVoiceState("listening");

    /* RESULT */

    recognition.onresult = (
      event: any
    ) => {
      const text =
        event.results?.[0]?.[0]
          ?.transcript
          ?.trim() || "";

      recognitionRef.current = null;

      if (!text) {
        setVoiceState("idle");

        setError(
          "Suara tidak terdeteksi."
        );

        return;
      }

      setInput(text);

      sendMessage(
        text,
        true
      );
    };

    /* ERROR */

    recognition.onerror = (
      event: any
    ) => {
      console.error(
        "VOICE ERROR:",
        event
      );

      recognitionRef.current = null;

      setVoiceState("idle");

      if (
        event?.error !==
        "aborted"
      ) {
        setError(
          "Voice input gagal. Silakan coba lagi."
        );
      }
    };

    /* END
       IMPORTANT:
       Tidak ada pengecekan voiceState.
       Tidak ada restart microphone.
    */

    recognition.onend = () => {
      recognitionRef.current = null;

      setVoiceState("idle");
    };

    /* START */

    try {
      recognition.start();
    } catch (err) {
      console.error(
        "VOICE START ERROR:",
        err
      );

      recognitionRef.current = null;

      setVoiceState("idle");
    }
  }

  /* =====================================================
     KEYBOARD
  ===================================================== */

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  }

  /* =====================================================
     CLEANUP
  ===================================================== */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      abortRef.current?.abort();

      recognitionRef.current?.abort();

      recognitionRef.current = null;

      if (
        typeof window !== "undefined"
      ) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  /* =====================================================
     LOGIN
  ===================================================== */

  if (!user) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-[#07080b] text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">

          <div className="mb-5 text-5xl">
            ✦
          </div>

          <h1 className="text-3xl font-bold">
            Putra AI
          </h1>

          <p className="mt-3 text-white/50">
            Asisten AI untuk percakapan,
            cerita, dan voice conversation.
          </p>

          <div className="mt-7 flex gap-3 justify-center">

            <a
              href="/login"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              Masuk
            </a>

            <a
              href="/register"
              className="rounded-xl border border-white/10 px-5 py-3"
            >
              Daftar
            </a>

          </div>

        </div>
      </main>
    );
  }

  /* =====================================================
     MAIN
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#07080b] text-white">

      {/* HEADER */}

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080b]/95 backdrop-blur-xl">

        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">

          <div>

            <div className="text-xl font-bold">
              Putra AI
            </div>

            <div className="text-xs text-white/40">
              AI Assistant
            </div>

          </div>

          <div className="flex items-center gap-2">

            {assistants.length > 0 && (
              <select
                value={assistantId}
                onChange={(e) =>
                  setAssistantId(
                    e.target.value
                  )
                }
                className="rounded-xl border border-white/10 bg-[#111218] px-3 py-2 text-sm outline-none"
              >
                {assistants.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>
            )}

            {user.role === "ADMIN" && (
              <a
                href="/admin"
                className="rounded-xl border border-white/10 px-3 py-2 text-sm"
              >
                Admin
              </a>
            )}

          </div>

        </div>

      </header>

      {/* CHAT */}

      <section className="mx-auto max-w-4xl px-4 pb-40 pt-8">

        {assistant && (
          <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">

            <div className="text-xs uppercase tracking-wider text-white/30">
              Assistant
            </div>

            <h2 className="mt-1 text-2xl font-semibold">
              {assistant.name}
            </h2>

            <p className="mt-1 text-sm text-white/40">
              {assistant.description ||
                "Asisten AI Putra."}
            </p>

          </div>
        )}

        {messages.length === 0 ? (

          <div className="grid min-h-[55vh] place-items-center text-center">

            <div>

              <div className="mb-6 text-7xl text-white/40">
                ✦
              </div>

              <h1 className="text-2xl font-medium text-white/70">

                Halo{" "}

                {user.profile?.nickname ||
                  user.profile?.name ||
                  "kamu"}.

              </h1>

              <p className="mt-2 text-white/35">
                Ada yang bisa Putra bantu?
              </p>

            </div>

          </div>

        ) : (

          <div className="space-y-5">

            {messages.map(
              (
                message,
                index
              ) => (

                <div
                  key={index}
                  className={
                    message.role ===
                    "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >

                  <div
                    className={
                      message.role ===
                      "user"
                        ? "max-w-[85%] rounded-3xl bg-white px-5 py-4 text-black"
                        : "max-w-[85%] rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4"
                    }
                  >

                    <div className="whitespace-pre-wrap leading-7">
                      {message.content}
                    </div>

                    {message.role ===
                      "assistant" &&
                      message.content &&
                      !message.content.startsWith(
                        "⚠️"
                      ) && (

                        <button
                          type="button"
                          onClick={() =>
                            speak(
                              message.content
                            )
                          }
                          className="mt-3 text-xs text-white/40 hover:text-white/70"
                        >
                          🔊 Dengarkan
                        </button>

                      )}

                  </div>

                </div>

              )
            )}

          </div>

        )}

        {/* ERROR */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* LOADING */}

        {loading && (
          <div className="mt-5 flex items-center gap-2 text-sm text-white/40">

            <span className="animate-pulse">
              ●
            </span>

            Putra sedang menjawab...

          </div>
        )}

        {/* LISTENING */}

        {voiceState === "listening" && (
          <div className="mt-5 text-center text-sm text-white/40">
            🎙️ Putra sedang mendengarkan...
          </div>
        )}

        {/* SPEAKING */}

        {voiceState === "speaking" && (
          <div className="mt-5 text-center text-sm text-white/40">
            🔊 Putra sedang berbicara...
          </div>
        )}

      </section>

      {/* INPUT BAR */}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07080b]/95 p-3 backdrop-blur-xl">

        <div className="mx-auto max-w-4xl">

          <div className="flex items-end gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2">

            <textarea
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder="Tulis pesan untuk Putra..."
              rows={1}
              disabled={
                loading ||
                voiceState ===
                  "listening"
              }
              className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 outline-none"
            />

            {/* MICROPHONE */}

            <button
              type="button"
              onClick={
                startVoiceInput
              }
              disabled={
                loading &&
                voiceState !==
                  "speaking"
              }
              className={
                voiceState ===
                "listening"
                  ? "rounded-2xl bg-red-500 px-4 py-3 font-semibold"
                  : voiceState ===
                      "speaking"
                    ? "rounded-2xl bg-white px-4 py-3 text-black"
                    : "rounded-2xl border border-white/10 px-4 py-3"
              }
              title={
                voiceState ===
                "listening"
                  ? "Berhenti mendengarkan"
                  : voiceState ===
                      "speaking"
                    ? "Hentikan suara Putra"
                    : "Bicara dengan Putra"
              }
            >
              {voiceState ===
              "listening"
                ? "■"
                : voiceState ===
                    "speaking"
                  ? "🔊"
                  : "🎙️"}
            </button>

            {/* SEND / STOP */}

            {loading ? (

              <button
                type="button"
                onClick={
                  stopGeneration
                }
                className="rounded-2xl bg-red-500 px-5 py-3 font-semibold"
              >
                ■
              </button>

            ) : (

              <button
                type="button"
                onClick={() =>
                  sendMessage()
                }
                disabled={
                  !input.trim()
                }
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-30"
              >
                Kirim
              </button>

            )}

          </div>

          {/* FOOTER */}

          <div className="flex items-center justify-center gap-3 py-2 text-[11px] text-white/20">

            <span>
              Putra AI
            </span>

            <button
              type="button"
              onClick={() =>
                setAutoSpeak(
                  (value) =>
                    !value
                )
              }
              className="hover:text-white/50"
            >
              {autoSpeak
                ? "🔊 Suara ON"
                : "🔇 Suara OFF"}
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}
