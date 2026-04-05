import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, MonitorIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/apps/auth/auth-provider";
import { CreateMachineDialog } from "@/apps/machines/components/create-machine-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

function MachineListSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border px-4 py-3"
        >
          <Skeleton className="size-2 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function MachinesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: machines,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["machines"],
    queryFn: api.machines.list,
  });

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
            <button
              key={machine.id}
              onClick={() => navigate(`/machines/${machine.id}/threads`)}
              className="hover:bg-muted/50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors"
            >
              <div
                className={`size-2 rounded-full ${
                  machine.status === "online"
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {machine.name}
                </div>
                <div className="text-muted-foreground text-xs">
                  {machine.default_agent}
                  {machine.default_model ? ` / ${machine.default_model}` : ""}
                </div>
              </div>
              <Badge
                variant={machine.status === "online" ? "secondary" : "outline"}
                className="shrink-0"
              >
                {machine.status}
              </Badge>
            </button>
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
