import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  SlashIcon,
  XCircleIcon,
} from "lucide-react";

import { api } from "@/lib/api";

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

const STATUS_CONFIG = {
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
} as const;

const FALLBACK_CONFIG = {
  icon: AlertTriangleIcon,
  color: "text-muted-foreground",
  label: "unknown",
  pillClass: "bg-muted text-muted-foreground",
};

export function RecentActivity({
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
          const statusConfig = STATUS_CONFIG[
            item.status as keyof typeof STATUS_CONFIG
          ] ?? {
            ...FALLBACK_CONFIG,
            label: item.status,
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
