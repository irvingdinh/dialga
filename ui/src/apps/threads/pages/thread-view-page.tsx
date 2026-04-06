import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  ChevronUpIcon,
  ClockIcon,
  CoinsIcon,
  DownloadIcon,
  FolderIcon,
  FolderOpenIcon,
  GitBranchIcon,
  HashIcon,
  LoaderIcon,
  MessageSquareIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  Trash2Icon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { FileBrowser } from "@/apps/threads/components/file-browser";
import { GitPanel } from "@/apps/threads/components/git-panel";
import { MessageInput } from "@/apps/threads/components/message-input";
import {
  MessageItem,
  type StreamEvent,
} from "@/apps/threads/components/message-item";
import { ThreadSidebar } from "@/apps/threads/components/thread-sidebar";
import { WorkspaceSelector } from "@/apps/threads/components/workspace-selector";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useUnread } from "@/lib/unread";

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // File browser state
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  // Git panel state
  const [isGitPanelOpen, setIsGitPanelOpen] = useState(false);

  // Workspace selector state
  const [isWorkspaceSelectorOpen, setIsWorkspaceSelectorOpen] = useState(false);

  // Scroll-to-bottom state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const isNearBottomRef = useRef(true);

  // Usage stats state
  const [isUsageOpen, setIsUsageOpen] = useState(false);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { markAsRead } = useUnread();

  const {
    data: thread,
    isLoading: threadLoading,
    isError: threadError,
  } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.threads.get(threadId!),
    enabled: !!threadId,
  });

  // Mark thread as read on mount and when threadId changes
  useEffect(() => {
    if (threadId) markAsRead(threadId);
  }, [threadId, markAsRead]);

  const { data: machine } = useQuery({
    queryKey: ["machine", thread?.machine_id],
    queryFn: () => api.machines.get(thread!.machine_id),
    enabled: !!thread?.machine_id,
  });

  type MessagesPage = Awaited<ReturnType<typeof api.messages.list>>;

  const {
    data: messagesData,
    isLoading: messagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["messages", threadId],
    queryFn: ({ pageParam }) =>
      api.messages.list(threadId!, {
        limit: 50,
        before: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.has_more || lastPage.messages.length === 0) return null;
      return lastPage.messages[0].id;
    },
    enabled: !!threadId,
  });

  // Search query — separate from paginated messages
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["messages-search", threadId, searchQuery],
    queryFn: () => api.messages.list(threadId!, { q: searchQuery }),
    enabled: !!threadId && !!searchQuery,
  });

  // Thread usage stats
  const { data: usageData } = useQuery({
    queryKey: ["thread-usage", threadId],
    queryFn: () => api.threads.usage(threadId!),
    enabled: !!threadId && isUsageOpen,
    staleTime: 30_000,
  });

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  // Flatten pages in chronological order (older pages last in array → reverse)
  const messages = useMemo(
    () =>
      messagesData?.pages
        .slice()
        .reverse()
        .flatMap((p) => p.messages) ?? [],
    [messagesData],
  );

  const isPanelOpen = isFileBrowserOpen || isGitPanelOpen;
  const isSearchActive = isSearchOpen && !!searchQuery;
  const displayMessages = isSearchActive
    ? (searchData?.messages ?? [])
    : messages;

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
        // Refetch messages and usage to get final state
        queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
        queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
        queryClient.invalidateQueries({
          queryKey: ["thread-usage", threadId],
        });
        // Keep thread marked as read while viewing
        if (threadId) markAsRead(threadId);
      } catch {
        // ignore
      }
    });

    evtSource.onerror = () => {
      // SSE auto-reconnects
    };

    return () => evtSource.close();
  }, [threadId, queryClient, markAsRead]);

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

  // Track scroll position — is user near the bottom?
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 150;
      const nearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        threshold;
      isNearBottomRef.current = nearBottom;
      setIsNearBottom(nearBottom);
      if (nearBottom) setHasNewMessages(false);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only when user is already near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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

  const handleSend = useCallback(
    async (content: string, model?: string) => {
      if (!threadId) return;
      try {
        const result = await api.messages.send(threadId, { content, model });
        // Optimistically add messages to the newest page (pages[0])
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

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!threadId) return;
      try {
        const result = await api.messages.retry(messageId);
        // Optimistically add new assistant message to the newest page
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
        queryClient.invalidateQueries({
          queryKey: ["threads"],
        });
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

  const handleLoadOlder = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const prevHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;
    await fetchNextPage();
    // Preserve scroll position after older messages are prepended
    requestAnimationFrame(() => {
      const newHeight = container.scrollHeight;
      container.scrollTop = prevScrollTop + (newHeight - prevHeight);
    });
  }, [fetchNextPage]);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        setSearchInput("");
        setSearchQuery("");
      }
      return !prev;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setHasNewMessages(false);
  }, []);

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

  const isOffline =
    machineStatus === "offline" ||
    (!machineStatus && machine?.status === "offline");

  const isPageLoading = threadLoading || messagesLoading;
  const isPageError = threadError || messagesError;

  return (
    <div className="flex h-dvh">
      {/* Desktop sidebar — thread list */}
      {thread?.machine_id && (
        <ThreadSidebar
          machineId={thread.machine_id}
          currentThreadId={threadId!}
          machineName={machine?.name}
          machineStatus={machineStatus ?? machine?.status}
        />
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
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
              {!threadLoading && (
                <button
                  type="button"
                  onClick={() => setIsWorkspaceSelectorOpen(true)}
                  className="text-muted-foreground group flex max-w-full items-center gap-1 truncate text-[11px] hover:underline"
                >
                  <FolderIcon className="size-2.5 shrink-0" />
                  <span className="truncate">
                    {thread?.workspace_name ?? "No workspace"}
                  </span>
                </button>
              )}
            </div>
            {!threadLoading && (
              <div className="flex shrink-0 items-center gap-0.5">
                {thread?.working_directory && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setIsFileBrowserOpen((v) => !v);
                        setIsGitPanelOpen(false);
                      }}
                      className={`shrink-0 ${isFileBrowserOpen ? "text-foreground" : "text-muted-foreground"}`}
                      title="Browse workspace files"
                    >
                      <FolderOpenIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setIsGitPanelOpen((v) => !v);
                        setIsFileBrowserOpen(false);
                      }}
                      className={`shrink-0 ${isGitPanelOpen ? "text-foreground" : "text-muted-foreground"}`}
                      title="Git changes"
                    >
                      <GitBranchIcon className="size-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleSearch}
                  className={`shrink-0 ${isSearchOpen ? "text-foreground" : "text-muted-foreground"}`}
                  title="Search messages"
                >
                  <SearchIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsUsageOpen((v) => !v)}
                  className={`shrink-0 ${isUsageOpen ? "text-foreground" : "text-muted-foreground"}`}
                  title="Thread usage stats"
                >
                  <BarChart3Icon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleExport}
                  className="text-muted-foreground shrink-0"
                  title="Export as Markdown"
                >
                  <DownloadIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleTogglePin}
                  className={`shrink-0 ${thread?.is_pinned ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"}`}
                  title={thread?.is_pinned ? "Unpin thread" : "Pin thread"}
                >
                  {thread?.is_pinned ? (
                    <PinOffIcon className="size-4" />
                  ) : (
                    <PinIcon className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleToggleArchive}
                  className="text-muted-foreground shrink-0"
                  title={
                    thread?.status === "archived"
                      ? "Unarchive thread"
                      : "Archive thread"
                  }
                >
                  {thread?.status === "archived" ? (
                    <ArchiveRestoreIcon className="size-4" />
                  ) : (
                    <ArchiveIcon className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteState("confirming")}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {isSearchOpen && (
          <div className="border-b px-4 py-2">
            <div className="mx-auto flex max-w-lg items-center gap-2">
              <SearchIcon className="text-muted-foreground size-4 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") toggleSearch();
                }}
                placeholder="Search messages..."
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
              {searchLoading && searchQuery && (
                <LoaderIcon className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
              )}
            </div>
          </div>
        )}

        {/* Usage Stats Bar */}
        {isUsageOpen && (
          <div className="border-b px-4 py-2">
            <div className="mx-auto max-w-lg">
              {usageData && usageData.message_count > 0 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {usageData.total_cost_usd > 0 && (
                    <span className="text-foreground flex items-center gap-1 font-medium">
                      <CoinsIcon className="size-3 shrink-0" />$
                      {usageData.total_cost_usd.toFixed(4)}
                    </span>
                  )}
                  {(usageData.total_input_tokens > 0 ||
                    usageData.total_output_tokens > 0) && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <HashIcon className="size-3 shrink-0" />
                      {(
                        usageData.total_input_tokens +
                        usageData.total_output_tokens
                      ).toLocaleString()}{" "}
                      tokens
                      <span className="opacity-60">
                        ({usageData.total_input_tokens.toLocaleString()} in /{" "}
                        {usageData.total_output_tokens.toLocaleString()} out)
                      </span>
                    </span>
                  )}
                  {usageData.total_duration_ms > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ClockIcon className="size-3 shrink-0" />
                      {usageData.total_duration_ms >= 60000
                        ? `${(usageData.total_duration_ms / 60000).toFixed(1)}m`
                        : `${(usageData.total_duration_ms / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  {usageData.message_count > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MessageSquareIcon className="size-3 shrink-0" />
                      {usageData.message_count} response
                      {usageData.message_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  {Object.keys(usageData.models).length > 0 && (
                    <span className="text-muted-foreground opacity-60">
                      {Object.entries(usageData.models)
                        .map(([model, count]) =>
                          count > 1 ? `${model} ×${count}` : model,
                        )
                        .join(", ")}
                    </span>
                  )}
                </div>
              ) : usageData ? (
                <p className="text-muted-foreground text-xs">
                  No usage data yet.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">Loading...</p>
              )}
            </div>
          </div>
        )}

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

        {/* Archived Banner */}
        {thread?.status === "archived" && (
          <div className="border-b px-4 py-2">
            <div className="text-muted-foreground mx-auto flex max-w-lg items-center justify-between rounded-xl border px-3 py-2 text-xs">
              <span className="flex items-center gap-2">
                <ArchiveIcon className="size-3.5 shrink-0" />
                This thread is archived.
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleArchive}
                className="h-auto px-2 py-0.5 text-xs"
              >
                Unarchive
              </Button>
            </div>
          </div>
        )}

        {/* Offline Banner */}
        {isOffline && (
          <div className="border-b px-4 py-2">
            <div className="mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
              <WifiOffIcon className="size-3.5 shrink-0" />
              <span>
                Machine is offline. Messages will be processed when it
                reconnects.
              </span>
            </div>
          </div>
        )}

        {/* Main content area — split-pane on desktop */}
        <div className="flex min-h-0 flex-1">
          {/* Messages column: hidden on mobile when panel open, always visible on desktop */}
          <div
            className={`flex min-w-0 flex-1 flex-col ${isPanelOpen ? "hidden lg:flex" : ""}`}
          >
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
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
                {displayMessages.length === 0 &&
                  !isPageLoading &&
                  !isPageError && (
                    <div className="flex flex-col items-center px-4 py-16 text-center">
                      {isSearchActive ? (
                        <>
                          <SearchIcon className="text-muted-foreground/40 mb-3 size-8" />
                          <p className="text-muted-foreground text-sm">
                            No messages match &ldquo;{searchQuery}&rdquo;
                          </p>
                        </>
                      ) : (
                        <>
                          <MessageSquareIcon className="text-muted-foreground/40 mb-3 size-8" />
                          <p className="text-muted-foreground text-sm">
                            No messages yet. Send one to get started.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                {/* Search result count */}
                {isSearchActive &&
                  searchData &&
                  searchData.messages.length > 0 && (
                    <div className="px-4 pt-3 pb-0">
                      <p className="text-muted-foreground text-xs">
                        {searchData.messages.length} result
                        {searchData.messages.length !== 1 ? "s" : ""} for
                        &ldquo;
                        {searchQuery}&rdquo;
                      </p>
                    </div>
                  )}

                {/* Message list */}
                {displayMessages.length > 0 && (
                  <div className="flex flex-col gap-6 px-4 py-4">
                    {/* Load older button — only in normal (non-search) mode */}
                    {!isSearchActive && hasNextPage && (
                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLoadOlder}
                          disabled={isFetchingNextPage}
                          className="text-muted-foreground gap-1.5 text-xs"
                        >
                          {isFetchingNextPage ? (
                            <LoaderIcon className="size-3.5 animate-spin" />
                          ) : (
                            <ChevronUpIcon className="size-3.5" />
                          )}
                          {isFetchingNextPage
                            ? "Loading..."
                            : "Load older messages"}
                        </Button>
                      </div>
                    )}

                    {displayMessages.map((msg) => {
                      const effectiveStatus =
                        messageStatuses.get(msg.id) ?? msg.status;
                      return (
                        <MessageItem
                          key={msg.id}
                          message={msg}
                          streamEvents={
                            isSearchActive
                              ? undefined
                              : streamingEvents.get(msg.id)
                          }
                          overrideStatus={
                            isSearchActive
                              ? undefined
                              : messageStatuses.get(msg.id)
                          }
                          onCancel={
                            !isSearchActive &&
                            msg.role === "assistant" &&
                            effectiveStatus !== "completed" &&
                            effectiveStatus !== "cancelled" &&
                            effectiveStatus !== "error" &&
                            effectiveStatus !== "timed_out"
                              ? () => handleCancel(msg.id)
                              : undefined
                          }
                          onRetry={
                            !isSearchActive &&
                            msg.role === "assistant" &&
                            (effectiveStatus === "error" ||
                              effectiveStatus === "timed_out")
                              ? () => handleRetry(msg.id)
                              : undefined
                          }
                          onFork={
                            !isSearchActive
                              ? () => handleFork(msg.id)
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Scroll-to-bottom floating button */}
              {!isNearBottom && !isSearchActive && (
                <div className="pointer-events-none sticky bottom-3 flex justify-center">
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    className="bg-background pointer-events-auto relative flex size-8 items-center justify-center rounded-full border shadow-md transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    title="Scroll to bottom"
                  >
                    <ArrowDownIcon className="text-muted-foreground size-4" />
                    {hasNewMessages && (
                      <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-blue-500" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Input */}
            <MessageInput onSend={handleSend} />
          </div>

          {/* Side panel: file browser or git — on desktop appears beside messages, on mobile replaces them */}
          {isPanelOpen && (
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:border-l">
              {isFileBrowserOpen &&
                thread?.machine_id &&
                thread?.working_directory && (
                  <FileBrowser
                    machineId={thread.machine_id}
                    rootPath={thread.working_directory}
                    onClose={() => setIsFileBrowserOpen(false)}
                  />
                )}
              {isGitPanelOpen &&
                thread?.machine_id &&
                thread?.working_directory && (
                  <GitPanel
                    machineId={thread.machine_id}
                    workingDirectory={thread.working_directory}
                    onClose={() => setIsGitPanelOpen(false)}
                  />
                )}
            </div>
          )}
        </div>

        {/* Workspace Selector Dialog */}
        {thread && (
          <WorkspaceSelector
            machineId={thread.machine_id}
            threadId={thread.id}
            currentWorkspaceId={thread.workspace_id}
            open={isWorkspaceSelectorOpen}
            onOpenChange={setIsWorkspaceSelectorOpen}
            onChanged={() => {
              setIsFileBrowserOpen(false);
              setIsGitPanelOpen(false);
              queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
              queryClient.invalidateQueries({
                queryKey: ["threads", thread.machine_id],
              });
            }}
          />
        )}
      </div>
      {/* end main content */}
    </div>
  );
}
