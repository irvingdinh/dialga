import { CheckIcon, CopyIcon } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface RegenerateTokenDialogProps {
  machineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegenerateTokenDialog({
  machineId,
  open,
  onOpenChange,
}: RegenerateTokenDialogProps) {
  const [step, setStep] = useState<"confirm" | "token">("confirm");
  const [token, setToken] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  function reset() {
    setStep("confirm");
    setToken("");
    setCopied(false);
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await api.machines.regenerateToken(machineId);
      setToken(result.token);
      setStep("token");
    } catch {
      // stay on confirm step
    } finally {
      setRegenerating(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const installCommand = `npx @dialga/agent@latest --token ${token}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Regenerate API Token?</DialogTitle>
              <DialogDescription>
                The current token will be invalidated immediately. Any connected
                agent will be disconnected and must be restarted with the new
                token.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New Token Generated</DialogTitle>
              <DialogDescription>
                Copy the token below. It will only be shown once.
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
