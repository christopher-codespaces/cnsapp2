// =============================================================================
// CNS Creator OS — OpenRouter client (server-side)
// -----------------------------------------------------------------------------
// OpenAI-compatible chat-completions against OpenRouter, with SSE streaming
// and tool-call assembly. Used by the AI workspace agent loop.
// Configure via .env:
//   OPENROUTER_API_KEY  — sk-or-v1-…
//   OPENROUTER_MODEL    — defaults to "openrouter/free" (auto-routes across
//                         the best free models; all $0.00)
// =============================================================================

const BASE = "https://openrouter.ai/api/v1";

export type OpenRouterRole = "system" | "user" | "assistant" | "tool";

export interface OrToolCall {
  id: string;
  name: string;
  /** Parsed arguments object (empty when the model sent none or invalid JSON). */
  args: Record<string, unknown>;
  /** Raw arguments string, kept for debugging/echo. */
  rawArgs: string;
}

export interface OrMessage {
  role: OpenRouterRole;
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface OrToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamResult {
  text: string;
  toolCalls: OrToolCall[];
  finishReason: string | null;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    // OpenRouter attribution headers (optional but recommended).
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "CNS Creator OS",
  };
}

/**
 * Stream a chat completion, assembling text deltas and tool calls.
 * Calls `onText` for each text delta (so the route can forward tokens live)
 * and resolves with the fully-assembled result.
 */
export async function streamChatCompletion({
  apiKey,
  model,
  messages,
  tools,
  onText,
  signal,
}: {
  apiKey: string;
  model: string;
  messages: OrMessage[];
  tools?: OrToolSchema[];
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<StreamResult> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      model,
      messages,
      ...(tools?.length ? { tools } : {}),
      stream: true,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `OpenRouter request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j?.error?.message) detail = j.error.message;
    } catch {
      // keep default
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let finishReason: string | null = null;
  // tool-call parts arrive as indexed deltas across chunks
  const tcAcc: Map<number, { id: string; name: string; args: string }> = new Map();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let evt: {
        choices?: {
          delta?: {
            content?: string | null;
            tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
          };
          finish_reason?: string | null;
        }[];
      };
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      const choice = evt.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta;
      if (!delta) continue;
      if (typeof delta.content === "string" && delta.content.length) {
        text += delta.content;
        onText?.(delta.content);
      }
      if (delta.tool_calls?.length) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const acc = tcAcc.get(idx) ?? { id: "", name: "", args: "" };
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
          tcAcc.set(idx, acc);
        }
      }
    }
  }

  const toolCalls: OrToolCall[] = [...tcAcc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, acc]) => {
      let args: Record<string, unknown> = {};
      try {
        args = acc.args ? (JSON.parse(acc.args) as Record<string, unknown>) : {};
      } catch {
        args = {};
      }
      return { id: acc.id || `call_${Math.random().toString(36).slice(2)}`, name: acc.name, args, rawArgs: acc.args };
    });

  return { text, toolCalls, finishReason };
}

/** Non-streaming one-shot (used for titles/tests). */
export async function chatCompletion({
  apiKey,
  model,
  messages,
  maxTokens = 200,
}: {
  apiKey: string;
  model: string;
  messages: OrMessage[];
  maxTokens?: number;
}): Promise<string | null> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? null;
}

export function openRouterConfig(): { apiKey: string; model: string } | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: process.env.OPENROUTER_MODEL || "openrouter/free" };
}
