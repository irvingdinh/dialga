import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { NavigateFunction } from "react-router";
import { toast } from "sonner";

import type { StreamEvent } from "@/apps/threads/components/message-item";
import { api, ApiError } from "@/lib/api";

type MessagesPage = Awaited<ReturnType<typeof api.messages.list>>;

interface ThreadData {
  id: string;
  machine_id: string;
  title?: string | null;
  status?: string;
  is_pinned?: boolean;
  working_directory?: string | null;
}

interface UseThreadCallbacksParams {
  threadId: string | undefined;
  thread: ThreadData | undefined;
  queryClient: QueryClient;
  navigate: NavigateFunction;
  setStreamingEvents: React.Dispatch<
    React.SetStateAction<Map<string, StreamEvent[]>>
  >;
}

export function useThreadCallbacks({
  threadId,
  thread,
  queryClient,
  navigate,
  setStreamingEvents,
}: UseThreadCallbacksParams) {
  const handleSend = useCallback(
    async (content: string, model?: string) => {
      if (!threadId) return;
      try {
        const result = await api.messages.send(threadId, { content, model });
        queryClient.setQueryData(
          ["messages", threadId],
          (old: InfiniteData<MessagesPage> | undefined) => {
            if (!old) return old;
            const pages = [...old.pages];
            pages[0] = {
              ...pages[0],
              messages: [
                ...pages[0].messages,
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
            };
            return { ...old, pages };
          },
        );
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
    [threadId, queryClient, setStreamingEvents],
  );

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!threadId) return;
      try {
        const result = await api.messages.retry(messageId);
        queryClient.setQueryData(
          ["messages", threadId],
          (old: InfiniteData<MessagesPage> | undefined) => {
            if (!old) return old;
            const pages = [...old.pages];
            pages[0] = {
              ...pages[0],
              messages: [
                ...pages[0].messages,
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
            };
            return { ...old, pages };
          },
        );
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to retry";
        toast.error(message);
      }
    },
    [threadId, queryClient],
  );

  const handleFork = useCallback(
    async (messageId: string) => {
      if (!threadId) return;
      try {
        const forked = await api.threads.fork(threadId, messageId);
        queryClient.invalidateQueries({ queryKey: ["threads"] });
        toast.success("Thread forked");
        navigate(`/threads/${forked.id}`);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to fork thread";
        toast.error(message);
      }
    },
    [threadId, queryClient, navigate],
  );

  const handleEdit = useCallback(
    async (messageId: string, content: string) => {
      if (!threadId) return;
      try {
        const result = await api.messages.edit(messageId, content);
        queryClient.setQueryData(
          ["messages", threadId],
          (old: InfiniteData<MessagesPage> | undefined) => {
            if (!old) return old;
            const allMessages = old.pages
              .slice()
              .reverse()
              .flatMap((p) => p.messages);
            const editIdx = allMessages.findIndex((m) => m.id === messageId);
            if (editIdx === -1) return old;
            const kept = allMessages.slice(0, editIdx + 1);
            kept[editIdx] = { ...kept[editIdx], content };
            kept.push({
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
            });
            return {
              pages: [{ messages: kept, has_more: false }],
              pageParams: [undefined],
            };
          },
        );
        setStreamingEvents(new Map());
        queryClient.invalidateQueries({ queryKey: ["threads"] });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to edit message";
        toast.error(message);
      }
    },
    [threadId, queryClient, setStreamingEvents],
  );

  const handleDelete = useCallback(async () => {
    if (!threadId || !thread) return;
    try {
      await api.threads.delete(threadId);
      queryClient.invalidateQueries({
        queryKey: ["threads", thread.machine_id],
      });
      navigate(`/machines/${thread.machine_id}/threads`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete thread";
      toast.error(message);
      throw err;
    }
  }, [threadId, thread, queryClient, navigate]);

  const handleToggleArchive = useCallback(async () => {
    if (!threadId || !thread) return;
    const newStatus = thread.status === "archived" ? "active" : "archived";
    try {
      await api.threads.update(threadId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({
        queryKey: ["threads", thread.machine_id],
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to update thread status";
      toast.error(message);
    }
  }, [threadId, thread, queryClient]);

  const handleTogglePin = useCallback(async () => {
    if (!threadId || !thread) return;
    try {
      await api.threads.update(threadId, { is_pinned: !thread.is_pinned });
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({
        queryKey: ["threads", thread.machine_id],
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update thread";
      toast.error(message);
    }
  }, [threadId, thread, queryClient]);

  const handleExport = useCallback(async () => {
    if (!threadId) return;
    try {
      await api.threads.exportMarkdown(threadId);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to export thread";
      toast.error(message);
    }
  }, [threadId]);

  return {
    handleSend,
    handleCancel,
    handleRetry,
    handleFork,
    handleEdit,
    handleDelete,
    handleToggleArchive,
    handleTogglePin,
    handleExport,
  };
}
