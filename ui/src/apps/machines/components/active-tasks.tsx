import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

function elapsedTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function ActiveTasks({
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
