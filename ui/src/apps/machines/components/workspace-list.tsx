import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { WorkspaceDialog } from "@/apps/machines/components/workspace-dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

interface WorkspaceListProps {
  machineId: string;
}

export function WorkspaceList({ machineId }: WorkspaceListProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", machineId],
    queryFn: () => api.workspaces.list(machineId),
    enabled: !!machineId,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["workspaces", machineId] });
  }, [queryClient, machineId]);

  async function handleDelete(id: string) {
    setDeleteError("");
    setDeletingId(id);
    try {
      await api.workspaces.delete(id);
      invalidate();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Failed to delete",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const editingWorkspace = workspaces?.find((w) => w.id === editId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Workspaces</h2>
          <p className="text-muted-foreground text-xs">
            Configure working directories for your threads.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Add
        </Button>
      </div>

      {deleteError && <p className="text-destructive text-xs">{deleteError}</p>}

      {workspaces?.length === 0 && (
        <div className="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm">
          No workspaces yet.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {workspaces?.map((ws) => (
          <div
            key={ws.id}
            className="flex items-start gap-3 rounded-2xl border px-4 py-3"
          >
            <FolderIcon className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{ws.name}</div>
              <div className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                {ws.working_directory}
              </div>
              {(ws.agent || ws.model) && (
                <div className="text-muted-foreground mt-1 text-xs">
                  {ws.agent && (
                    <span>{ws.agent === "claude" ? "Claude" : "Codex"}</span>
                  )}
                  {ws.agent && ws.model && <span> / </span>}
                  {ws.model && <span>{ws.model}</span>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditId(ws.id)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(ws.id)}
                disabled={deletingId === ws.id}
              >
                <TrashIcon className="text-destructive/70 size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <WorkspaceDialog
        machineId={machineId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={invalidate}
      />

      {/* Edit Dialog */}
      {editingWorkspace && (
        <WorkspaceDialog
          machineId={machineId}
          workspace={editingWorkspace}
          open={!!editId}
          onOpenChange={(open) => {
            if (!open) setEditId(null);
          }}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}
