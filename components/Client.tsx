"use client";

import { useEffect, useRef, useState } from "react";

type Assistant = {
  id: string;
  name: string;
  description?: string | null;
  modelName?: string | null;
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

export default function Client({ user, assistants }: Props) {
  const [assistantId, setAssistantId] = useState(
    assistants[0]?.id ?? ""
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [listening, setListening] = useState(false);
  const [calling, setCalling] = useState(false);

  const recognitionRef = useRef<any>(null);
  const callRef = useRef(false);

  const selectedAssistant =
    assistants.find((a) => a.id === assistantId) ??
    assistants[0];

  /*
   * =========================
   * TEXT CHAT
   * =========================
   */

  async function sendMessage(text?: string) {
    const value = (text ?? input).trim();

    if (!value || !assistantId || loading) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: value,
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId,
          messages: nextMessages,
        }),
      });

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.error ||
            "Gagal menghubungi Putra AI."
        );
      }

      const reader =
        response.body?.getReader();

      if (!reader) {
        throw new Error(
          "Browser tidak mendukung streaming."
        );
      }

      const decoder =
        new TextDecoder();

      let answer = "";

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "",
        },
      ]);

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        answer += decoder.decode(
          value,
          { stream: true }
        );

        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: answer,
          },
        ]);
      }

      return answer;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan.";

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: message,
        },
      ]);

      return message;
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================
   * TEXT TO SPEECH
   * =========================
   */

  function speak(text: string) {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = "id-ID";
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(
      utterance
    );
  }

  /*
   * =========================
   * VOICE INPUT
   * =========================
   */

  function toggleVoiceInput() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any)
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Browser ini belum mendukung voice input."
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onresult = (
      event: any
    ) => {
      const transcript =
        event.results?.[0]?.[0]
          ?.transcript ?? "";

      setInput(transcript);
    };

    recognitionRef.current =
      recognition;

    recognition.start();
  }

  /*
   * =========================
   * CALL / VOICE CONVERSATION
   * =========================
   */

  async function startCall() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any)
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Browser ini belum mendukung Call."
      );
      return;
    }

    callRef.current = true;
    setCalling(true);

    const recognition =
      new SpeechRecognition();

    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = async (
      event: any
    ) => {
      const transcript =
        event.results[
          event.results.length - 1
        ]?.[0]?.transcript?.trim();

      if (
        !transcript ||
        !callRef.current
      ) {
        return;
      }

      try {
        recognition.stop();
      } catch {}

      const answer =
        await sendMessage(transcript);

      if (
        answer &&
        callRef.current
      ) {
        speak(answer);
      }

      if (callRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {}
        }, 500);
      }
    };

    recognition.onend = () => {
      if (
        callRef.current &&
        !loading
      ) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognition.onerror = () => {
      if (callRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {}
        }, 700);
      }
    };

    recognitionRef.current =
      recognition;

    try {
      recognition.start();
    } catch {}
  }

  function stopCall() {
    callRef.current = false;

    setCalling(false);

    try {
      recognitionRef.current?.stop();
    } catch {}

    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }
  }

  function toggleCall() {
    if (calling) {
      stopCall();
    } else {
      startCall();
    }
  }

  /*
   * =========================
   * CLEANUP
   * =========================
   */

  useEffect(() => {
    return () => {
      callRef.current = false;

      try {
        recognitionRef.current?.stop();
      } catch {}

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /*
   * =========================
   * LOGIN SCREEN
   * =========================
   */

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <section className="glass w-full max-w-lg rounded-3xl p-8 text-center">

          <div className="text-5xl mb-5">
            ✦
          </div>

          <h1 className="text-4xl font-bold">
            Putra AI
          </h1>

          <p className="mt-3 text-white/60">
            Asisten AI untuk percakapan,
            cerita, dan voice conversation.
          </p>

          <div className="mt-7 flex gap-3 justify-center">

            <a
              href="/login"
              className="rounded-xl bg-white text-black px-5 py-3 font-semibold"
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

        </section>
      </main>
    );
  }

  /*
   * =========================
   * MAIN UI
   * =========================
   */

  return (
    <main className="min-h-screen flex flex-col">

      {/* HEADER */}

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07080b]/90 backdrop-blur-xl">

        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

          <div>
            <div className="font-bold text-lg">
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
                className="glass rounded-xl px-3 py-2 text-sm bg-transparent"
              >
                {assistants.map(
                  (assistant) => (
                    <option
                      key={assistant.id}
                      value={assistant.id}
                      className="bg-[#111218]"
                    >
                      {assistant.name}
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

      {/* CONTENT */}

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">

        {selectedAssistant && (
          <div className="glass rounded-3xl p-5 mb-6">

            <div className="text-xs uppercase tracking-wider text-white/40">
              Assistant
            </div>

            <h2 className="text-2xl font-semibold mt-1">
              {selectedAssistant.name}
            </h2>

            <p className="text-sm text-white/50 mt-1">
              {selectedAssistant.description ||
                "Asisten AI Putra."}
            </p>

          </div>
        )}

        {/* MESSAGES */}

        <div className="space-y-4 pb-44">

          {messages.length === 0 && (
            <div className="text-center py-24 text-white/40">

              <div className="text-6xl mb-5">
                ✦
              </div>

              <p className="text-lg">
                Halo{" "}
                {user.profile?.nickname ||
                  user.profile?.name ||
                  "kamu"}
                .
              </p>

              <p className="text-sm mt-2">
                Ada yang bisa Putra bantu?
              </p>

            </div>
          )}

          {messages.map(
            (message, index) => {

              const isUser =
                message.role === "user";

              return (
                <div
                  key={index}
                  className={
                    isUser
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >

                  <div
                    className={
                      "max-w-[88%] rounded-3xl px-5 py-4 " +
                      (isUser
                        ? "bg-white text-black"
                        : "glass")
                    }
                  >

                    <div className="whitespace-pre-wrap leading-7">
                      {message.content ||
                        "…"}
                    </div>

                    {!isUser &&
                      message.content && (
                        <button
                          onClick={() =>
                            speak(
                              message.content
                            )
                          }
                          className="mt-3 text-xs text-white/45 hover:text-white"
                        >
                          🔊 Dengarkan
                        </button>
                      )}

                  </div>

                </div>
              );
            }
          )}

          {loading && (
            <div className="text-xs text-white/30">
              Putra sedang berpikir...
            </div>
          )}

        </div>

      </div>

      {/* INPUT */}

      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-[#07080b]/95 backdrop-blur-xl p-3">

        <div className="max-w-4xl mx-auto">

          <div className="glass rounded-3xl p-2 flex items-end gap-2">

            <textarea
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                calling
                  ? "Call aktif — bicara..."
                  : "Tulis pesan untuk Putra..."
              }
              rows={1}
              className="flex-1 resize-none bg-transparent outline-none px-3 py-3 min-h-12"
            />

            {/* VOICE INPUT */}

            <button
              onClick={
                toggleVoiceInput
              }
              title="Voice input"
              className={
                "rounded-2xl px-4 py-3 " +
                (listening
                  ? "bg-white text-black"
                  : "border border-white/10")
              }
            >
              🎙
            </button>

            {/* CALL */}

            <button
              onClick={toggleCall}
              title={
                calling
                  ? "Hentikan Call"
                  : "Mulai Call"
              }
              className={
                "rounded-2xl px-4 py-3 " +
                (calling
                  ? "bg-red-500 text-white"
                  : "border border-white/10")
              }
            >
              {calling ? "■" : "☎"}
            </button>

            {/* SEND */}

            <button
              disabled={
                loading ||
                !input.trim()
              }
              onClick={() =>
                sendMessage()
              }
              className="rounded-2xl bg-white text-black px-5 py-3 font-semibold disabled:opacity-30"
            >
              Kirim
            </button>

          </div>

          <div className="text-center text-[11px] text-white/25 mt-2">
            {calling
              ? "Call aktif • bicara dengan Putra melalui mikrofon"
              : "Putra AI • Chat • Voice • Call"}
          </div>

        </div>

      </div>

    </main>
  );
}
