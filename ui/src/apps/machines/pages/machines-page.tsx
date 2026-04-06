import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  InboxIcon,
  MessageSquarePlusIcon,
  MonitorIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/apps/auth/auth-provider";
import { ActiveTasks } from "@/apps/machines/components/active-tasks";
import { CreateMachineDialog } from "@/apps/machines/components/create-machine-dialog";
import {
  MachineCard,
  MachineListSkeleton,
} from "@/apps/machines/components/machine-card";
import { RecentActivity } from "@/apps/machines/components/recent-activity";
import { UsageSummary } from "@/apps/machines/components/usage-summary";
import { useUnreadCounts } from "@/apps/machines/hooks/use-unread-counts";
import { QuickNewThreadDialog } from "@/components/quick-new-thread-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

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
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/threads")}
            title="All Threads"
          >
            <InboxIcon className="size-4" />
          </Button>
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
