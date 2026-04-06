import {
  ChevronDownIcon,
  CodeIcon,
  OctagonAlertIcon,
  TerminalIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { MarkdownContent } from "@/apps/threads/components/markdown-content";

import type { StreamEvent } from "./message-item";

export interface EventGroup {
  type: string;
  content: string;
  tool?: string;
  file?: string;
  metadata?: Record<string, unknown>;
}

export function groupEvents(events: StreamEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.type === event.type &&
      (event.type === "text" || event.type === "thinking")
    ) {
      last.content += event.content;
    } else {
      groups.push({
        type: event.type,
        content: event.content,
        tool: event.tool,
        file: event.file,
        metadata: event.metadata,
      });
    }
  }
  return groups;
}

export function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="text-muted-foreground hover:bg-muted/50 w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <ChevronDownIcon
          className={`size-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="font-medium">Thinking</span>
        {!open && (
          <span className="ml-1 truncate opacity-60">
            {content.slice(0, 80)}
            {content.length > 80 ? "..." : ""}
          </span>
        )}
      </div>
      {open && (
        <pre className="mt-2 max-h-60 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </button>
  );
}

export function ToolCallBlock({
  tool,
  file,
  content,
}: {
  tool?: string;
  file?: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const label = tool ?? "tool";

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:bg-muted/30 flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
      >
        <CodeIcon className="size-3 shrink-0" />
        <span className="font-medium">{label}</span>
        {file && <span className="truncate opacity-60">{file}</span>}
        <ChevronDownIcon
          className={`ml-auto size-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && content && (
        <pre className="bg-muted/30 max-h-60 overflow-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  );
}

export function ToolResultBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const preview = content.slice(0, 100);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:bg-muted/30 flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
      >
        <TerminalIcon className="size-3 shrink-0" />
        <span className="font-medium">Output</span>
        {!open && (
          <span className="truncate opacity-60">
            {preview}
            {content.length > 100 ? "..." : ""}
          </span>
        )}
        <ChevronDownIcon
          className={`ml-auto size-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <pre className="bg-muted/30 max-h-60 overflow-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  );
}

export function extractUsageFromMetadata(metadata: Record<string, unknown>): {
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  costUsd?: number;
} {
  const usage = metadata.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;
  const inputTokens = usage?.input_tokens;
  const outputTokens = usage?.output_tokens;
  const durationMs = metadata.duration_ms as number | undefined;
  const costUsd = metadata.total_cost_usd as number | undefined;
  return { inputTokens, outputTokens, durationMs, costUsd };
}

export function ResultFooter({
  metadata,
}: {
  metadata?: Record<string, unknown>;
  content: string;
}) {
  if (!metadata) return null;
  const { inputTokens, outputTokens, durationMs, costUsd } =
    extractUsageFromMetadata(metadata);
  const totalTokens =
    inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined;

  return (
    <div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-[11px]">
      {totalTokens !== undefined && (
        <span>{totalTokens.toLocaleString()} tokens</span>
      )}
      {durationMs !== undefined && (
        <span>{(durationMs / 1000).toFixed(1)}s</span>
      )}
      {costUsd !== undefined && <span>${costUsd.toFixed(4)}</span>}
    </div>
  );
}

/**
 * Renders an array of EventGroup items using the appropriate block component
 * for each type. Used by both streaming and completed message content.
 */
export function EventGroupRenderer({ groups }: { groups: EventGroup[] }) {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, i) => {
        switch (group.type) {
          case "thinking":
            return <ThinkingBlock key={i} content={group.content} />;
          case "text":
            return <MarkdownContent key={i}>{group.content}</MarkdownContent>;
          case "tool_call":
            return (
              <ToolCallBlock
                key={i}
                tool={group.tool}
                file={group.file}
                content={group.content}
              />
            );
          case "tool_result":
            return <ToolResultBlock key={i} content={group.content} />;
          case "error":
            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
              >
                <OctagonAlertIcon className="mt-0.5 size-3 shrink-0" />
                <pre className="font-mono whitespace-pre-wrap">
                  {group.content}
                </pre>
              </div>
            );
          case "result":
            return (
              <ResultFooter
                key={i}
                content={group.content}
                metadata={group.metadata}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function StreamingContent({ events }: { events: StreamEvent[] }) {
  const groups = useMemo(() => groupEvents(events), [events]);
  return <EventGroupRenderer groups={groups} />;
}

export function parseMetadataEvents(
  metadata: Record<string, unknown> | null,
): EventGroup[] | null {
  if (!metadata) return null;
  try {
    const parsed = metadata as {
      events?: Array<{
        type: string;
        content: string;
        tool?: string;
        file?: string;
        metadata?: Record<string, unknown>;
      }>;
      total_cost_usd?: number;
      duration_ms?: number;
      tokens_used?: number;
    };
    if (!parsed.events || !Array.isArray(parsed.events)) return null;
    const groups: EventGroup[] = [];
    for (const event of parsed.events) {
      const last = groups[groups.length - 1];
      if (
        last &&
        last.type === event.type &&
        (event.type === "text" || event.type === "thinking")
      ) {
        last.content += event.content;
      } else {
        groups.push({
          type: event.type,
          content: event.content,
          tool: event.tool,
          file: event.file,
          metadata: event.metadata,
        });
      }
    }
    const hasResult = groups.some((g) => g.type === "result");
    if (
      !hasResult &&
      (parsed.total_cost_usd || parsed.duration_ms || parsed.tokens_used)
    ) {
      groups.push({
        type: "result",
        content: "",
        metadata: {
          total_cost_usd: parsed.total_cost_usd,
          duration_ms: parsed.duration_ms,
          tokens_used: parsed.tokens_used,
        },
      });
    }
    return groups.length > 0 ? groups : null;
  } catch {
    return null;
  }
}
