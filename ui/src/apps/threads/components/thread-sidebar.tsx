import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderIcon,
  MessageSquareIcon,
  PinIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { CreateThreadDialog } from "@/apps/threads/components/create-thread-dialog";
import { timeAgo } from "@/apps/threads/components/thread-list-shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useUnread } from "@/lib/unread";

interface ThreadSidebarProps {
  machineId: string;
  currentThreadId: string;
  machineName?: string;
  machineStatus?: string;
}

export function ThreadSidebar({
  machineId,
  currentThreadId,
  machineName,
  machineStatus,
}: ThreadSidebarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { isUnread } = useUnread();

  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads", machineId, "active", "", "updated"],
    queryFn: () => api.threads.list(machineId),
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
      // SSE auto-reconnects
    };

    return () => evtSource.close();
  }, [machineId, queryClient]);

  const handleCreated = (threadId: string) => {
    queryClient.invalidateQueries({ queryKey: ["threads", machineId] });
    navigate(`/threads/${threadId}`);
  };

  return (
    <div className="hidden h-dvh w-72 shrink-0 flex-col border-r lg:flex">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <button
          type="button"
          onClick={() => navigate(`/machines/${machineId}/threads`)}
          className="group flex min-w-0 flex-1 items-center gap-2"
        >
          <div
            className={`size-2 shrink-0 rounded-full ${
              machineStatus === "online"
                ? "bg-emerald-500"
                : "bg-muted-foreground/30"
            }`}
          />
          <span className="truncate text-sm font-semibold tracking-tight group-hover:underline">
            {machineName ?? "..."}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/machines/${machineId}/settings`)}
          className="text-muted-foreground shrink-0"
          title="Machine settings"
        >
          <SettingsIcon className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          onClick={() => setCreateOpen(true)}
          title="New thread"
          className="shrink-0"
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col gap-0.5 p-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-lg px-3 py-2.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="mt-1.5 h-2.5 w-20" />
              </div>
            ))}
          </div>
        )}

        {threads && (
          <div className="flex flex-col gap-0.5 p-1">
            {threads.length === 0 && (
              <div className="text-muted-foreground px-3 py-8 text-center text-xs">
                No threads yet
              </div>
            )}

            {threads.map((thread) => {
              const isActive = thread.id === currentThreadId;
              const unread =
                !isActive && isUnread(thread.id, thread.updated_at);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    if (!isActive) navigate(`/threads/${thread.id}`);
                  }}
                  className={`group flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex w-full items-center gap-2">
                    <span
                      className={`flex min-w-0 flex-1 items-center gap-1 truncate text-[13px] ${
                        isActive || unread ? "font-medium" : ""
                      }`}
                    >
                      {unread && (
                        <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
                      )}
                      {thread.is_pinned && (
                        <PinIcon className="size-3 shrink-0 text-amber-500 dark:text-amber-400" />
                      )}
                      <span className="truncate">
                        {thread.title ?? "New thread"}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {timeAgo(thread.updated_at, true)}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
                    {thread.workspace_name ? (
                      <span className="flex items-center gap-1 truncate">
                        <FolderIcon className="size-2.5 shrink-0" />
                        <span className="truncate">
                          {thread.workspace_name}
                        </span>
                      </span>
                    ) : (
                      <span className="truncate opacity-50">No workspace</span>
                    )}
                    {thread.latest_message && (
                      <>
                        <span className="shrink-0 opacity-30">&middot;</span>
                        <span className="truncate opacity-60">
                          {thread.latest_message.status === "running"
                            ? "Running..."
                            : thread.latest_message.status === "queued"
                              ? "Queued"
                              : thread.latest_message.role === "user"
                                ? `You: ${thread.latest_message.content.replace(/\n/g, " ").trim()}`
                                : thread.latest_message.content
                                    .replace(/\n/g, " ")
                                    .trim() || "..."}
                        </span>
                      </>
                    )}
                    {thread.message_count > 0 && (
                      <>
                        <span className="shrink-0 opacity-30">&middot;</span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          <MessageSquareIcon className="size-2.5" />
                          {thread.message_count}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateThreadDialog
        machineId={machineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
