import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AI_TOOLS, executeTool, readWorkspace, type Json } from "@/lib/ai-tools";
import { openRouterConfig, streamChatCompletion, type OrMessage } from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOOL_ROUNDS = 6;

/**
 * AI Workspace v2 (OpenRouter) — the model can READ and WRITE the creator's
 * workspace through server-side tools (see lib/ai-tools.ts). Every write is
 * scoped to the signed-in creator.
 *
 * POST { conversationId: string | null, message: string }
 * Streams newline-delimited JSON events:
 *   {"type":"tool","name","label","status":"running"|"done"|"error","detail"?}
 *   {"type":"text","value"}   — text delta
 *   {"type":"error","value"}  — fatal stream error
 *   {"type":"done"}
 */
export async function POST(req: Request) {
  let body: { conversationId?: string | null; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const or = openRouterConfig();
  if (!or) {
    return NextResponse.json({ error: "AI is not configured (missing OPENROUTER_API_KEY)." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Creator profile (ownership + brand voice context)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creatorRow, error: creatorErr } = await (supabase.from("creators") as any)
    .select("id, handle, brand_name, tone_of_voice, target_audience, preferred_cta")
    .eq("user_id", user.id)
    .maybeSingle();
  if (creatorErr) {
    console.error("ai: creator load failed", creatorErr);
    return NextResponse.json({ error: "Failed to load your profile." }, { status: 500 });
  }
  if (!creatorRow) {
    return NextResponse.json(
      { error: "Set up your Brand Kit (name + handle) before using the AI workspace." },
      { status: 400 }
    );
  }
  const creator = creatorRow as unknown as {
    id: string;
    handle: string;
    brand_name: string;
    tone_of_voice: string | null;
    target_audience: string | null;
    preferred_cta: string | null;
  };

  // Conversation: reuse or create.
  let conversationId = body.conversationId?.trim() || null;
  if (conversationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: owned, error: ownErr } = await (supabase.from("ai_conversations") as any)
      .select("id")
      .eq("id", conversationId)
      .eq("creator_id", creator.id)
      .maybeSingle();
    if (ownErr) {
      console.error("ai: conversation check failed", ownErr);
      return NextResponse.json({ error: "Failed to open that conversation." }, { status: 500 });
    }
    if (!owned) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: createErr } = await (supabase.from("ai_conversations") as any)
      .insert({ creator_id: creator.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (createErr) {
      console.error("ai: conversation create failed", createErr);
      return NextResponse.json({ error: "Couldn't start a new conversation." }, { status: 500 });
    }
    conversationId = (created as { id: string }).id;
  }

  // Workspace snapshot as grounding context.
  let workspace: Json = {};
  try {
    workspace = await readWorkspace(supabase, creator.id);
  } catch (e) {
    console.error("ai: workspace read failed", e);
  }

  // Persist the user message.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: userMsgErr } = await (supabase.from("ai_messages") as any).insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });
  if (userMsgErr) {
    console.error("ai: user message insert failed", userMsgErr);
    return NextResponse.json({ error: "Couldn't save your message." }, { status: 500 });
  }

  // History for the model (oldest last), capped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: historyRows } = await (supabase.from("ai_messages") as any)
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(30);
  const history: OrMessage[] = ((historyRows ?? []) as unknown as { role: string; content: string }[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const system = buildSystemPrompt(workspace, creator);

  const encoder = new TextEncoder();
  let transcript = ""; // the model's text across rounds (saved at the end)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // client disconnected — keep going so we can persist the reply
        }
      };

      try {
        const messages: OrMessage[] = [...history];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const result = await streamChatCompletion({
            apiKey: or.apiKey,
            model: or.model,
            messages: [{ role: "system", content: system }, ...messages],
            tools: AI_TOOLS.map((t) => ({
              type: "function" as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema as Record<string, unknown>,
              },
            })),
            onText: (delta) => {
              transcript += delta;
              send({ type: "text", value: delta });
            },
          });

          if (!result.toolCalls.length) break; // pure text answer — done

          // Assistant turn with tool calls (OpenAI message shape).
          messages.push({
            role: "assistant",
            content: result.text || null,
            tool_calls: result.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.rawArgs || "{}" },
            })),
          });

          // Execute each tool server-side, scoped to this creator.
          for (const tc of result.toolCalls) {
            const res = await executeTool(supabase, creator.id, tc.name, tc.args);
            send({
              type: "tool",
              name: tc.name,
              status: res.ok ? "done" : "error",
              label: TOOL_LABELS[tc.name] ?? tc.name,
              detail: res.ok ? res.summary : res.error,
            });
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: res.ok
                ? JSON.stringify({ ok: true, summary: res.summary, data: res.data ?? null })
                : JSON.stringify({ ok: false, error: res.error }),
            });
          }
          // loop: the model sees the results and continues
        }

        send({ type: "done" });
      } catch (e) {
        console.error("ai: stream failed", e);
        send({ type: "error", value: e instanceof Error ? e.message : "The AI request failed. Try again." });
      } finally {
        if (transcript.trim()) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("ai_messages") as any).insert({
              conversation_id: conversationId,
              role: "assistant",
              content: transcript.trim(),
            });
          } catch (e) {
            console.error("ai: assistant message insert failed", e);
          }
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Conversation-Id": conversationId,
    },
  });
}

/* ------------------------------------------------------------------ */

const TOOL_LABELS: Record<string, string> = {
  get_workspace: "Reading your workspace",
  update_brand_kit: "Updating your brand kit",
  update_storefront_section: "Editing your storefront",
  set_storefront_section_enabled: "Toggling a storefront section",
  upsert_product: "Saving a product",
  upsert_course: "Saving your course",
  create_landing_page: "Creating a landing page",
};

function buildSystemPrompt(
  workspace: Json,
  creator: { brand_name: string; handle: string }
): string {
  return [
    `You are the AI workspace inside CNS Creator OS — the AI-first platform where creators build, launch, sell and teach. You are working with ${creator.brand_name} (/c/${creator.handle}).`,
    "",
    "You CAN make real changes. You have tools to: read the workspace, update the brand kit, edit storefront sections and toggle them, create/update products, create/update courses with full curricula (modules, lessons, notes, video links, quizzes), and create landing pages. When the creator asks for a change, DO IT with the right tool — never reply with mere instructions — then summarize exactly what changed.",
    "",
    "Guidelines:",
    "- Answer in the language the creator writes in; write copy in their brand voice (tone of voice and audience are in the workspace data).",
    "- Ground everything in the <workspace_data> snapshot below; call get_workspace first when you need fresh or deeper detail (e.g. before editing a specific section).",
    "- Default to drafts: pass publish:true ONLY when the creator explicitly says to publish. Mention the draft state in your summary.",
    "- Prices are US dollars (numbers, not cents).",
    "- For storefront sections, set complete copy (headline + subheadline + CTA) rather than fragments, and enable the section when you fill it.",
    "- After tool calls, keep the final summary short and concrete: what changed, where to see it.",
    "- If a tool errors, say plainly what failed.",
    "",
    "<workspace_data>",
    JSON.stringify(workspace, null, 2),
    "</workspace_data>",
  ].join("\n");
}
