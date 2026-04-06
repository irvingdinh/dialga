import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  FilterIcon,
  HeartPulseIcon,
  Link2OffIcon,
  LinkIcon,
  LoaderIcon,
  PlayIcon,
  ScrollTextIcon,
  SlashIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type AgentLogEntry, api } from "@/lib/api";

const LOG_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof LinkIcon; color: string; pillClass: string }
> = {
  connected: {
    label: "Connected",
    icon: LinkIcon,
    color: "text-emerald-600 dark:text-emerald-400",
    pillClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  disconnected: {
    label: "Disconnected",
    icon: Link2OffIcon,
    color: "text-muted-foreground",
    pillClass:
      "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/30 dark:text-neutral-400",
  },
  health_report: {
    label: "Health",
    icon: HeartPulseIcon,
    color: "text-blue-600 dark:text-blue-400",
    pillClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
  },
  task_started: {
    label: "Started",
    icon: PlayIcon,
    color: "text-blue-600 dark:text-blue-400",
    pillClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
  },
  task_completed: {
    label: "Completed",
    icon: CheckCircle2Icon,
    color: "text-emerald-600 dark:text-emerald-400",
    pillClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  task_error: {
    label: "Error",
    icon: XCircleIcon,
    color: "text-red-600 dark:text-red-400",
    pillClass:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
  },
  task_cancelled: {
    label: "Cancelled",
    icon: SlashIcon,
    color: "text-muted-foreground",
    pillClass:
      "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/30 dark:text-neutral-400",
  },
  task_timed_out: {
    label: "Timed Out",
    icon: ClockIcon,
    color: "text-amber-600 dark:text-amber-400",
    pillClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
  },
};

const FILTER_OPTIONS = [
  { value: "", label: "All events" },
  { value: "connected", label: "Connected" },
  { value: "disconnected", label: "Disconnected" },
  { value: "health_report", label: "Health reports" },
  { value: "task_started", label: "Task started" },
  { value: "task_completed", label: "Task completed" },
  { value: "task_error", label: "Task errors" },
  { value: "task_cancelled", label: "Task cancelled" },
  { value: "task_timed_out", label: "Task timed out" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogsSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="mt-0.5 size-4 rounded-full" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function LogEntry({ log }: { log: AgentLogEntry }) {
  const config = LOG_TYPE_CONFIG[log.type] || {
    label: log.type,
    icon: ScrollTextIcon,
    color: "text-muted-foreground",
    pillClass:
      "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/30 dark:text-neutral-400",
  };
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  const hasMetadata = log.metadata !== null;
  let parsedMeta: Record<string, unknown> | null = null;
  if (hasMetadata) {
    try {
      parsedMeta = JSON.parse(log.metadata!) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="group flex items-start gap-3 py-2">
      <Icon className={`mt-0.5 size-4 shrink-0 ${config.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm leading-snug break-words">
            {log.message}
          </span>
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          <span title={formatTimestamp(log.created_at)}>
            {timeAgo(log.created_at)}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono text-[10px]">
            {formatTimestamp(log.created_at)}
          </span>
        </div>
        {expanded && parsedMeta && (
          <pre className="bg-muted mt-2 max-h-48 overflow-auto rounded-md p-2 font-mono text-xs">
            {JSON.stringify(parsedMeta, null, 2)}
          </pre>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] ${config.pillClass}`}>
          {config.label}
        </Badge>
        {parsedMeta && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground opacity-0 transition group-hover:opacity-100"
            title={expanded ? "Hide details" : "Show details"}
          >
            <ChevronDownIcon
              className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MachineLogsPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("");

  const { data: machine } = useQuery({
    queryKey: ["machine", machineId],
    queryFn: () => api.machines.get(machineId!),
    enabled: !!machineId,
  });

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["agent-logs", machineId, typeFilter],
    queryFn: ({ pageParam }) =>
      api.agentLogs.list(machineId!, {
        limit: 50,
        before: pageParam as string | undefined,
        type: typeFilter || undefined,
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.has_more || lastPage.logs.length === 0) return undefined;
      return lastPage.logs[lastPage.logs.length - 1].id;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!machineId,
    refetchInterval: 15_000,
  });

  const allLogs = data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/machines/${machineId}/settings`)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Agent Logs</h1>
            {machine && (
              <div
                className={`size-2 rounded-full ${
                  machine.status === "online"
                    ? "bg-emerald-500"
                    : "bg-neutral-300 dark:bg-neutral-600"
                }`}
              />
            )}
          </div>
          {machine && (
            <p className="text-muted-foreground text-xs">{machine.name}</p>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="mt-4 flex items-center gap-2">
        <FilterIcon className="text-muted-foreground size-3.5" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-muted/50 text-foreground h-7 rounded-md border px-2 text-xs focus:ring-1 focus:ring-neutral-400 focus:outline-none dark:focus:ring-neutral-600"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <LogsSkeleton />
      ) : isError ? (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <AlertCircleIcon className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            Failed to load agent logs.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : allLogs.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <ScrollTextIcon className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            {typeFilter
              ? "No logs match this filter."
              : "No agent logs yet. Logs appear when the agent connects."}
          </p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col divide-y">
          {allLogs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
          {hasNextPage && (
            <div className="flex justify-center pt-4 pb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="mr-1.5 size-3.5" />
                    Load older logs
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
