import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  KeyRoundIcon,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { RegenerateTokenDialog } from "@/apps/machines/components/regenerate-token-dialog";
import { WorkspaceList } from "@/apps/machines/components/workspace-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";

function SettingsSkeleton() {
  return (
    <>
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="text-muted-foreground mt-4 flex flex-col gap-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </>
  );
}

export default function MachineSettingsPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: machine,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["machine", machineId],
    queryFn: () => api.machines.get(machineId!),
    enabled: !!machineId,
  });

  const [name, setName] = useState("");
  const [agent, setAgent] = useState("claude");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [regenOpen, setRegenOpen] = useState(false);

  // Sync form from server data
  useEffect(() => {
    if (machine) {
      setName(machine.name);
      setAgent(machine.default_agent);
      setModel(machine.default_model ?? "");
    }
  }, [machine]);

  const isDirty =
    machine &&
    (name !== machine.name ||
      agent !== machine.default_agent ||
      model !== (machine.default_model ?? ""));

  const handleSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!machineId || !isDirty) return;
      setError("");
      setSaving(true);
      try {
        await api.machines.update(machineId, {
          name,
          default_agent: agent,
          default_model: model || undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["machine", machineId] });
        queryClient.invalidateQueries({ queryKey: ["machines"] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [machineId, isDirty, name, agent, model, queryClient],
  );

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
        // ignore
      }
    });

    return () => evtSource.close();
  }, [machineId, queryClient]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/machines/${machineId}/threads`)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
            {machine && (
              <div
                className={`size-2 rounded-full ${
                  machine.status === "online"
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30"
                }`}
              />
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {isLoading ? (
              <Skeleton className="mt-0.5 inline-block h-3 w-24" />
            ) : (
              (machine?.name ?? "Machine not found")
            )}
          </p>
        </div>
        {machine && (
          <Badge
            variant={machine.status === "online" ? "secondary" : "outline"}
            className="shrink-0"
          >
            {machine.status}
          </Badge>
        )}
      </div>

      {/* Loading */}
      {isLoading && <SettingsSkeleton />}

      {/* Error */}
      {isError && !isLoading && (
        <div className="mt-6 flex flex-col items-center py-16 text-center">
          <AlertCircleIcon className="text-muted-foreground/40 mb-3 size-8" />
          <p className="text-muted-foreground text-sm">
            Failed to load machine settings.
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

      {/* Content */}
      {machine && (
        <>
          {/* Machine Info Form */}
          <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="machine-name">Name</Label>
              <Input
                id="machine-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Machine name"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Default Agent</Label>
              <div className="flex gap-2">
                {(["claude", "codex"] as const).map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={agent === a ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAgent(a)}
                  >
                    {a === "claude" ? "Claude Code" : "Codex CLI"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="machine-model">Default Model</Label>
              <Input
                id="machine-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. sonnet, haiku, o3-mini"
              />
              <p className="text-muted-foreground text-xs">
                Free text. Leave empty to use the agent's default.
              </p>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              type="submit"
              disabled={!isDirty || saving}
              className="w-full"
            >
              {saved ? (
                <>
                  <CheckIcon className="size-4" />
                  Saved
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>

          {/* Machine Info */}
          <div className="text-muted-foreground mt-4 flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span>Last seen</span>
              <span>{formatDate(machine.last_seen_at ?? null)}</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span>{formatDate(machine.created_at ?? null)}</span>
            </div>
          </div>

          <Separator className="my-6" />

          {/* API Token */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">API Token</h2>
                <p className="text-muted-foreground text-xs">
                  Used by the agent to connect to this machine.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegenOpen(true)}
              className="w-full"
            >
              <KeyRoundIcon className="size-4" />
              Regenerate Token
            </Button>
          </div>

          <Separator className="my-6" />

          {/* Workspaces */}
          <WorkspaceList machineId={machineId!} />

          <Separator className="my-6" />

          {/* Danger Zone */}
          <div className="flex flex-col gap-3">
            <h2 className="text-destructive text-sm font-semibold">
              Danger Zone
            </h2>
            <DeleteMachineButton
              machineId={machineId!}
              onDeleted={() => navigate("/machines")}
            />
          </div>

          <div className="h-8" />

          <RegenerateTokenDialog
            machineId={machineId!}
            open={regenOpen}
            onOpenChange={setRegenOpen}
          />
        </>
      )}
    </div>
  );
}

function DeleteMachineButton({
  machineId,
  onDeleted,
}: {
  machineId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.machines.delete(machineId);
      onDeleted();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete machine";
      toast.error(message);
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-destructive border-destructive/30 hover:bg-destructive/10 w-full"
        onClick={() => setConfirming(true)}
      >
        Delete Machine
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-800">
        This will delete the machine and all its threads. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? "Deleting..." : "Confirm Delete"}
        </Button>
      </div>
    </div>
  );
}
