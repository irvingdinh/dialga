import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { FileBrowser } from "@/apps/threads/components/file-browser";
import { GitPanel } from "@/apps/threads/components/git-panel";
import { MessageInput } from "@/apps/threads/components/message-input";
import { ShareThreadDialog } from "@/apps/threads/components/share-thread-dialog";
import { ThreadBanners } from "@/apps/threads/components/thread-banners";
import {
  resolveModel,
  ThreadContextBar,
} from "@/apps/threads/components/thread-context-bar";
import { ThreadMessageList } from "@/apps/threads/components/thread-message-list";
import { ThreadSearchBar } from "@/apps/threads/components/thread-search-bar";
import { ThreadSidebar } from "@/apps/threads/components/thread-sidebar";
import { ThreadUsageBar } from "@/apps/threads/components/thread-usage-bar";
import { ThreadViewHeader } from "@/apps/threads/components/thread-view-header";
import { WorkspaceSelector } from "@/apps/threads/components/workspace-selector";
import { useThreadCallbacks } from "@/apps/threads/hooks/use-thread-callbacks";
import { useThreadStreaming } from "@/apps/threads/hooks/use-thread-streaming";
import { api } from "@/lib/api";
import { useUnread } from "@/lib/unread";
import { usePageShortcuts } from "@/lib/use-page-shortcuts";

type DeleteState = "idle" | "confirming" | "deleting";

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
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // Scroll-to-bottom state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Starred filter state
  const [isStarredFilterActive, setIsStarredFilterActive] = useState(false);

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

  const { data: starredData } = useQuery({
    queryKey: ["messages-starred", threadId],
    queryFn: () => api.messages.list(threadId!, { starred: true }),
    enabled: !!threadId && isStarredFilterActive,
  });

  const { data: usageData } = useQuery({
    queryKey: ["thread-usage", threadId],
    queryFn: () => api.threads.usage(threadId!),
    enabled: !!threadId && isUsageOpen,
    staleTime: 30_000,
  });

  // --- Derived state ---

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
    : isStarredFilterActive
      ? (starredData?.messages ?? [])
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

  const {
    handleSend,
    handleCancel,
    handleRetry,
    handleFork,
    handleEdit,
    handleToggleStar,
    handleDelete: deleteThread,
    handleToggleArchive,
    handleTogglePin,
    handleExport,
  } = useThreadCallbacks({
    threadId,
    thread,
    queryClient,
    navigate,
    setStreamingEvents,
  });

  const handleDelete = useCallback(async () => {
    setDeleteState("deleting");
    try {
      await deleteThread();
    } catch {
      setDeleteState("idle");
    }
  }, [deleteThread]);

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
        setIsStarredFilterActive(false);
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
          key: "i",
          handler: (e: KeyboardEvent) => {
            e.preventDefault();
            setIsContextOpen((v) => !v);
          },
        },
        {
          key: "s",
          handler: (e: KeyboardEvent) => {
            e.preventDefault();
            setIsStarredFilterActive((v) => {
              if (!v) {
                setIsSearchOpen(false);
                setSearchInput("");
                setSearchQuery("");
              }
              return !v;
            });
          },
        },
        {
          key: "Escape",
          allowInInput: true,
          handler: (e: KeyboardEvent) => {
            if (isSearchOpen) {
              e.preventDefault();
              toggleSearch();
            } else if (isStarredFilterActive) {
              e.preventDefault();
              setIsStarredFilterActive(false);
            } else if (isFileBrowserOpen) {
              e.preventDefault();
              setIsFileBrowserOpen(false);
            } else if (isGitPanelOpen) {
              e.preventDefault();
              setIsGitPanelOpen(false);
            } else if (isContextOpen) {
              e.preventDefault();
              setIsContextOpen(false);
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
        isStarredFilterActive,
        isFileBrowserOpen,
        isGitPanelOpen,
        isContextOpen,
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
          isStarredFilterActive={isStarredFilterActive}
          onToggleStarredFilter={() => {
            setIsStarredFilterActive((v) => !v);
            if (!isStarredFilterActive) {
              setIsSearchOpen(false);
              setSearchInput("");
              setSearchQuery("");
            }
          }}
          isContextOpen={isContextOpen}
          onToggleContext={() => setIsContextOpen((v) => !v)}
          isUsageOpen={isUsageOpen}
          onToggleUsage={() => setIsUsageOpen((v) => !v)}
          onOpenShare={() => setIsShareDialogOpen(true)}
          onExport={handleExport}
          onTogglePin={handleTogglePin}
          onToggleArchive={handleToggleArchive}
          onStartDelete={() => setDeleteState("confirming")}
        />

        {isSearchOpen && (
          <ThreadSearchBar
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onToggleSearch={toggleSearch}
            onClearSearch={clearSearch}
            searchInputRef={searchInputRef}
            isSearchLoading={searchLoading}
            hasSearchQuery={!!searchQuery}
          />
        )}

        <ThreadContextBar
          isOpen={isContextOpen}
          workspaceAgent={thread?.workspace_agent ?? null}
          workspaceModel={thread?.workspace_model ?? null}
          workspaceCustomInstruction={
            thread?.workspace_custom_instruction ?? null
          }
          workingDirectory={thread?.working_directory ?? null}
          machineDefaultAgent={machine?.default_agent}
          machineDefaultModel={machine?.default_model}
        />

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
            <ThreadMessageList
              messages={displayMessages}
              isLoading={isPageLoading}
              isError={isPageError}
              onRetry={() => refetchMessages()}
              isSearchActive={isSearchActive}
              searchQuery={searchQuery}
              searchResultCount={searchData?.messages.length}
              isStarredFilterActive={isStarredFilterActive}
              hasNextPage={hasNextPage ?? false}
              isFetchingNextPage={isFetchingNextPage}
              onLoadOlder={handleLoadOlder}
              mergedStreamingEvents={mergedStreamingEvents}
              messageStatuses={messageStatuses}
              onCancel={handleCancel}
              onRetryMessage={handleRetry}
              onFork={handleFork}
              onEdit={handleEdit}
              onToggleStar={handleToggleStar}
              scrollContainerRef={scrollContainerRef}
              bottomRef={bottomRef}
              isNearBottom={isNearBottom}
              hasNewMessages={hasNewMessages}
              onScrollToBottom={scrollToBottom}
            />

            <MessageInput
              onSend={handleSend}
              resolvedModel={resolveModel(
                thread?.workspace_model,
                machine?.default_model,
              )}
            />
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

        {thread && (
          <ShareThreadDialog
            open={isShareDialogOpen}
            onOpenChange={setIsShareDialogOpen}
            threadId={thread.id}
            shareToken={thread.share_token}
            onShareChange={(token) => {
              queryClient.setQueryData(
                ["thread", threadId],
                (old: typeof thread) =>
                  old ? { ...old, share_token: token } : old,
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
