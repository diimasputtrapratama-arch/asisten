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
       
