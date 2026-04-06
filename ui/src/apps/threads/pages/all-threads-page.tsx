import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  MessageSquareIcon,
  SearchIcon,
  SquareCheckBigIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  FloatingActionBar,
  SelectAllBar,
  ThreadListSkeleton,
  ThreadListWithGroups,
} from "@/apps/threads/components/thread-list-shared";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useNotificationEvent } from "@/lib/connection";
import { useUnread } from "@/lib/unread";
import { usePageShortcuts } from "@/lib/use-page-shortcuts";

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
  useNotificationEvent("task:notification", () => {
    queryClient.invalidateQueries({ queryKey: ["all-threads"] });
  });

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
      {threadsLoading && <ThreadListSkeleton showMachine />}

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
        <SelectAllBar
          selectedCount={selectedIds.size}
          totalCount={filteredThreads.length}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      {/* Thread List */}
      {threads && (
        <div className="mt-2 flex flex-col pb-16">
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

          <ThreadListWithGroups
            threads={filteredThreads}
            useGroups={sortBy === "updated" && !searchQuery}
            isUnreadFn={isUnread}
            isSelectMode={isSelectMode}
            selectedIds={selectedIds}
            deletingThreadId={deletingThreadId}
            showMachine
            onNavigate={(id) => navigate(`/threads/${id}`)}
            onToggleSelect={toggleSelect}
            onTogglePin={(id, pinned) => handleTogglePin(id, pinned)}
            onToggleArchive={(id, status) => handleToggleArchive(id, status)}
            onStartDelete={setDeletingThreadId}
            onCancelDelete={() => setDeletingThreadId(null)}
            onConfirmDelete={handleDeleteThread}
          />
        </div>
      )}

      {/* Floating Action Bar (multi-select) */}
      {isSelectMode && (
        <FloatingActionBar
          selectedCount={selectedIds.size}
          hasSelectedActive={hasSelectedActive}
          hasSelectedArchived={hasSelectedArchived}
          confirmBulkDelete={confirmBulkDelete}
          bulkActionPending={bulkActionPending}
          onBulkAction={handleBulkAction}
          onCancelBulkDelete={() => setConfirmBulkDelete(false)}
        />
      )}
    </div>
  );
}
