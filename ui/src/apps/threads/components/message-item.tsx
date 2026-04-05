import {
  BotIcon,
  ChevronDownIcon,
  CircleXIcon,
  CodeIcon,
  Loader2Icon,
  OctagonAlertIcon,
  TerminalIcon,
  UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import Markdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface StreamEvent {
  message_id: string;
  type: "thinking" | "text" | "tool_call" | "tool_result" | "error" | "result";
  content: string;
  tool?: string;
  file?: string;
  metadata?: Record<string, unknown>;
}

interface MessageItemProps {
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    model: string | null;
    status: string;
    created_at: string;
  };
  streamEvents?: StreamEvent[];
  overrideStatus?: string;
  onCancel?: () => void;
}

interface EventGroup {
  type: string;
  content: string;
  tool?: string;
  file?: string;
  metadata?: Record<string, unknown>;
}

function groupEvents(events: StreamEvent[]): EventGroup[] {
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

function ThinkingBlock({ content }: { content: string }) {
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

function ToolCallBlock({
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

function ToolResultBlock({ content }: { content: string }) {
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

function ResultFooter({
  metadata,
}: {
  metadata?: Record<string, unknown>;
  content: string;
}) {
  if (!metadata) return null;
  const tokens = metadata.tokens_used as number | undefined;
  const durationMs = metadata.duration_ms as number | undefined;
  const cost = metadata.total_cost_usd as number | undefined;

  return (
    <div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-[11px]">
      {tokens !== undefined && <span>{tokens.toLocaleString()} tokens</span>}
      {durationMs !== undefined && (
        <span>{(durationMs / 1000).toFixed(1)}s</span>
      )}
      {cost !== undefined && <span>${cost.toFixed(4)}</span>}
    </div>
  );
}

function StreamingContent({ events }: { events: StreamEvent[] }) {
  const groups = useMemo(() => groupEvents(events), [events]);

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, i) => {
        switch (group.type) {
          case "thinking":
            return <ThinkingBlock key={i} content={group.content} />;
          case "text":
            return (
              <div
                key={i}
                className="prose prose-sm prose-neutral dark:prose-invert max-w-none"
              >
                <Markdown>{group.content}</Markdown>
              </div>
            );
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

function StatusIndicator({
  status,
  onCancel,
}: {
  status: string;
  onCancel?: () => void;
}) {
  switch (status) {
    case "queued":
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-2 text-xs">
          <Loader2Icon className="size-3 animate-spin" />
          <span>Waiting in queue...</span>
          {onCancel && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onCancel}
              className="text-muted-foreground ml-auto"
            >
              <CircleXIcon data-icon="inline-start" />
              Cancel
            </Button>
          )}
        </div>
      );
    case "running":
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
          <Loader2Icon className="size-3 animate-spin" />
          <span>Running...</span>
          {onCancel && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onCancel}
              className="text-muted-foreground ml-auto"
            >
              <CircleXIcon data-icon="inline-start" />
              Cancel
            </Button>
          )}
        </div>
      );
    case "cancelled":
      return (
        <div className="text-muted-foreground flex items-center gap-1.5 py-1 text-xs">
          <CircleXIcon className="size-3" />
          <span>Cancelled</span>
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-1.5 py-1 text-xs text-red-600 dark:text-red-400">
          <OctagonAlertIcon className="size-3" />
          <span>Error</span>
        </div>
      );
    case "timed_out":
      return (
        <div className="flex items-center gap-1.5 py-1 text-xs text-amber-600 dark:text-amber-400">
          <OctagonAlertIcon className="size-3" />
          <span>Timed out</span>
        </div>
      );
    default:
      return null;
  }
}

export function MessageItem({
  message,
  streamEvents,
  overrideStatus,
  onCancel,
}: MessageItemProps) {
  const status = overrideStatus ?? message.status;
  const isUser = message.role === "user";
  const hasStreamEvents = streamEvents && streamEvents.length > 0;

  if (isUser) {
    return (
      <div className="flex gap-3">
        <div className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full">
          <UserIcon className="text-muted-foreground size-3" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">You</span>
            <span className="text-muted-foreground text-[11px]">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100">
        <BotIcon className="size-3 text-white dark:text-neutral-900" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Assistant</span>
          {message.model && (
            <Badge variant="secondary" className="text-[10px]">
              {message.model}
            </Badge>
          )}
          <span className="text-muted-foreground text-[11px]">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="mt-2">
          {/* Streaming content */}
          {hasStreamEvents && <StreamingContent events={streamEvents} />}

          {/* Static content for completed messages */}
          {!hasStreamEvents && status === "completed" && message.content && (
            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
              <Markdown>{message.content}</Markdown>
            </div>
          )}

          {/* Status indicator for non-completed */}
          {status !== "completed" && (
            <StatusIndicator status={status} onCancel={onCancel} />
          )}
        </div>
      </div>
    </div>
  );
}
