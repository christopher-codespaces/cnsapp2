"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Sparkles,
  Send,
  Square,
  Trash2,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  PenLine,
} from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Tool activity shown inline while (and after) the model works. */
interface ToolActivity {
  key: string;
  name: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
}

const SUGGESTIONS = [
  "Rewrite my hero headline and subheadline in my brand voice",
  "Create a 4-module course about my topic with quizzes",
  "Build me a sales landing page for my product",
  "Add an ebook product at $27",
];

export default function AiWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [tools, setTools] = useState<ToolActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setConversations((data ?? []) as unknown as Conversation[]);
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load conversations");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase
          .from("ai_conversations")
          .select("id, title, updated_at")
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) {
          setConversations((data ?? []) as unknown as Conversation[]);
          setListError(null);
        }
      } catch (e) {
        if (!cancelled) setListError(e instanceof Error ? e.message : "Failed to load conversations");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(id: string) {
    setMessagesLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ai_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data ?? []) as unknown as Message[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setMessagesLoading(false);
    }
  }

  function selectConversation(id: string) {
    if (streaming) return;
    setActiveId(id);
    setArmedDelete(null);
    void loadMessages(id);
  }

  function newChat() {
    if (streaming) return;
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function deleteConversation(id: string) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // Hand-rolled Database type lacks Relationships keys (see brand-kit).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("ai_conversations") as any).delete().eq("id", id);
      if (error) throw error;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      setArmedDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete conversation");
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setError(null);
    setTools([]);
    setMessages((prev) => [
      ...prev,
      { id: `local-user-${Date.now()}`, role: "user", content: message, created_at: new Date().toISOString() },
    ]);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message }),
        signal: abort.signal,
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          // keep default
        }
        throw new Error(msg);
      }
      const convId = res.headers.get("X-Conversation-Id");
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        const assistantId = `stream-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() },
        ]);
        let acc = "";
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // NDJSON: one JSON event per line.
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let evt: {
              type: string;
              value?: string;
              name?: string;
              label?: string;
              status?: ToolActivity["status"];
              detail?: string;
            };
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            if (evt.type === "text" && typeof evt.value === "string") {
              acc += evt.value;
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
            } else if (evt.type === "tool") {
              const key = `${evt.name}-${evt.label}`;
              setTools((prev) => {
                const next = prev.filter((t) => t.key !== key || evt.status === "running");
                return [
                  ...next.filter((t) => t.key !== key),
                  { key, name: evt.name ?? "", label: evt.label ?? evt.name ?? "Tool", status: evt.status ?? "running", detail: evt.detail },
                ];
              });
            } else if (evt.type === "error" && typeof evt.value === "string") {
              setError(evt.value);
            }
          }
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, id: `done-${convId}-${Date.now()}` } : m))
        );
      }
      if (convId) setActiveId(convId);
      void refreshConversations();
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? "";

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Conversation sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 sm:flex">
        <div className="border-b border-zinc-200 p-3">
          <Button size="sm" className="w-full" onClick={newChat} disabled={streaming}>
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {listLoading ? (
            <p className="px-2 py-4 text-center text-xs text-zinc-400">Loading…</p>
          ) : listError ? (
            <p className="px-2 py-4 text-center text-xs text-red-600">{listError}</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-400">
              No conversations yet.
              <br />
              Ask anything about your workspace.
            </p>
          ) : (
            conversations.map((c) => {
              const active = activeId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                    active ? "bg-zinc-200/70 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="flex-1 truncate">{c.title}</span>
                  {armedDelete === c.id ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteConversation(c.id);
                      }}
                      className="shrink-0 text-xs font-semibold text-red-600"
                    >
                      Sure?
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        setArmedDelete(c.id);
                      }}
                      className="shrink-0 text-zinc-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat column */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="truncate text-sm font-medium text-zinc-800">
              {activeId ? activeTitle || "Conversation" : "New chat"}
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1 border-amber-200 bg-amber-50 font-normal text-amber-700">
            <PenLine className="h-3 w-3" />
            Can edit your workspace
          </Badge>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messagesLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
                  <Sparkles className="h-5 w-5" />
                </span>
                <h2 className="mt-3 text-base font-semibold text-zinc-900">
                  Your AI workspace manager
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                  I can edit your storefront copy, build courses and products, create landing
                  pages and update your brand kit — just ask.
                </p>
              </div>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("mb-3 flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-md bg-zinc-900 text-white"
                        : "rounded-bl-md bg-zinc-100 text-zinc-800"
                    )}
                  >
                    {m.content ||
                      (streaming ? (
                        <span className="opacity-50">Thinking…</span>
                      ) : (
                        ""
                      ))}
                  </div>
                </div>
              ))}
              {streaming && tools.length ? (
                <div className="mb-3 flex flex-col gap-1.5">
                  {tools.map((t) => (
                    <div
                      key={t.key + t.status}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                        t.status === "running" && "border-zinc-200 bg-zinc-50 text-zinc-600",
                        t.status === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                        t.status === "error" && "border-red-200 bg-red-50 text-red-600"
                      )}
                    >
                      {t.status === "running" ? (
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : t.status === "done" ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="min-w-0">
                        <span className="font-medium">{t.label}</span>
                        {t.detail ? <span className="block text-[11px] opacity-80">{t.detail}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {!streaming && tools.some((t) => t.status !== "running") ? (
                <div className="mb-3 flex flex-col gap-1.5">
                  {tools
                    .filter((t) => t.status !== "running")
                    .map((t) => (
                      <div
                        key={t.key + t.status}
                        className={cn(
                          "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                          t.status === "done"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-600"
                        )}
                      >
                        {t.status === "done" ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="font-medium">{t.label}</span>
                          {t.detail ? <span className="block text-[11px] opacity-80">{t.detail}</span> : null}
                        </span>
                      </div>
                    ))}
                  <Link
                    href="/dashboard/storefront"
                    className="text-[11px] text-zinc-400 underline hover:text-zinc-600"
                  >
                    Open the storefront builder to review the changes
                  </Link>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 p-3">
          {error ? (
            <p className="mb-2 text-xs text-red-600">{error}</p>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask about your storefront, copy, structure…"
              className="max-h-40 min-h-[40px] flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
            {streaming ? (
              <Button type="button" variant="outline" size="icon" onClick={stop} aria-label="Stop generating">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            The AI can edit your storefront, brand kit, products, courses and landing pages.
            New items save as drafts for your review.
          </p>
        </div>
      </main>
    </div>
  );
}