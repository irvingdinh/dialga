import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  FolderIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { CreateThreadDialog } from "@/apps/threads/components/create-thread-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";

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
            <Skeleton className="mt-1.5 h-3 w-24" />
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

export default function ThreadsPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>(
    () => localStorage.getItem("dialga-thread-sort") || "updated",
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  const { data: machine } = useQuery({
    queryKey: ["machine", machineId],
    queryFn: () => api.machines.get(machineId!),
    enabled: !!machineId,
  });

  const {
    data: threads,
    refetch,
    isLoading: threadsLoading,
    isError: threadsError,
  } = useQuery({
    queryKey: [
      "threads",
      machineId,
      showArchived ? "all" : "active",
      searchQuery,
      sortBy,
    ],
    queryFn: () =>
      api.threads.list(machineId!, {
        status: showArchived ? "all" : "active",
        q: searchQuery || undefined,
        sort: sortBy !== "updated" ? sortBy : undefined,
      }),
    enabled: !!machineId,
  });

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", machineId],
    queryFn: () => api.workspaces.list(machineId!),
    enabled: !!machineId,
  });

  // SSE for real-time thread updates
  useEffect(() => {
    if (!machineId) return;

    const evtSource = new EventSource(
      `/api/machines/${machineId}/threads/stream`,
    );

    evtSource.addEventListener("thread:update", () => {
      queryClient.invalidateQueries({ queryKey: ["threads", machineId] });
    });

    evtSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => evtSource.close();
  }, [machineId, queryClient]);

  // SSE for machine status
  useEffect(() => {
    const evtSource = new EventSource("/api/machines/stream");

    evtSource.addEventListener("machine:status", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.machine_id === machineId) {
          queryClient.invalidateQueries({ queryKey: ["machine", machineId] });
        }
      } catch {
        // ignore parse errors
      }
    });

    evtSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => evtSource.close();
  }, [machineId, queryClient]);

  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    if (workspaceFilter === "all") return threads;
    if (workspaceFilter === "none") {
      return threads.filter((t) => !t.workspace_id);
    }
    return threads.filter((t) => t.workspace_id === workspaceFilter);
  }, [threads, workspaceFilter]);

  const handleCreated = useCallback(
    (threadId: string) => {
      refetch();
      navigate(`/threads/${threadId}`);
    },
    [refetch, navigate],
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      try {
        await api.threads.delete(threadId);
        setDeletingThreadId(null);
        queryClient.invalidateQueries({ queryKey: ["threads", machineId] });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to delete thread";
        toast.error(message);
      }
    },
    [machineId, queryClient],
  );

  const handleToggleArchive = useCallback(
    async (threadId: string, currentStatus: string) => {
      try {
        const newStatus = currentStatus === "archived" ? "active" : "archived";
        await api.threads.update(threadId, { status: newStatus });
        queryClient.invalidateQueries({ queryKey: ["threads", machineId] });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to update thread status";
        toast.error(message);
      }
    },
    [machineId, queryClient],
  );

  const isOffline = machine?.status === "offline";

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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                {machine?.name ?? "..."}
              </h1>
              <div
                className={`size-2 rounded-full ${
                  machine?.status === "online"
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30"
                }`}
              />
            </div>
            <p className="text-muted-foreground text-xs">Threads</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(`/machines/${machineId}/settings`)}
          >
            <SettingsIcon className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        </div>
      </div>

      {/* Offline Banner */}
      {isOffline && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
          <WifiOffIcon className="size-4 shrink-0" />
          <span>
            Machine is offline. Messages will be processed when it reconnects.
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative mt-4">
        <SearchIcon className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search threads..."
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
        {workspaces && workspaces.length > 0 && (
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="border-input bg-background text-foreground min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
          >
            <option value="all">All threads</option>
            <option value="none">No workspace</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
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

      {/* Thread List */}
      {threads && (
        <div className="mt-4 flex flex-col gap-2">
          {filteredThreads.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center py-16 text-center text-sm">
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
                    Start a conversation with your machine.
                  </p>
                </>
              )}
            </div>
          )}

          {filteredThreads.map((thread) => (
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
                  className={`group hover:bg-muted/50 flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${thread.status === "archived" ? "opacity-60" : ""}`}
                >
                  <button
                    onClick={() => navigate(`/threads/${thread.id}`)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <MessageSquareIcon className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {thread.title ?? "New thread"}
                      </div>
                      {thread.latest_message && (
                        <div className="text-muted-foreground mt-0.5 truncate text-xs">
                          <LatestMessagePreview
                            message={thread.latest_message}
                          />
                        </div>
                      )}
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
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
                        {thread.workspace_name && (
                          <>
                            <span className="flex items-center gap-1">
                              <FolderIcon className="size-3" />
                              {thread.workspace_name}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        {thread.message_count > 0 && (
                          <>
                            <span>
                              {thread.message_count}{" "}
                              {thread.message_count === 1 ? "msg" : "msgs"}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        <span>{timeAgo(thread.updated_at)}</span>
                      </div>
                    </div>
                  </button>
                  <div className="mt-0.5 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateThreadDialog
        machineId={machineId!}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
