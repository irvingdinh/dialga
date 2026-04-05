import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  MessageSquareIcon,
  PencilIcon,
  Trash2Icon,
  WifiOffIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { MessageInput } from "@/apps/threads/components/message-input";
import {
  MessageItem,
  type StreamEvent,
} from "@/apps/threads/components/message-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";

type DeleteState = "idle" | "confirming" | "deleting";

function ThreadViewSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {/* User message skeleton */}
      <div className="flex gap-3">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
      </div>
      {/* Assistant message skeleton */}
      <div className="flex gap-3">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-4 w-full max-w-80" />
          <Skeleton className="mt-1.5 h-4 w-full max-w-72" />
          <Skeleton className="mt-1.5 h-4 w-48" />
        </div>
      </div>
    </div>
  );
}

export default function ThreadViewPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");

  // Streaming state
  const [streamingEvents, setStreamingEvents] = useState<
    Map<string, StreamEvent[]>
  >(new Map());
  const [messageStatuses, setMessageStatuses] = useState<Map<string, string>>(
    new Map(),
  );
  const [machineStatus, setMachineStatus] = useState<string | null>(null);

  const {
    data: thread,
    isLoading: threadLoading,
    isError: threadError,
  } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.threads.get(threadId!),
    enabled: !!threadId,
  });

  const { data: machine } = useQuery({
    queryKey: ["machine", thread?.machine_id],
    queryFn: () => api.machines.get(thread!.machine_id),
    enabled: !!thread?.machine_id,
  });

  const {
    data: messages,
    isLoading: messagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => api.messages.list(threadId!),
    enabled: !!threadId,
  });

  // SSE for thread streaming events
  useEffect(() => {
    if (!threadId) return;

    const evtSource = new EventSource(`/api/threads/${threadId}/stream`);

    evtSource.addEventListener("message:delta", (e) => {
      try {
        const data = JSON.parse(e.data) as StreamEvent;
        setStreamingEvents((prev) => {
          const next = new Map(prev);
          const events = next.get(data.message_id) ?? [];
          next.set(data.message_id, [...events, data]);
          return next;
        });
      } catch {
        // ignore parse errors
      }
    });

    evtSource.addEventListener("message:status", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          message_id: string;
          status: string;
        };
        setMessageStatuses((prev) => {
          const next = new Map(prev);
          next.set(data.message_id, data.status);
          return next;
        });
      } catch {
        // ignore
      }
    });

    evtSource.addEventListener("message:complete", (e) => {
      try {
        const data = JSON.parse(e.data) as { message_id: string };
        // Clear streaming events for this message
        setStreamingEvents((prev) => {
          const next = new Map(prev);
          next.delete(data.message_id);
          return next;
        });
        setMessageStatuses((prev) => {
          const next = new Map(prev);
          next.delete(data.message_id);
          return next;
        });
        // Refetch messages to get final state
        queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
        queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      } catch {
        // ignore
      }
    });

    evtSource.onerror = () => {
      // SSE auto-reconnects
    };

    return () => evtSource.close();
  }, [threadId, queryClient]);

  // SSE for machine status
  useEffect(() => {
    if (!thread?.machine_id) return;

    const evtSource = new EventSource("/api/machines/stream");

    evtSource.addEventListener("machine:status", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          machine_id: string;
          status: string;
        };
        if (data.machine_id === thread.machine_id) {
          setMachineStatus(data.status);
          queryClient.invalidateQueries({
            queryKey: ["machine", thread.machine_id],
          });
        }
      } catch {
        // ignore
      }
    });

    evtSource.onerror = () => {
      // SSE auto-reconnects
    };

    return () => evtSource.close();
  }, [thread?.machine_id, queryClient]);

  // Auto-scroll to bottom on new messages or streaming events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingEvents]);

  const startEditingTitle = useCallback(() => {
    setEditTitle(thread?.title ?? "");
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [thread?.title]);

  const saveTitle = useCallback(async () => {
    if (!threadId) return;
    const trimmed = editTitle.trim();
    setIsEditingTitle(false);
    if (trimmed === (thread?.title ?? "")) return;
    try {
      await api.threads.update(threadId, {
        title: trimmed || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
    } catch {
      // revert silently
    }
  }, [threadId, editTitle, thread?.title, queryClient]);

  const cancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!threadId || !thread) return;
    setDeleteState("deleting");
    try {
      await api.threads.delete(threadId);
      queryClient.invalidateQueries({
        queryKey: ["threads", thread.machine_id],
      });
      navigate(`/machines/${thread.machine_id}/threads`);
    } catch (err) {
      setDeleteState("idle");
      const message =
        err instanceof ApiError ? err.message : "Failed to delete thread";
      toast.error(message);
    }
  }, [threadId, thread, queryClient, navigate]);

  const handleSend = useCallback(
    async (content: string, model?: string) => {
      if (!threadId) return;
      try {
        const result = await api.messages.send(threadId, { content, model });
        // Optimistically add messages to the list
        queryClient.setQueryData(
          ["messages", threadId],
          (old: Awaited<ReturnType<typeof api.messages.list>> | undefined) => [
            ...(old ?? []),
            {
              id: result.user_message.id,
              thread_id: threadId,
              role: "user" as const,
              content,
              model: null,
              status: "completed",
              metadata: null,
              started_at: null,
              completed_at: null,
              created_at: result.user_message.created_at,
            },
            {
              id: result.assistant_message.id,
              thread_id: threadId,
              role: "assistant" as const,
              content: "",
              model: result.assistant_message.model,
              status: result.assistant_message.status,
              metadata: null,
              started_at: null,
              completed_at: null,
              created_at: result.assistant_message.created_at,
            },
          ],
        );
        // Also update thread title if it was empty
        queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to send message";
        toast.error(message);
      }
    },
    [threadId, queryClient],
  );

  const handleCancel = useCallback(
    async (messageId: string) => {
      try {
        await api.messages.cancel(messageId);
        // Clear streaming events
        setStreamingEvents((prev) => {
          const next = new Map(prev);
          next.delete(messageId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to cancel";
        toast.error(message);
      }
    },
    [threadId, queryClient],
  );

  const isOffline =
    machineStatus === "offline" ||
    (!machineStatus && machine?.status === "offline");

  const isPageLoading = threadLoading || messagesLoading;
  const isPageError = threadError || messagesError;

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (thread?.machine_id) {
                navigate(`/machines/${thread.machine_id}/threads`);
              } else {
                navigate(-1);
              }
            }}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            {threadLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") cancelEditingTitle();
                }}
                onBlur={saveTitle}
                className="bg-muted w-full rounded-md border px-2 py-0.5 text-sm font-semibold tracking-tight outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingTitle}
                className="group flex max-w-full items-center gap-1.5"
              >
                <h1 className="truncate text-sm font-semibold tracking-tight">
                  {thread?.title ?? "New thread"}
                </h1>
                <PencilIcon className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
            {thread?.workspace_name && (
              <p className="text-muted-foreground truncate text-[11px]">
                {thread.workspace_name}
              </p>
            )}
          </div>
          {!threadLoading && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleteState("confirming")}
              className="text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Banner */}
      {deleteState !== "idle" && (
        <div className="border-b px-4 py-2">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-sm text-red-800 dark:text-red-400">
              Delete this thread and all its messages?
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteState("idle")}
                disabled={deleteState === "deleting"}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteState === "deleting"}
              >
                {deleteState === "deleting" ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div className="border-b px-4 py-2">
          <div className="mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
            <WifiOffIcon className="size-3.5 shrink-0" />
            <span>
              Machine is offline. Messages will be processed when it reconnects.
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg">
          {/* Loading */}
          {isPageLoading && <ThreadViewSkeleton />}

          {/* Error */}
          {isPageError && !isPageLoading && (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <AlertCircleIcon className="text-muted-foreground/40 mb-3 size-8" />
              <p className="text-muted-foreground text-sm">
                Failed to load thread.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetchMessages()}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {messages && messages.length === 0 && !isPageLoading && (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <MessageSquareIcon className="text-muted-foreground/40 mb-3 size-8" />
              <p className="text-muted-foreground text-sm">
                No messages yet. Send one to get started.
              </p>
            </div>
          )}

          {/* Message list */}
          {messages && messages.length > 0 && (
            <div className="flex flex-col gap-6 px-4 py-4">
              {messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  streamEvents={streamingEvents.get(msg.id)}
                  overrideStatus={messageStatuses.get(msg.id)}
                  onCancel={
                    msg.role === "assistant" &&
                    (messageStatuses.get(msg.id) ?? msg.status) !==
                      "completed" &&
                    (messageStatuses.get(msg.id) ?? msg.status) !==
                      "cancelled" &&
                    (messageStatuses.get(msg.id) ?? msg.status) !== "error" &&
                    (messageStatuses.get(msg.id) ?? msg.status) !== "timed_out"
                      ? () => handleCancel(msg.id)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <MessageInput onSend={handleSend} />
    </div>
  );
}
