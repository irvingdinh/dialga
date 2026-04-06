import { ArchiveIcon, WifiOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type DeleteState = "idle" | "confirming" | "deleting";

interface ThreadBannersProps {
  deleteState: DeleteState;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  isArchived: boolean;
  onUnarchive: () => void;
  isOffline: boolean;
}

export function ThreadBanners({
  deleteState,
  onCancelDelete,
  onConfirmDelete,
  isArchived,
  onUnarchive,
  isOffline,
}: ThreadBannersProps) {
  return (
    <>
      {/* Delete Confirmation Banner */}
      {deleteState !== "idle" && (
        <div className="border-b px-4 py-2">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-sm text-red-800 dark:text-red-400">
              Delete this thread and all its messages?
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelDelete}
                disabled={deleteState === "deleting"}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onConfirmDelete}
                disabled={deleteState === "deleting"}
              >
                {deleteState === "deleting" ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Banner */}
      {isArchived && (
        <div className="border-b px-4 py-2">
          <div className="text-muted-foreground mx-auto flex max-w-lg items-center justify-between rounded-xl border px-3 py-2 text-xs">
            <span className="flex items-center gap-2">
              <ArchiveIcon className="size-3.5 shrink-0" />
              This thread is archived.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnarchive}
              className="h-auto px-2 py-0.5 text-xs"
            >
              Unarchive
            </Button>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div className="border-b px-4 py-2">
          <div className="mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
            <WifiOffIcon className="size-3.5 shrink-0" />
            <span>
              Machine is offline. Messages will be processed when it reconnects.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
