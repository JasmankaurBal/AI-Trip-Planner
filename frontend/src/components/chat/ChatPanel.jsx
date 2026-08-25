import React, { useEffect, useRef, useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { CocoAvatar } from "../Logo";
import { API_BASE } from "../../api/client";
import { cn } from "../../utils";

const SUGGESTIONS = [
  "What should I not miss?",
  "Make day 2 cheaper",
  "Suggest a local food spot",
  "How's the weather looking?",
];

export default function ChatPanel({ tripId, conversationId: initialConv, className, compact, guest, context }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState(initialConv || null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const token = localStorage.getItem("coco_token");
      const url = guest ? `${API_BASE}/api/explore/chat` : `${API_BASE}/api/chat`;
      const body = guest
        ? { message: msg, context: context || null, history: messages.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content })) }
        : { message: msg, trip_id: tripId || null, conversation_id: convId };
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data:\s?/, "").trim();
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "meta" && evt.conversation_id) setConvId(evt.conversation_id);
            else if (evt.type === "token") {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + evt.content };
                return copy;
              });
            } else if (evt.type === "error") {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: evt.content };
                return copy;
              });
            }
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "COCO is unavailable right now. Please try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className={cn("flex flex-col", className)} data-testid="chat-panel">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CocoAvatar size={56} />
            <div>
              <p className="text-lg font-bold text-ink">Hi, I'm COCO</p>
              <p className="mt-1 max-w-xs text-sm text-ink-soft">
                {tripId ? "Ask me anything about this trip — I know your itinerary." : "Ask me anything about travel, destinations or planning."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip hover:chip-active" data-testid={`chat-suggestion`}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "flex-row-reverse" : "")}>
            {m.role === "assistant" && <CocoAvatar size={30} className="mt-0.5 shrink-0" />}
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "bg-brand text-white" : "bg-muted text-ink"
              )}
              data-testid={`chat-message-${m.role}`}
            >
              {m.content || (streaming && i === messages.length - 1 ? <span className="animate-pulse-soft">COCO is thinking…</span> : "")}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 border-t border-border bg-surface p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message COCO…"
          className="field flex-1"
          data-testid="chat-input"
          disabled={streaming}
        />
        <button type="submit" className="btn-primary !px-3.5 !py-3" disabled={streaming || !input.trim()} data-testid="chat-send" aria-label="Send">
          <PaperPlaneRight size={20} weight="fill" />
        </button>
      </form>
    </div>
  );
}
