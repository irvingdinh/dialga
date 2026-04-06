import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CheckIcon,
  FolderIcon,
  MonitorIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";

import { FolderPicker } from "@/apps/machines/components/folder-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

interface QuickNewThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (threadId: string) => void;
}

export function QuickNewThreadDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickNewThreadDialogProps) {
  const queryClient = useQueryClient();

  // Step 1: machine, Step 2: workspace, Step 3: inline workspace creation
  const [step, setStep] = useState<"machine" | "workspace" | "create-ws">(
    "machine",
  );
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(
    null,
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline workspace creation state
  const [wsName, setWsName] = useState("");
  const [wsWorkingDir, setWsWorkingDir] = useState("");
  const [wsError, setWsError] = useState("");
  const [wsSubmitting, setWsSubmitting] = useState(false);

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: api.machines.list,
    enabled: open,
    staleTime: 30_000,
  });

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", selectedMachineId],
    queryFn: () => api.workspaces.list(selectedMachineId!),
    enabled: open && !!selectedMachineId,
  });

  function reset() {
    setStep("machine");
    setSelectedMachineId(null);
    setSelectedWorkspaceId(null);
    setError("");
    setWsName("");
    setWsWorkingDir("");
    setWsError("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleSelectMachine(machineId: string) {
    setSelectedMachineId(machineId);
    setSelectedWorkspaceId(null);
    setError("");
    setStep("workspace");
  }

  function handleBackToMachines() {
    setStep("machine");
    setSelectedMachineId(null);
    setSelectedWorkspaceId(null);
    setError("");
  }

  async function handleCreate() {
    if (!selectedMachineId) return;
    setError("");
    setSubmitting(true);

    try {
      const thread = await api.threads.create(
        selectedMachineId,
        selectedWorkspaceId ? { workspace_id: selectedWorkspaceId } : undefined,
      );
      handleOpenChange(false);
      onCreated(thread.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!selectedMachineId || !wsName.trim() || !wsWorkingDir.trim()) return;
    setWsError("");
    setWsSubmitting(true);

    try {
      const ws = await api.workspaces.create(selectedMachineId, {
        name: wsName.trim(),
        working_directory: wsWorkingDir,
      });
      await queryClient.invalidateQueries({
        queryKey: ["workspaces", selectedMachineId],
      });
      setSelectedWorkspaceId(ws.id);
      setWsName("");
      setWsWorkingDir("");
      setWsError("");
      setStep("workspace");
    } catch (err) {
      setWsError(
        err instanceof ApiError ? err.message : "Failed to create workspace",
      );
    } finally {
      setWsSubmitting(false);
    }
  }

  const selectedMachine = machines?.find((m) => m.id === selectedMachineId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {step === "machine" && (
          <>
            <DialogHeader>
              <DialogTitle>New Thread</DialogTitle>
              <DialogDescription>
                Select a machine to start a new conversation.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              {machines?.map((m) => {
                const isOnline = m.status === "online";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMachine(m.id)}
                    className="hover:bg-muted/50 flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
                  >
                    <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                      <MonitorIcon className="text-muted-foreground size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{m.name}</span>
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                        />
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {m.default_agent === "claude"
                          ? "Claude Code"
                          : "Codex CLI"}
                        {m.default_model ? ` · ${m.default_model}` : ""}
                      </div>
                    </div>
                  </button>
                );
              })}

              {machines?.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No machines yet. Create one first.
                </p>
              )}
            </div>
          </>
        )}

        {step === "workspace" && selectedMachineId && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToMachines}
                  className="text-muted-foreground hover:text-foreground -ml-1 rounded-md p-1 transition-colors"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
                {selectedMachine?.name ?? "Select Workspace"}
              </DialogTitle>
              <DialogDescription>
                Choose a workspace or start a one-off conversation.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              {/* No workspace option */}
              <button
                type="button"
                onClick={() => setSelectedWorkspaceId(null)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedWorkspaceId === null
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                  <FolderIcon className="text-muted-foreground size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">No workspace</div>
                  <div className="text-muted-foreground text-xs">
                    Temporary folder, nothing persisted
                  </div>
                </div>
                {selectedWorkspaceId === null && (
                  <CheckIcon className="text-primary size-4 shrink-0" />
                )}
              </button>

              {/* Workspace options */}
              {workspaces?.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedWorkspaceId === ws.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                    <FolderIcon className="text-muted-foreground size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {ws.name}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {ws.working_directory}
                    </div>
                  </div>
                  {selectedWorkspaceId === ws.id && (
                    <CheckIcon className="text-primary size-4 shrink-0" />
                  )}
                </button>
              ))}

              {/* Create workspace option */}
              <button
                type="button"
                onClick={() => setStep("create-ws")}
                className="hover:bg-muted/50 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors"
              >
                <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                  <PlusIcon className="text-muted-foreground size-4" />
                </div>
                <div className="text-muted-foreground text-sm font-medium">
                  Create workspace...
                </div>
              </button>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <DialogFooter className="mt-2">
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Creating..." : "Create Thread"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "create-ws" && selectedMachineId && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWsName("");
                    setWsWorkingDir("");
                    setWsError("");
                    setStep("workspace");
                  }}
                  className="text-muted-foreground hover:text-foreground -ml-1 rounded-md p-1 transition-colors"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
                New Workspace
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quick-ws-name">Name</Label>
                <Input
                  id="quick-ws-name"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder='e.g. "My Project", "API Server"'
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Working Directory</Label>
                <FolderPicker
                  machineId={selectedMachineId}
                  value={wsWorkingDir}
                  onChange={(path) => setWsWorkingDir(path)}
                />
              </div>

              {wsError && <p className="text-destructive text-sm">{wsError}</p>}
            </div>

            <DialogFooter className="mt-2">
              <Button
                onClick={handleCreateWorkspace}
                disabled={
                  wsSubmitting || !wsName.trim() || !wsWorkingDir.trim()
                }
              >
                {wsSubmitting ? "Creating..." : "Create Workspace"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
