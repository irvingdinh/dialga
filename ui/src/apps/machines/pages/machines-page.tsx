import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CoinsIcon,
  FolderIcon,
  HashIcon,
  LoaderIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  MonitorIcon,
  PlusIcon,
  SettingsIcon,
  SlashIcon,
  XCircleIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/apps/auth/auth-provider";
import { CreateMachineDialog } from "@/apps/machines/components/create-machine-dialog";
import { QuickNewThreadDialog } from "@/components/quick-new-thread-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type HealthInfo } from "@/lib/api";
import { useUnread } from "@/lib/unread";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function elapsedTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function UsageSummary() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["usage", "summary"],
    queryFn: api.usage.summary,
    staleTime: 60_000,
  });

  if (!data || data.message_count === 0) return null;

  const totalTokens = data.total_input_tokens + data.total_output_tokens;

  return (
    <div className="mt-6">
      <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Usage Overview
      </h2>
      <div className="rounded-2xl border px-4 py-3">
        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {data.total_cost_usd > 0 && (
            <span className="flex items-center gap-1.5 font-medium">
              <CoinsIcon className="text-muted-foreground size-3.5 shrink-0" />$
              {data.total_cost_usd.toFixed(2)}
            </span>
          )}
          {totalTokens > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <HashIcon className="size-3.5 shrink-0" />
              {totalTokens >= 1_000_000
                ? `${(totalTokens / 1_000_000).toFixed(1)}M`
                : totalTokens >= 1_000
                  ? `${(totalTokens / 1_000).toFixed(1)}K`
                  : totalTokens}{" "}
              tokens
            </span>
          )}
          {data.message_count > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ZapIcon className="size-3.5 shrink-0" />
              {data.message_count} response
              {data.message_count !== 1 ? "s" : ""}
            </span>
          )}
          {data.total_duration_ms > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ClockIcon className="size-3.5 shrink-0" />
              {data.total_duration_ms >= 3_600_000
                ? `${(data.total_duration_ms / 3_600_000).toFixed(1)}h`
                : data.total_duration_ms >= 60_000
                  ? `${(data.total_duration_ms / 60_000).toFixed(1)}m`
                  : `${(data.total_duration_ms / 1_000).toFixed(1)}s`}
            </span>
          )}
        </div>

        {/* Model breakdown */}
        {Object.keys(data.models).length > 0 && (
          <div className="text-muted-foreground mt-1.5 pl-[22px] text-xs opacity-60">
            {Object.entries(data.models)
              .sort(([, a], [, b]) => b - a)
              .map(([model, count]) =>
                count > 1 ? `${model} ×${count}` : model,
              )
              .join(", ")}
          </div>
        )}

        {/* Per-machine breakdown */}
        {data.by_machine.length > 1 && (
          <div className="mt-2.5 border-t pt-2.5">
            <div className="flex flex-col gap-1">
              {data.by_machine.map((m) => (
                <button
                  key={m.machine_id}
                  onClick={() => navigate(`/machines/${m.machine_id}/threads`)}
                  className="hover:bg-muted/50 -mx-1 flex items-center justify-between rounded-lg px-1 py-0.5 text-xs transition-colors"
                >
                  <span className="text-muted-foreground truncate">
                    {m.machine_name}
                  </span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-3 tabular-nums">
                    {m.total_cost_usd > 0 && (
                      <span>${m.total_cost_usd.toFixed(2)}</span>
                    )}
                    <span>
                      {(
                        m.total_input_tokens + m.total_output_tokens
                      ).toLocaleString()}{" "}
                      tok
                    </span>
                    <span>
                      {m.message_count} msg{m.message_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveTasks({
  onNavigate,
}: {
  onNavigate: (threadId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const { data } = useQuery({
    queryKey: ["tasks", "active"],
    queryFn: api.tasks.active,
    refetchInterval: 5000,
  });

  // SSE: listen for task notifications to invalidate active tasks query
  useEffect(() => {
    const evtSource = new EventSource("/api/notifications/stream");

    evtSource.addEventListener("task:notification", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "active"] });
      queryClient.invalidateQueries({ queryKey: ["activity", "recent"] });
      queryClient.invalidateQueries({ queryKey: ["threads-unread"] });
      queryClient.invalidateQueries({ queryKey: ["usage", "summary"] });
    });

    evtSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => evtSource.close();
  }, [queryClient]);

  // Tick every second to update elapsed times
  useEffect(() => {
    if (data?.tasks && data.tasks.length > 0) {
      tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [data?.tasks]);

  const handleCancel = useCallback(
    async (messageId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await api.messages.cancel(messageId);
        queryClient.invalidateQueries({ queryKey: ["tasks", "active"] });
      } catch {
        // ignore — task may already be done
      }
    },
    [queryClient],
  );

  if (!data?.tasks || data.tasks.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Active Tasks
      </h2>
      <div className="flex flex-col gap-1.5">
        {data.tasks.map((task) => {
          const isRunning = task.status === "running";
          return (
            <button
              key={task.message_id}
              onClick={() => onNavigate(task.thread_id)}
              className="hover:bg-muted/50 group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
            >
              {/* Status indicator */}
              <div className="flex shrink-0 items-center">
                {isRunning ? (
                  <LoaderIcon className="size-3.5 animate-spin text-blue-500" />
                ) : (
                  <div className="size-2 rounded-full bg-amber-400 dark:bg-amber-500" />
                )}
              </div>

              {/* Task info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {task.thread_title || "New thread"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      isRunning
                        ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                        : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                    }`}
                  >
                    {isRunning ? "running" : "queued"}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
                  <span>{task.machine_name}</span>
                  {task.workspace_name && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{task.workspace_name}</span>
                    </>
                  )}
                  <span className="text-muted-foreground/40">·</span>
                  <span className="tabular-nums">
                    {elapsedTime(task.started_at || task.created_at)}
                  </span>
                </div>
              </div>

              {/* Cancel button */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 max-sm:opacity-100"
                onClick={(e) => handleCancel(task.message_id, e)}
              >
                <XIcon className="size-3.5" />
              </Button>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivity({
  onNavigate,
}: {
  onNavigate: (threadId: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["activity", "recent"],
    queryFn: () => api.activity.recent(10),
    staleTime: 30_000,
  });

  if (!data?.items || data.items.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Recent Activity
      </h2>
      <div className="flex flex-col gap-1.5">
        {data.items.map((item) => {
          const statusConfig = {
            completed: {
              icon: CheckCircle2Icon,
              color: "text-emerald-500 dark:text-emerald-400",
              label: "completed",
              pillClass:
                "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
            },
            error: {
              icon: XCircleIcon,
              color: "text-red-500 dark:text-red-400",
              label: "error",
              pillClass:
                "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
            },
            timed_out: {
              icon: ClockIcon,
              color: "text-amber-500 dark:text-amber-400",
              label: "timed out",
              pillClass:
                "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
            },
            cancelled: {
              icon: SlashIcon,
              color: "text-muted-foreground",
              label: "cancelled",
              pillClass: "bg-muted text-muted-foreground",
            },
          }[item.status] ?? {
            icon: AlertTriangleIcon,
            color: "text-muted-foreground",
            label: item.status,
            pillClass: "bg-muted text-muted-foreground",
          };

          const StatusIcon = statusConfig.icon;

          return (
            <button
              key={item.message_id}
              onClick={() => onNavigate(item.thread_id)}
              className="hover:bg-muted/50 group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
            >
              {/* Status icon */}
              <div className="flex shrink-0 items-center">
                <StatusIcon className={`size-3.5 ${statusConfig.color}`} />
              </div>

              {/* Activity info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {item.thread_title || "New thread"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusConfig.pillClass}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
                  <span>{item.machine_name}</span>
                  {item.workspace_name && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{item.workspace_name}</span>
                    </>
                  )}
                  {item.model && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{item.model}</span>
                    </>
                  )}
                  <span className="text-muted-foreground/40">·</span>
                  <span>{timeAgo(item.completed_at)}</span>
                </div>
                {item.content && item.status !== "cancelled" && (
                  <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                    {item.content}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgentIndicator({
  name,
  info,
}: {
  name: string;
  info: { available: boolean; version?: string } | undefined;
}) {
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] ${info.available ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50 line-through"}`}
    >
      {name}
      {info.available && info.version && (
        <span className="text-muted-foreground text-[10px]">
          {info.version}
        </span>
      )}
    </span>
  );
}

function MachineCard({
  machine,
  unreadCount,
  onClick,
}: {
  machine: {
    id: string;
    name: string;
    default_agent: string;
    default_model: string;
    status: string;
    health_info: HealthInfo | null;
    last_seen_at: string | null;
    thread_count: number;
    workspace_count: number;
  };
  unreadCount: number;
  onClick: () => void;
}) {
  const isOnline = machine.status === "online";

  return (
    <button
      onClick={onClick}
      className="hover:bg-muted/50 group flex flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-colors"
    >
      {/* Row 1: Status + Name + Agent/Model */}
      <div className="flex items-start gap-2.5">
        <div className="mt-1.5 flex shrink-0 items-center">
          <div
            className={`size-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate text-sm font-medium">
            <span className="truncate">{machine.name}</span>
            {unreadCount > 0 && (
              <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {machine.default_agent === "claude" ? "Claude Code" : "Codex CLI"}
            {machine.default_model ? ` · ${machine.default_model}` : ""}
          </div>
        </div>
        <div
          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${isOnline ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : "text-muted-foreground bg-muted"}`}
        >
          {isOnline ? "online" : "offline"}
        </div>
      </div>

      {/* Row 2: Stats + Agents + Last seen */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pl-[18px] text-xs">
        <span className="inline-flex items-center gap-1">
          <MessageSquareIcon className="size-3" />
          {machine.thread_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <FolderIcon className="size-3" />
          {machine.workspace_count}
        </span>
        {machine.health_info?.agents && (
          <span className="inline-flex items-center gap-2">
            <AgentIndicator
              name="claude"
              info={machine.health_info.agents.claude}
            />
            <AgentIndicator
              name="codex"
              info={machine.health_info.agents.codex}
            />
          </span>
        )}
        <span className="ml-auto">{timeAgo(machine.last_seen_at)}</span>
      </div>
    </button>
  );
}

function MachineListSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-2xl border px-4 py-3"
        >
          <div className="flex items-start gap-2.5">
            <Skeleton className="mt-1.5 size-2 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex items-center gap-3 pl-[18px]">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function useUnreadCounts(machines: Array<{ id: string }> | undefined) {
  const { getUnreadCount } = useUnread();

  const machineIds = useMemo(
    () => (machines ?? []).map((m) => m.id),
    [machines],
  );

  const { data: threadsByMachine } = useQuery({
    queryKey: ["threads-unread", machineIds],
    queryFn: async () => {
      const result: Record<
        string,
        Array<{ id: string; updated_at: string }>
      > = {};
      await Promise.all(
        machineIds.map(async (id) => {
          result[id] = await api.threads.list(id);
        }),
      );
      return result;
    },
    enabled: machineIds.length > 0,
    staleTime: 30_000,
  });

  return useMemo(() => {
    const counts: Record<string, number> = {};
    if (threadsByMachine) {
      for (const [machineId, threads] of Object.entries(threadsByMachine)) {
        counts[machineId] = getUnreadCount(threads);
      }
    }
    return counts;
  }, [threadsByMachine, getUnreadCount]);
}

export default function MachinesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newThreadOpen, setNewThreadOpen] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: machines,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["machines"],
    queryFn: api.machines.list,
  });

  const unreadCounts = useUnreadCounts(machines);

  // SSE for real-time machine status updates
  useEffect(() => {
    const evtSource = new EventSource("/api/machines/stream");

    evtSource.addEventListener("machine:status", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          machine_id: string;
          status: string;
          last_seen_at: string;
        };
        queryClient.setQueryData(
          ["machines"],
          (
            old: Array<{
              id: string;
              status: string;
              last_seen_at: string | null;
            }>,
          ) =>
            old?.map((m) =>
              m.id === data.machine_id
                ? {
                    ...m,
                    status: data.status,
                    last_seen_at: data.last_seen_at,
                  }
                : m,
            ),
        );
      } catch {
        // ignore parse errors
      }
    });

    evtSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => evtSource.close();
  }, [queryClient]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Machines</h1>
          <p className="text-muted-foreground text-xs">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewThreadOpen(true)}
          >
            <MessageSquarePlusIcon data-icon="inline-start" />
            New Thread
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Machine
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/settings")}
            title="Settings"
          >
            <SettingsIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Usage Overview */}
      <UsageSummary />

      {/* Active Tasks */}
      <ActiveTasks
        onNavigate={(threadId) => navigate(`/threads/${threadId}`)}
      />

      {/* Recent Activity */}
      <RecentActivity
        onNavigate={(threadId) => navigate(`/threads/${threadId}`)}
      />

      {/* Loading */}
      {isLoading && <MachineListSkeleton />}

      {/* Error */}
      {isError && (
        <div className="mt-6 flex flex-col items-center py-16 text-center">
          <AlertCircleIcon className="text-muted-foreground/40 mb-3 size-8" />
          <p className="text-muted-foreground text-sm">
            Failed to load machines.
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

      {/* Machine List */}
      {machines && (
        <div className="mt-6 flex flex-col gap-2">
          {machines.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center py-16 text-center text-sm">
              <MonitorIcon className="text-muted-foreground/40 mb-3 size-8" />
              <p>No machines yet.</p>
              <p className="mt-1">
                Create one to connect your development environment.
              </p>
            </div>
          )}

          {machines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              unreadCount={unreadCounts[machine.id] ?? 0}
              onClick={() => navigate(`/machines/${machine.id}/threads`)}
            />
          ))}
        </div>
      )}

      <CreateMachineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />

      <QuickNewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        onCreated={(threadId) => navigate(`/threads/${threadId}`)}
      />
    </div>
  );
}
