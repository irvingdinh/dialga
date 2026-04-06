import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowDownIcon,
  ChevronUpIcon,
  LoaderIcon,
  MessageSquareIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { FileBrowser } from "@/apps/threads/components/file-browser";
import { GitPanel } from "@/apps/threads/components/git-panel";
import { MessageInput } from "@/apps/threads/components/message-input";
import { MessageItem } from "@/apps/threads/components/message-item";
import { ThreadBanners } from "@/apps/threads/components/thread-banners";
import { ThreadSidebar } from "@/apps/threads/components/thread-sidebar";
import { ThreadUsageBar } from "@/apps/threads/components/thread-usage-bar";
import { ThreadViewHeader } from "@/apps/threads/components/thread-view-header";
import { WorkspaceSelector } from "@/apps/threads/components/workspace-selector";
import { useThreadStreaming } from "@/apps/threads/hooks/use-thread-streaming";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useUnread } from "@/lib/unread";
import { usePageShortcuts } from "@/lib/use-page-shortcuts";

type DeleteState = "idle" | "confirming" | "deleting";

function ThreadViewSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      <div className="flex gap-3">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
      </div>
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

  // Panel state
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);
  const [isGitPanelOpen, setIsGitPanelOpen] = useState(false);
  const [isWorkspaceSelectorOpen, setIsWorkspaceSelectorOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);

  // Scroll-to-bottom state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { markAsRead } = useUnread();

  // --- Queries ---

  const {
    data: thread,
    isLoading: threadLoading,
    isError: threadError,
  } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.threads.get(threadId!),
    enabled: !!threadId,
  });

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

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["messages-search", threadId, searchQuery],
    queryFn: () => api.messages.list(threadId!, { q: searchQuery }),
    enabled: !!threadId && !!searchQuery,
  });

  const { data: usageData } = useQuery({
    queryKey: ["thread-usage", threadId],
    queryFn: () => api.threads.usage(threadId!),
    enabled: !!threadId && isUsageOpen,
    staleTime: 30_000,
  });

  // --- Derived state ---

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

  const messages = useMemo(
    () =>
      messagesData?.pages
        .slice()
        .reverse()
        .flatMap((p) => p.messages) ?? [],
    [messagesData],
  );

  // --- Streaming ---

  const {
    setStreamingEvents,
    messageStatuses,
    machineStatus,
    mergedStreamingEvents,
    hasNewMessages,
    setHasNewMessages,
  } = useThreadStreaming(
    threadId,
    thread?.machine_id,
    queryClient,
    markAsRead,
    isNearBottomRef,
    messages,
  );

  const isPanelOpen = isFileBrowserOpen || isGitPanelOpen;
  const isSearchActive = isSearchOpen && !!searchQuery;
  const displayMessages = isSearchActive
    ? (searchData?.messages ?? [])
    : messages;

  // --- Scroll tracking ---

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
  }, [setHasNewMessages]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, mergedStreamingEvents]);

  // --- Callbacks ---

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
      await api.threads.update(threadId, { title: trimmed || undefined });
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
        // Replace all messages: keep messages up to and including the edited one,
        // then append the new assistant message
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
            // Update edited message content
            kept[editIdx] = { ...kept[editIdx], content };
            // Append new assistant message
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
        // Clear any stale streaming state for removed messages
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

  const handleLoadOlder = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const prevHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;
    await fetchNextPage();
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
  }, [setHasNewMessages]);

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

  // --- Keyboard shortcuts ---

  usePageShortcuts(
    useMemo(
      () => [
        {
          key: "/",
          handler: (e: KeyboardEvent) => {
            e.preventDefault();
            toggleSearch();
          },
        },
        {
          key: "e",
          handler: (e: KeyboardEvent) => {
            if (!thread?.working_directory) return;
            e.preventDefault();
            setIsFileBrowserOpen((v) => !v);
            setIsGitPanelOpen(false);
          },
        },
        {
          key: "g",
          handler: (e: KeyboardEvent) => {
            if (!thread?.working_directory) return;
            e.preventDefault();
            setIsGitPanelOpen((v) => !v);
            setIsFileBrowserOpen(false);
          },
        },
        {
          key: "Escape",
          allowInInput: true,
          handler: (e: KeyboardEvent) => {
            if (isSearchOpen) {
              e.preventDefault();
              toggleSearch();
            } else if (isFileBrowserOpen) {
              e.preventDefault();
              setIsFileBrowserOpen(false);
            } else if (isGitPanelOpen) {
              e.preventDefault();
              setIsGitPanelOpen(false);
            } else if (isUsageOpen) {
              e.preventDefault();
              setIsUsageOpen(false);
            } else if (deleteState === "confirming") {
              e.preventDefault();
              setDeleteState("idle");
            }
          },
        },
      ],
      [
        thread?.working_directory,
        isSearchOpen,
        isFileBrowserOpen,
        isGitPanelOpen,
        isUsageOpen,
        deleteState,
        toggleSearch,
      ],
    ),
  );

  // --- Computed flags ---

  const isOffline =
    machineStatus === "offline" ||
    (!machineStatus && machine?.status === "offline");
  const isPageLoading = threadLoading || messagesLoading;
  const isPageError = threadError || messagesError;

  // --- Render ---

  return (
    <div className="flex h-dvh">
      {thread?.machine_id && (
        <ThreadSidebar
          machineId={thread.machine_id}
          currentThreadId={threadId!}
          machineName={machine?.name}
          machineStatus={machineStatus ?? machine?.status}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ThreadViewHeader
          thread={thread}
          threadLoading={threadLoading}
          isEditingTitle={isEditingTitle}
          editTitle={editTitle}
          titleInputRef={titleInputRef}
          onStartEditTitle={startEditingTitle}
          onSaveTitle={saveTitle}
          onCancelEditTitle={cancelEditingTitle}
          onEditTitleChange={setEditTitle}
          onBack={() => {
            if (thread?.machine_id) {
              navigate(`/machines/${thread.machine_id}/threads`);
            } else {
              navigate(-1);
            }
          }}
          onOpenWorkspaceSelector={() => setIsWorkspaceSelectorOpen(true)}
          isFileBrowserOpen={isFileBrowserOpen}
          isGitPanelOpen={isGitPanelOpen}
          onToggleFileBrowser={() => {
            setIsFileBrowserOpen((v) => !v);
            setIsGitPanelOpen(false);
          }}
          onToggleGitPanel={() => {
            setIsGitPanelOpen((v) => !v);
            setIsFileBrowserOpen(false);
          }}
          isSearchOpen={isSearchOpen}
          onToggleSearch={toggleSearch}
          isUsageOpen={isUsageOpen}
          onToggleUsage={() => setIsUsageOpen((v) => !v)}
          onExport={handleExport}
          onTogglePin={handleTogglePin}
          onToggleArchive={handleToggleArchive}
          onStartDelete={() => setDeleteState("confirming")}
        />

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

        <ThreadUsageBar isOpen={isUsageOpen} usageData={usageData} />

        <ThreadBanners
          deleteState={deleteState}
          onCancelDelete={() => setDeleteState("idle")}
          onConfirmDelete={handleDelete}
          isArchived={thread?.status === "archived"}
          onUnarchive={handleToggleArchive}
          isOffline={isOffline}
        />

        {/* Main content area — split-pane on desktop */}
        <div className="flex min-h-0 flex-1">
          {/* Messages column */}
          <div
            className={`flex min-w-0 flex-1 flex-col ${isPanelOpen ? "hidden lg:flex" : ""}`}
          >
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-lg">
                {isPageLoading && <ThreadViewSkeleton />}

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

                {displayMessages.length > 0 && (
                  <div className="flex flex-col gap-6 px-4 py-4">
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
                              : mergedStreamingEvents.get(msg.id)
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
                          onEdit={
                            !isSearchActive && msg.role === "user"
                              ? (content: string) => handleEdit(msg.id, content)
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

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

            <MessageInput onSend={handleSend} />
          </div>

          {/* Side panel: file browser or git */}
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
    </div>
  );
}
