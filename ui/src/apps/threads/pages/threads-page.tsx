import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  FolderIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
  WifiOffIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function ThreadsPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);

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
    queryKey: ["threads", machineId],
    queryFn: () => api.threads.list(machineId!),
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
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <WifiOffIcon className="size-4 shrink-0" />
          <span>
            Machine is offline. Messages will be processed when it reconnects.
          </span>
        </div>
      )}

      {/* Workspace Filter */}
      {workspaces && workspaces.length > 0 && (
        <div className="mt-4">
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="all">All threads</option>
            <option value="none">No workspace</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
              <MessageSquareIcon className="text-muted-foreground/40 mb-3 size-8" />
              <p>No threads yet.</p>
              <p className="mt-1">Start a conversation with your machine.</p>
            </div>
          )}

          {filteredThreads.map((thread) => (
            <div key={thread.id} className="relative">
              {deletingThreadId === thread.id ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-800">
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
                <div className="group hover:bg-muted/50 flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors">
                  <button
                    onClick={() => navigate(`/threads/${thread.id}`)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <MessageSquareIcon className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {thread.title ?? "New thread"}
                      </div>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                        {thread.workspace_name && (
                          <>
                            <span className="flex items-center gap-1">
                              <FolderIcon className="size-3" />
                              {thread.workspace_name}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        <span>{timeAgo(thread.updated_at)}</span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        thread.status === "active" ? "secondary" : "outline"
                      }
                      className="mt-0.5 shrink-0"
                    >
                      {thread.status}
                    </Badge>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingThreadId(thread.id);
                    }}
                    className="text-muted-foreground/40 hover:text-destructive mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
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
