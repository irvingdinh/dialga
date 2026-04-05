import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, WifiOffIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { MessageInput } from "@/apps/threads/components/message-input";
import {
  MessageItem,
  type StreamEvent,
} from "@/apps/threads/components/message-item";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function ThreadViewPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Streaming state
  const [streamingEvents, setStreamingEvents] = useState<
    Map<string, StreamEvent[]>
  >(new Map());
  const [messageStatuses, setMessageStatuses] = useState<Map<string, string>>(
    new Map(),
  );
  const [machineStatus, setMachineStatus] = useState<string | null>(null);

  const { data: thread } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.threads.get(threadId!),
    enabled: !!threadId,
  });

  const { data: machine } = useQuery({
    queryKey: ["machine", thread?.machine_id],
    queryFn: () => api.machines.get(thread!.machine_id),
    enabled: !!thread?.machine_id,
  });

  const { data: messages } = useQuery({
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
      } catch {
        // TODO: show error toast
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
      } catch {
        // ignore
      }
    },
    [threadId, queryClient],
  );

  const isOffline =
    machineStatus === "offline" ||
    (!machineStatus && machine?.status === "offline");

  return (
    <div className="flex h-screen flex-col">
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
            <h1 className="truncate text-sm font-semibold tracking-tight">
              {thread?.title ?? "New thread"}
            </h1>
            {thread?.workspace_name && (
              <p className="text-muted-foreground truncate text-[11px]">
                {thread.workspace_name}
              </p>
            )}
          </div>
        </div>
      </div>

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
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex flex-col gap-6">
            {messages?.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                streamEvents={streamingEvents.get(msg.id)}
                overrideStatus={messageStatuses.get(msg.id)}
                onCancel={
                  msg.role === "assistant" &&
                  (messageStatuses.get(msg.id) ?? msg.status) !== "completed" &&
                  (messageStatuses.get(msg.id) ?? msg.status) !== "cancelled" &&
                  (messageStatuses.get(msg.id) ?? msg.status) !== "error" &&
                  (messageStatuses.get(msg.id) ?? msg.status) !== "timed_out"
                    ? () => handleCancel(msg.id)
                    : undefined
                }
              />
            ))}
          </div>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <MessageInput onSend={handleSend} />
    </div>
  );
}
