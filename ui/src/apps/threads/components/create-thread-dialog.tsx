import { useQuery } from "@tanstack/react-query";
import { FolderIcon } from "lucide-react";
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
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", machineId],
    queryFn: () => api.workspaces.list(machineId),
    enabled: open,
  });

  function reset() {
    setSelectedWorkspace(null);
    setError("");
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
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
                <div className="truncate text-sm font-medium">{ws.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {ws.working_directory}
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter className="mt-2">
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create Thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
