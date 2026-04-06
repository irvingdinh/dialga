import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleXIcon,
  ClipboardIcon,
  CodeIcon,
  GitForkIcon,
  Loader2Icon,
  OctagonAlertIcon,
  PencilIcon,
  RotateCwIcon,
  TerminalIcon,
  UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";

import { CodeBlock } from "@/apps/threads/components/code-block";
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
    metadata: Record<string, unknown> | null;
    created_at: string;
  };
  streamEvents?: StreamEvent[];
  overrideStatus?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onFork?: () => void;
  onEdit?: (content: string) => void;
}

const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children);
    // Inline code (no language class, single line, short)
    if (!match && !code.includes("\n") && code.length < 200) {
      return (
        <code className="bg-muted rounded px-1.5 py-0.5 text-[13px]">
          {code}
        </code>
      );
    }
    return <CodeBlock language={match?.[1]}>{code}</CodeBlock>;
  },
};

function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none overflow-x-hidden">
      <Markdown components={markdownComponents}>{children}</Markdown>
    </div>
  );
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

function ResultFooter({
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

function StreamingContent({ events }: { events: StreamEvent[] }) {
  const groups = useMemo(() => groupEvents(events), [events]);

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

function parseMetadataEvents(
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
    // Group consecutive same-type events (text, thinking)
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
    // If the result event from agent includes cost/duration, ensure we have a result group
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

function CompletedContent({ groups }: { groups: EventGroup[] }) {
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

function extractCopyableText(
  content: string,
  metadata: Record<string, unknown> | null,
): string {
  if (!metadata) return content;
  try {
    const parsed = metadata as {
      events?: Array<{ type: string; content: string }>;
    };
    if (!parsed.events || !Array.isArray(parsed.events)) return content;
    const textParts: string[] = [];
    for (const event of parsed.events) {
      if (event.type === "text" && event.content) {
        textParts.push(event.content);
      }
    }
    return textParts.length > 0 ? textParts.join("") : content;
  } catch {
    return content;
  }
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  if (!text) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 max-sm:opacity-100"
      title={copied ? "Copied" : "Copy message"}
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <ClipboardIcon className="size-3.5" />
      )}
    </button>
  );
}

function ForkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 max-sm:opacity-100"
      title="Fork conversation from here"
    >
      <GitForkIcon className="size-3.5" />
    </button>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 max-sm:opacity-100"
      title="Edit message"
    >
      <PencilIcon className="size-3.5" />
    </button>
  );
}

function StatusIndicator({
  status,
  onCancel,
  onRetry,
}: {
  status: string;
  onCancel?: () => void;
  onRetry?: () => void;
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
          {onRetry && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRetry}
              className="text-muted-foreground ml-auto"
            >
              <RotateCwIcon data-icon="inline-start" />
              Retry
            </Button>
          )}
        </div>
      );
    case "timed_out":
      return (
        <div className="flex items-center gap-1.5 py-1 text-xs text-amber-600 dark:text-amber-400">
          <OctagonAlertIcon className="size-3" />
          <span>Timed out</span>
          {onRetry && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRetry}
              className="text-muted-foreground ml-auto"
            >
              <RotateCwIcon data-icon="inline-start" />
              Retry
            </Button>
          )}
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
  onRetry,
  onFork,
  onEdit,
}: MessageItemProps) {
  const status = overrideStatus ?? message.status;
  const isUser = message.role === "user";
  const hasStreamEvents = streamEvents && streamEvents.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const metadataGroups = useMemo(
    () => parseMetadataEvents(message.metadata),
    [message.metadata],
  );
  const copyableText = useMemo(
    () =>
      !isUser && status === "completed"
        ? extractCopyableText(message.content, message.metadata)
        : "",
    [isUser, status, message.content, message.metadata],
  );

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(
        editRef.current.value.length,
        editRef.current.value.length,
      );
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
  }, [message.content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const submitEdit = useCallback(() => {
    if (!editContent.trim() || editContent === message.content) {
      cancelEditing();
      return;
    }
    onEdit?.(editContent.trim());
    setIsEditing(false);
  }, [editContent, message.content, onEdit, cancelEditing]);

  if (isUser) {
    return (
      <div className="group/msg flex gap-3">
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
            {!isEditing && <CopyMessageButton text={message.content} />}
            {!isEditing && onFork && <ForkButton onClick={onFork} />}
            {!isEditing && onEdit && <EditButton onClick={startEditing} />}
          </div>
          {isEditing ? (
            <div className="mt-1">
              <textarea
                ref={editRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitEdit();
                  }
                  if (e.key === "Escape") {
                    cancelEditing();
                  }
                }}
                className="border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm leading-relaxed focus:ring-1 focus:outline-none"
                rows={Math.min(10, Math.max(2, editContent.split("\n").length))}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <Button size="xs" onClick={submitEdit}>
                  Save & Re-run
                </Button>
                <Button size="xs" variant="ghost" onClick={cancelEditing}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="group/msg flex gap-3">
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
          {status === "completed" && <CopyMessageButton text={copyableText} />}
          {onFork && <ForkButton onClick={onFork} />}
        </div>

        <div className="mt-2">
          {/* Streaming content */}
          {hasStreamEvents && <StreamingContent events={streamEvents} />}

          {/* Static content for completed messages — prefer metadata events */}
          {!hasStreamEvents &&
            status === "completed" &&
            (metadataGroups ? (
              <CompletedContent groups={metadataGroups} />
            ) : (
              message.content && (
                <MarkdownContent>{message.content}</MarkdownContent>
              )
            ))}

          {/* Content + status for error/timed_out messages */}
          {!hasStreamEvents &&
            (status === "error" || status === "timed_out") &&
            message.content && (
              <p className="text-muted-foreground mt-1 text-sm italic">
                {message.content}
              </p>
            )}

          {/* Status indicator for non-completed */}
          {status !== "completed" && (
            <StatusIndicator
              status={status}
              onCancel={onCancel}
              onRetry={onRetry}
            />
          )}
        </div>
      </div>
    </div>
  );
}
