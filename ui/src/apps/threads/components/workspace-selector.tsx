import { useQuery } from "@tanstack/react-query";
import { CheckIcon, FolderIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";

interface WorkspaceSelectorProps {
  machineId: string;
  threadId: string;
  currentWorkspaceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function WorkspaceSelector({
  machineId,
  threadId,
  currentWorkspaceId,
  open,
  onOpenChange,
  onChanged,
}: WorkspaceSelectorProps) {
  const [selected, setSelected] = useState<string | null>(currentWorkspaceId);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", machineId],
    queryFn: () => api.workspaces.list(machineId),
    enabled: open,
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setSelected(currentWorkspaceId);
    }
    setError("");
    onOpenChange(next);
  }

  async function handleSave() {
    if (selected === currentWorkspaceId) {
      handleOpenChange(false);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.threads.update(threadId, { workspace_id: selected });
      handleOpenChange(false);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to change workspace",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const hasChanged = selected !== currentWorkspaceId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Workspace</DialogTitle>
          <DialogDescription>
            Select a workspace for this thread or remove the current assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {/* No workspace option */}
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              selected === null
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
            {selected === null && currentWorkspaceId !== null && (
              <CheckIcon className="text-primary size-4 shrink-0" />
            )}
          </button>

          {/* Workspace options */}
          {workspaces?.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => setSelected(ws.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                selected === ws.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                <FolderIcon className="text-muted-foreground size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{ws.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {ws.working_directory}
                </div>
              </div>
              {selected === ws.id && selected !== currentWorkspaceId && (
                <CheckIcon className="text-primary size-4 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter className="mt-2">
          <Button onClick={handleSave} disabled={submitting || !hasChanged}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
