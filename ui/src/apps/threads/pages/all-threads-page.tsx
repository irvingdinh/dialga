import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  CheckIcon,
  FolderIcon,
  MessageSquareIcon,
  MonitorIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  SquareCheckBigIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useUnread } from "@/lib/unread";
import { usePageShortcuts } from "@/lib/use-page-shortcuts";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ThreadListSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-2xl border px-4 py-3"
        >
          <Skeleton className="mt-0.5 size-4 rounded" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-1.5 h-3 w-32" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
          <Skeleton className="mt-0.5 h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function LatestMessagePreview({
  message,
}: {
  message: { role: string; content: string; status: string };
}) {
  if (message.role === "assistant") {
    if (message.status === "running") {
      return <span className="italic">Running...</span>;
    }
    if (message.status === "queued") {
      return <span className="italic">Waiting in queue...</span>;
    }
    if (message.status === "error") {
      return <span className="text-red-500 dark:text-red-400">Error</span>;
    }
    if (message.status === "timed_out") {
      return (
        <span className="text-amber-600 dark:text-amber-400">Timed out</span>
      );
    }
    if (message.status === "cancelled") {
      return <span className="italic">Cancelled</span>;
    }
  }

  const prefix = message.role === "user" ? "You: " : "";
  const text = message.content.replace(/\n/g, " ").trim();
  return (
    <span>
      {prefix && <span className="text-muted-foreground/70">{prefix}</span>}
      {text || <span className="italic">Empty message</span>}
    </span>
  );
}

