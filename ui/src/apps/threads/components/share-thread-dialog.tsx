import { CheckIcon, CopyIcon, LinkIcon, Loader2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

interface ShareThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  shareToken: string | null;
  onShareChange: (shareToken: string | null) => void;
}

export function ShareThreadDialog({
  open,
  onOpenChange,
  threadId,
  shareToken,
  onShareChange,
}: ShareThreadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareToken
    ? `${window.location.origin}/shared/${shareToken}`
    : null;

  const handleShare = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.threads.share(threadId);
      onShareChange(result.share_token);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create share link",
      );
    } finally {
      setLoading(false);
    }
  }, [threadId, onShareChange]);

  const handleUnshare = useCallback(async () => {
    setLoading(true);
    try {
      await api.threads.unshare(threadId);
      onShareChange(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove share link",
      );
    } finally {
      setLoading(false);
    }
  }, [threadId, onShareChange]);

  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-4" />
            Share Thread
          </DialogTitle>
          <DialogDescription>
            {shareToken
              ? "Anyone with this link can view this conversation in read-only mode."
              : "Create a public link to share this conversation. Anyone with the link can view it without signing in."}
          </DialogDescription>
        </DialogHeader>

        {shareToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl ?? ""}
                className="bg-muted flex-1 rounded-md border px-3 py-2 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </Button>
            </div>
            <div className="flex justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnshare}
                disabled={loading}
              >
                {loading && (
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                )}
                Remove Link
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleShare} disabled={loading}>
            {loading && (
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
            )}
            Create Share Link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
