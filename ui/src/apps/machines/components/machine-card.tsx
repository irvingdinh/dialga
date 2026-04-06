import { FolderIcon, MessageSquareIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { HealthInfo } from "@/lib/api";

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

export interface MachineCardProps {
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
}

export function MachineCard({
  machine,
  unreadCount,
  onClick,
}: MachineCardProps) {
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

export function MachineListSkeleton() {
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
