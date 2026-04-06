import { BotIcon, UserIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MarkdownContent } from "@/apps/threads/components/markdown-content";
import {
  CopyMessageButton,
  EditButton,
  extractCopyableText,
  ForkButton,
} from "@/apps/threads/components/message-actions";
import {
  EventGroupRenderer,
  parseMetadataEvents,
  StreamingContent,
} from "@/apps/threads/components/message-content-blocks";
import { StatusIndicator } from "@/apps/threads/components/status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type { EventGroup } from "@/apps/threads/components/message-content-blocks";
export { extractUsageFromMetadata } from "@/apps/threads/components/message-content-blocks";

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
              <EventGroupRenderer groups={metadataGroups} />
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
