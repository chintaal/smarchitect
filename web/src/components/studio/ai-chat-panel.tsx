"use client";

import * as React from "react";
import { useStudio } from "@/lib/store";
import { applyInstruction } from "@/lib/crg/talk-to-edit";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowUp, Check, Wand2, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  changeCount?: number;
}

const SUGGESTIONS = [
  "Add a Redis cache between the API and the database",
  "Make the database multi-region",
  "Add a CDN in front of the load balancer",
  "Encrypt all data stores",
  "Add monitoring",
];

export function AiChatPanel() {
  const graph = useStudio((s) => s.graph);
  const replaceGraph = useStudio((s) => s.replaceGraph);
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Tell me how to change the architecture and I'll edit the canvas live — routed through LiteLLM. Try “add a Redis cache between the API and the database.”",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: trimmed }]);
    setInput("");
    setThinking(true);

    window.setTimeout(() => {
      const result = applyInstruction(useStudio.getState().graph, trimmed);
      if (result.matched && result.graph) {
        replaceGraph(result.graph, "talk-to-edit", result.summary, result.changeCount);
      }
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", text: result.reply, changeCount: result.matched ? result.changeCount : undefined },
      ]);
      setThinking(false);
    }, 550);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="grid size-7 place-items-center rounded-md bg-primary/15">
          <Wand2 className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">Talk to edit</div>
          <div className="truncate text-[11px] text-muted-foreground">{graph.nodes.length} resources on the canvas</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                m.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted text-foreground",
              )}
            >
              <Markdownish text={m.text} />
              {m.changeCount !== undefined && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] opacity-80">
                  <Check className="size-3" /> {m.changeCount} change{m.changeCount === 1 ? "" : "s"} applied
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Editing the graph…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={thinking}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background/40 p-1.5 focus-within:ring-2 focus-within:ring-ring">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Describe a change…"
            className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="size-3 text-primary" /> Model-agnostic via LiteLLM · falls back automatically
        </div>
      </div>
    </div>
  );
}

/** Minimal **bold** rendering so assistant replies can emphasize node names. */
function Markdownish({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </span>
  );
}
