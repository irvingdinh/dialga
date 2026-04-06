import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, FolderIcon, PlusIcon } from "lucide-react";
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

interface CreateThreadDialogProps {
  machineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (threadId: string) => void;
}

export function CreateThreadDialog({
  machineId,
  open,
  onOpenChange,
  onCreated,
}: CreateThreadDialogProps) {
  const queryClient = useQueryClient();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline workspace creation state
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsWorkingDir, setWsWorkingDir] = useState("");
  const [wsError, setWsError] = useState("");
  const [wsSubmitting, setWsSubmitting] = useState(false);

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", machineId],
    queryFn: () => api.workspaces.list(machineId),
    enabled: open,
  });

  function resetWorkspaceForm() {
    setCreatingWorkspace(false);
    setWsName("");
    setWsWorkingDir("");
    setWsError("");
  }

  function reset() {
    setSelectedWorkspace(null);
    setError("");
    resetWorkspaceForm();
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleCreate() {
    setError("");
    setSubmitting(true);

    try {
      const thread = await api.threads.create(
        machineId,
        selectedWorkspace ? { workspace_id: selectedWorkspace } : undefined,
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
    if (!wsName.trim() || !wsWorkingDir.trim()) return;
    setWsError("");
    setWsSubmitting(true);

    try {
      const ws = await api.workspaces.create(machineId, {
        name: wsName.trim(),
        working_directory: wsWorkingDir,
      });
      await queryClient.invalidateQueries({
        queryKey: ["workspaces", machineId],
      });
      setSelectedWorkspace(ws.id);
      resetWorkspaceForm();
    } catch (err) {
      setWsError(
        err instanceof ApiError ? err.message : "Failed to create workspace",
      );
    } finally {
      setWsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {creatingWorkspace ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetWorkspaceForm}
                  className="text-muted-foreground hover:text-foreground -ml-1 rounded-md p-1 transition-colors"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
                New Workspace
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-ws-name">Name</Label>
                <Input
                  id="new-ws-name"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder='e.g. "My Project", "API Server"'
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Working Directory</Label>
                <FolderPicker
                  machineId={machineId}
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
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New Thread</DialogTitle>
              <DialogDescription>
                Select a workspace or start a one-off conversation.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              {/* No workspace option */}
              <button
                type="button"
                onClick={() => setSelectedWorkspace(null)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedWorkspace === null
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                  <FolderIcon className="text-muted-foreground size-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">No workspace</div>
                  <div className="text-muted-foreground text-xs">
                    Temporary folder, nothing persisted
                  </div>
                </div>
              </button>

              {/* Workspace options */}
              {workspaces?.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedWorkspace(ws.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedWorkspace === ws.id
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
                </button>
              ))}

              {/* Create workspace option */}
              <button
                type="button"
                onClick={() => setCreatingWorkspace(true)}
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
      </DialogContent>
    </Dialog>
  );
}