export default function AllThreadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>(
    () => localStorage.getItem("dialga-thread-sort") || "updated",
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isUnread } = useUnread();

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionPending, setBulkActionPending] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const isSelectMode = selectedIds.size > 0;

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  // Page-level keyboard shortcuts
  usePageShortcuts(
    useMemo(
      () => [
        {
          key: "/",
          handler: (e: KeyboardEvent) => {
            e.preventDefault();
            searchInputRef.current?.focus();
          },
        },
        {
          key: "Escape",
          allowInInput: true,
          handler: (e: KeyboardEvent) => {
            if (isSelectMode) {
              e.preventDefault();
              setSelectedIds(new Set());
              setConfirmBulkDelete(false);
            } else if (searchInput) {
              e.preventDefault();
              setSearchInput("");
              searchInputRef.current?.blur();
            }
          },
        },
      ],
      [isSelectMode, searchInput],
    ),
  );

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: () => api.machines.list(),
  });

  const {
    data: threads,
    refetch,
    isLoading: threadsLoading,
    isError: threadsError,
  } = useQuery({
    queryKey: [
      "all-threads",
      machineFilter,
      showArchived ? "all" : "active",
      searchQuery,
      sortBy,
    ],
    queryFn: () =>
      api.threads.listAll({
        machine_id: machineFilter !== "all" ? machineFilter : undefined,
        status: showArchived ? "all" : "active",
        q: searchQuery || undefined,
        sort: sortBy !== "updated" ? sortBy : undefined,
      }),
  });

  // SSE for real-time updates via notifications stream
  useEffect(() => {
    const evtSource = new EventSource("/api/notifications/stream");

    evtSource.addEventListener("task:notification", () => {
      queryClient.invalidateQueries({ queryKey: ["all-threads"] });
    });

    evtSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => evtSource.close();
  }, [queryClient]);

  const filteredThreads = useMemo(() => threads ?? [], [threads]);

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      try {
        await api.threads.delete(threadId);
        setDeletingThreadId(null);
        queryClient.invalidateQueries({ queryKey: ["all-threads"] });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to delete thread";
        toast.error(message);
      }
    },
    [queryClient],
  );

  const handleToggleArchive = useCallback(
    async (threadId: string, currentStatus: string) => {
      try {
        const newStatus = currentStatus === "archived" ? "active" : "archived";
        await api.threads.update(threadId, { status: newStatus });
        queryClient.invalidateQueries({ queryKey: ["all-threads"] });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to update thread status";
        toast.error(message);
      }
    },
    [queryClient],
  );

  const handleTogglePin = useCallback(
    async (threadId: string, isPinned: boolean) => {
      try {
        await api.threads.update(threadId, { is_pinned: !isPinned });
        queryClient.invalidateQueries({ queryKey: ["all-threads"] });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to update thread";
        toast.error(message);
      }
    },
    [queryClient],
  );

  const toggleSelect = useCallback((threadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredThreads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredThreads.map((t) => t.id)));
    }
  }, [selectedIds.size, filteredThreads]);

  const handleBulkAction = useCallback(
    async (action: "archive" | "unarchive" | "delete") => {
      if (selectedIds.size === 0) return;
      if (action === "delete" && !confirmBulkDelete) {
        setConfirmBulkDelete(true);
        return;
      }

      setBulkActionPending(true);
      try {
        const result = await api.threads.bulk(Array.from(selectedIds), action);
        setSelectedIds(new Set());
        setConfirmBulkDelete(false);
        queryClient.invalidateQueries({ queryKey: ["all-threads"] });
        const label =
          action === "delete"
            ? "deleted"
            : action === "archive"
              ? "archived"
              : "unarchived";
        toast.success(
          `${result.affected} thread${result.affected !== 1 ? "s" : ""} ${label}`,
        );
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : `Failed to ${action} threads`;
        toast.error(message);
      } finally {
        setBulkActionPending(false);
      }
    },
    [selectedIds, confirmBulkDelete, queryClient],
  );

  // Check if any selected thread is archived / active for contextual actions
  const hasSelectedArchived = useMemo(
    () =>
      filteredThreads.some(
        (t) => selectedIds.has(t.id) && t.status === "archived",
      ),
    [filteredThreads, selectedIds],
  );
  const hasSelectedActive = useMemo(
    () =>
      filteredThreads.some(
        (t) => selectedIds.has(t.id) && t.status === "active",
      ),
    [filteredThreads, selectedIds],
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/machines")}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              All Threads
            </h1>
            <p className="text-muted-foreground text-xs">Across all machines</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filteredThreads.length > 0 && (
            <Button
              variant={isSelectMode ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => {
                if (isSelectMode) {
                  setSelectedIds(new Set());
                  setConfirmBulkDelete(false);
                } else {
                  toggleSelectAll();
                }
              }}
              title={isSelectMode ? "Cancel selection" : "Select threads"}
            >
              {isSelectMode ? (
                <XIcon className="size-4" />
              ) : (
                <SquareCheckBigIcon className="size-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <SearchIcon className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search all threads..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 w-full rounded-xl border py-2 pr-9 pl-9 text-sm focus:ring-2 focus:ring-neutral-300 focus:outline-none dark:focus:ring-neutral-600"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput("");
              searchInputRef.current?.focus();
            }}
            className="text-muted-foreground/50 hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mt-2 flex items-center gap-2">
        {machines && machines.length > 1 && (
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="border-input bg-background text-foreground min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
          >
            <option value="all">All machines</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            localStorage.setItem("dialga-thread-sort", e.target.value);
          }}
          className="border-input bg-background text-foreground shrink-0 rounded-xl border px-3 py-2 text-sm"
        >
          <option value="updated">Last updated</option>
          <option value="created">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="title">Alphabetical</option>
        </select>
        <Button
          variant={showArchived ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
          className="shrink-0 gap-1.5"
        >
          <ArchiveIcon className="size-3.5" />
          Archived
        </Button>
      </div>

      {/* Loading */}
      {threadsLoading && <ThreadListSkeleton />}

      {/* Error */}
      {threadsError && (
        <div className="mt-4 flex flex-col items-center py-16 text-center">
          <AlertCircleIcon className="text-muted-foreground/40 mb-3 size-8" />
          <p className="text-muted-foreground text-sm">
            Failed to load threads.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Select All bar */}
      {isSelectMode && filteredThreads.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
          >
            <div
              className={`flex size-4 items-center justify-center rounded border transition-colors ${
                selectedIds.size === filteredThreads.length
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-input"
              }`}
            >
              {selectedIds.size === filteredThreads.length && (
                <CheckIcon className="size-3" />
              )}
            </div>
            {selectedIds.size === filteredThreads.length
              ? "Deselect all"
              : "Select all"}
          </button>
          <span className="text-muted-foreground text-xs">
            {selectedIds.size} selected
          </span>
        </div>
      )}

      {/* Thread List */}
      {threads && (
        <div className="mt-2 flex flex-col gap-2 pb-16">
          {filteredThreads.length === 0 && (
            <div className="text-muted-foreground mt-2 flex flex-col items-center py-16 text-center text-sm">
              {searchQuery ? (
                <>
                  <SearchIcon className="text-muted-foreground/40 mb-3 size-8" />
                  <p>No threads match &ldquo;{searchQuery}&rdquo;</p>
                </>
              ) : (
                <>
                  <MessageSquareIcon className="text-muted-foreground/40 mb-3 size-8" />
                  <p>No threads yet.</p>
                  <p className="mt-1">
                    Create a thread from any machine to get started.
                  </p>
                </>
              )}
            </div>
          )}

          {filteredThreads.map((thread) => {
            const unread = isUnread(thread.id, thread.updated_at);
            const isSelected = selectedIds.has(thread.id);
            return (
              <div key={thread.id} className="relative">
                {deletingThreadId === thread.id ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                    <p className="text-sm text-red-800 dark:text-red-400">
                      Delete this thread and all its messages?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingThreadId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteThread(thread.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`group hover:bg-muted/50 flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${thread.status === "archived" ? "opacity-60" : ""} ${isSelected ? "border-blue-500/50 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-950/20" : ""}`}
                  >
                    {isSelectMode ? (
                      <button
                        onClick={() => toggleSelect(thread.id)}
                        className="mt-0.5 shrink-0"
                      >
                        <div
                          className={`flex size-4 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-input hover:border-foreground/40"
                          }`}
                        >
                          {isSelected && <CheckIcon className="size-3" />}
                        </div>
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        if (isSelectMode) {
                          toggleSelect(thread.id);
                        } else {
                          navigate(`/threads/${thread.id}`);
                        }
                      }}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      {!isSelectMode &&
                        (thread.is_pinned ? (
                          <PinIcon className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                        ) : (
                          <MessageSquareIcon className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
                        ))}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {unread && (
                            <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
                          )}
                          <span className="truncate">
                            {thread.title ?? "New thread"}
                          </span>
                        </div>
                        {thread.latest_message && (
                          <div className="text-muted-foreground mt-0.5 truncate text-xs">
                            <LatestMessagePreview
                              message={thread.latest_message}
                            />
                          </div>
                        )}
                        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          {thread.status === "archived" && (
                            <>
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                archived
                              </Badge>
                              <span>·</span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <MonitorIcon className="size-3" />
                            <span className="max-w-[120px] truncate">
                              {thread.machine_name}
                            </span>
                            <span
                              className={`size-1.5 rounded-full ${
                                thread.machine_status === "online"
                                  ? "bg-emerald-500"
                                  : "bg-muted-foreground/30"
                              }`}
                            />
                          </span>
                          {thread.workspace_name && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <FolderIcon className="size-3" />
                                {thread.workspace_name}
                              </span>
                            </>
                          )}
                          {thread.message_count > 0 && (
                            <>
                              <span>·</span>
                              <span>
                                {thread.message_count}{" "}
                                {thread.message_count === 1 ? "msg" : "msgs"}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span>{timeAgo(thread.updated_at)}</span>
                        </div>
                      </div>
                    </button>
                    {!isSelectMode && (
                      <div className="mt-0.5 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(thread.id, thread.is_pinned);
                          }}
                          className={`hover:text-foreground ${thread.is_pinned ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground/40"}`}
                          title={
                            thread.is_pinned ? "Unpin thread" : "Pin thread"
                          }
                        >
                          {thread.is_pinned ? (
                            <PinOffIcon className="size-4" />
                          ) : (
                            <PinIcon className="size-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArchive(thread.id, thread.status);
                          }}
                          className="text-muted-foreground/40 hover:text-foreground"
                          title={
                            thread.status === "archived"
                              ? "Unarchive thread"
                              : "Archive thread"
                          }
                        >
                          {thread.status === "archived" ? (
                            <ArchiveRestoreIcon className="size-4" />
                          ) : (
                            <ArchiveIcon className="size-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingThreadId(thread.id);
                          }}
                          className="text-muted-foreground/40 hover:text-destructive"
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Bar (multi-select) */}
      {isSelectMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="bg-background pointer-events-auto flex items-center gap-2 rounded-2xl border px-4 py-2.5 shadow-lg">
            {confirmBulkDelete ? (
              <>
                <span className="text-sm text-red-600 dark:text-red-400">
                  Delete {selectedIds.size} thread
                  {selectedIds.size !== 1 ? "s" : ""}?
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmBulkDelete(false)}
                  disabled={bulkActionPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction("delete")}
                  disabled={bulkActionPending}
                >
                  {bulkActionPending ? "Deleting..." : "Delete"}
                </Button>
              </>
            ) : (
              <>
                <span className="text-muted-foreground mr-1 text-sm">
                  {selectedIds.size} selected
                </span>
                {hasSelectedActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction("archive")}
                    disabled={bulkActionPending}
                    className="gap-1.5"
                  >
                    <ArchiveIcon className="size-3.5" />
                    Archive
                  </Button>
                )}
                {hasSelectedArchived && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction("unarchive")}
                    disabled={bulkActionPending}
                    className="gap-1.5"
                  >
                    <ArchiveRestoreIcon className="size-3.5" />
                    Unarchive
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("delete")}
                  disabled={bulkActionPending}
                  className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2Icon className="size-3.5" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
