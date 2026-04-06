import type { QueryClient } from "@tanstack/react-query";
import { type MutableRefObject, useEffect, useMemo, useState } from "react";

import type { StreamEvent } from "@/apps/threads/components/message-item";
import { useMachineStatusEvent } from "@/lib/machine-status";

interface Message {
  id: string;
  role: string;
  status: string;
  metadata: unknown;
}

export function useThreadStreaming(
  threadId: string | undefined,
  machineId: string | undefined,
  queryClient: QueryClient,
  markAsRead: (threadId: string) => void,
  isNearBottomRef: MutableRefObject<boolean>,
  messages: Message[],
) {
  const [streamingEvents, setStreamingEvents] = useState<
    Map<string, StreamEvent[]>
  >(new Map());
  const [messageStatuses, setMessageStatuses] = useState<Map<string, string>>(
    new Map(),
  );
  const [machineStatus, setMachineStatus] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

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
        if (!isNearBottomRef.current) {
          setHasNewMessages(true);
        }
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
        queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
        queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
        queryClient.invalidateQueries({
          queryKey: ["thread-usage", threadId],
        });
        if (threadId) markAsRead(threadId);
      } catch {
        // ignore
      }
    });

    evtSource.onerror = () => {
      // SSE auto-reconnects
    };

    return () => evtSource.close();
  }, [threadId, queryClient, markAsRead, isNearBottomRef]);

  // Shared SSE for machine status
  useMachineStatusEvent((data) => {
    if (data.machine_id === machineId) {
      setMachineStatus(data.status);
      queryClient.invalidateQueries({
        queryKey: ["machine", machineId],
      });
    }
  });

  // Extract partial metadata events for running messages (page refresh recovery)
  const partialEvents = useMemo(() => {
    const result = new Map<string, StreamEvent[]>();
    for (const msg of messages) {
      if (
        msg.role === "assistant" &&
        msg.status === "running" &&
        msg.metadata
      ) {
        try {
          const meta =
            typeof msg.metadata === "string"
              ? JSON.parse(msg.metadata)
              : msg.metadata;
          if (meta?.partial && Array.isArray(meta.events)) {
            const seeded: StreamEvent[] = meta.events.map(
              (evt: { type: string; content: string }) => ({
                message_id: msg.id,
                type: evt.type,
                content: evt.content,
              }),
            );
            if (seeded.length > 0) {
              result.set(msg.id, seeded);
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return result;
  }, [messages]);

  // Merge: SSE streaming events take priority; fall back to partial metadata
  const mergedStreamingEvents = useMemo(() => {
    const merged = new Map<string, StreamEvent[]>(partialEvents);
    for (const [msgId, events] of streamingEvents) {
      merged.set(msgId, events);
    }
    return merged;
  }, [partialEvents, streamingEvents]);

  return {
    streamingEvents,
    setStreamingEvents,
    messageStatuses,
    machineStatus,
    mergedStreamingEvents,
    hasNewMessages,
    setHasNewMessages,
  };
}
