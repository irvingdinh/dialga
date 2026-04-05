import { CheckIcon, CopyIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

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

interface CreateMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateMachineDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateMachineDialogProps) {
  const [step, setStep] = useState<"form" | "token">("form");
  const [name, setName] = useState("");
  const [agent, setAgent] = useState("claude");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);

  function reset() {
    setStep("form");
    setName("");
    setAgent("claude");
    setError("");
    setToken("");
    setCopied(false);
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
      const result = await api.machines.create({
        name,
        default_agent: agent,
      });
      setToken(result.token);
      setStep("token");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  const installCommand = `npx @dialga/agent@latest --token ${token}`;

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {step === "form" ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>New Machine</DialogTitle>
              <DialogDescription>
                Create a machine to connect your development environment.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="machine-name">Name</Label>
                <Input
                  id="machine-name"
                  placeholder='e.g. "MacBook Pro", "Dev Server"'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
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

              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Machine"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Machine Created</DialogTitle>
              <DialogDescription>
                Copy the install command below. The token will only be shown
                once.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Install Command
                </Label>
                <div className="bg-muted flex items-center gap-2 rounded-xl p-3">
                  <code className="flex-1 overflow-x-auto text-xs break-all">
                    {installCommand}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyToClipboard(installCommand)}
                  >
                    {copied ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  API Token
                </Label>
                <div className="bg-muted flex items-center gap-2 rounded-xl p-3">
                  <code className="flex-1 overflow-x-auto text-xs break-all">
                    {token}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyToClipboard(token)}
                  >
                    {copied ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
