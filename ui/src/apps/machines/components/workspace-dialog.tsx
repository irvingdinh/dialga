import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";

interface Workspace {
  id: string;
  name: string;
  working_directory: string;
  custom_instruction: string | null;
  agent: string | null;
  model: string | null;
}

interface WorkspaceDialogProps {
  machineId: string;
  workspace?: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function WorkspaceDialog({
  machineId,
  workspace,
  open,
  onOpenChange,
  onSaved,
}: WorkspaceDialogProps) {
  const isEditing = !!workspace;

  const [name, setName] = useState("");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [agent, setAgent] = useState<string>("");
  const [model, setModel] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setWorkingDirectory(workspace.working_directory);
      setCustomInstruction(workspace.custom_instruction ?? "");
      setAgent(workspace.agent ?? "");
      setModel(workspace.model ?? "");
    }
  }, [workspace]);

  function reset() {
    setName("");
    setWorkingDirectory("");
    setCustomInstruction("");
    setAgent("");
    setModel("");
    setError("");
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isEditing) {
        await api.workspaces.update(workspace.id, {
          name,
          working_directory: workingDirectory,
          custom_instruction: customInstruction || undefined,
          agent: agent || undefined,
          model: model || undefined,
        });
      } else {
        await api.workspaces.create(machineId, {
          name,
          working_directory: workingDirectory,
          custom_instruction: customInstruction || undefined,
          agent: agent || undefined,
          model: model || undefined,
        });
      }
      onSaved();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Workspace" : "New Workspace"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "My Project", "API Server"'
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-dir">Working Directory</Label>
              <Input
                id="ws-dir"
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                placeholder="/home/user/projects/myapp"
                required
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                Absolute path on the machine.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-instruction">
                Custom Instruction{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="ws-instruction"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="Prepended to every prompt for this workspace..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Agent Override{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "", label: "Default" },
                    { value: "claude", label: "Claude Code" },
                    { value: "codex", label: "Codex CLI" },
                  ] as const
                ).map((a) => (
                  <Button
                    key={a.value}
                    type="button"
                    variant={agent === a.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAgent(a.value)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-model">
                Model Override{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="ws-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. sonnet, haiku, o3-mini"
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
