import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  FolderIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/apps/auth/auth-provider";
import { CreateMachineDialog } from "@/apps/machines/components/create-machine-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type HealthInfo } from "@/lib/api";
import { useTheme } from "@/lib/theme";

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
          <div className="truncate text-sm font-medium">{machine.name}</div>
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

export default function MachinesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toggle, resolved } = useTheme();
  const [createOpen, setCreateOpen] = useState(false);

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
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={toggle}>
            {resolved === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>

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
    </div>
  );
}
