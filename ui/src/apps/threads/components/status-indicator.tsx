import {
  CircleXIcon,
  Loader2Icon,
  OctagonAlertIcon,
  RotateCwIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function StatusIndicator({
  status,
  onCancel,
  onRetry,
}: {
  status: string;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  switch (status) {
    case "queued":
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-2 text-xs">
          <Loader2Icon className="size-3 animate-spin" />
          <span>Waiting in queue...</span>
          {onCancel && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onCancel}
              className="text-muted-foreground ml-auto"
            >
              <CircleXIcon data-icon="inline-start" />
              Cancel
            </Button>
          )}
        </div>
      );
    case "running":
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
          <Loader2Icon className="size-3 animate-spin" />
          <span>Running...</span>
          {onCancel && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onCancel}
              className="text-muted-foreground ml-auto"
            >
              <CircleXIcon data-icon="inline-start" />
              Cancel
            </Button>
          )}
        </div>
      );
    case "cancelled":
      return (
        <div className="text-muted-foreground flex items-center gap-1.5 py-1 text-xs">
          <CircleXIcon className="size-3" />
          <span>Cancelled</span>
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-1.5 py-1 text-xs text-red-600 dark:text-red-400">
          <OctagonAlertIcon className="size-3" />
          <span>Error</span>
          {onRetry && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRetry}
              className="text-muted-foreground ml-auto"
            >
              <RotateCwIcon data-icon="inline-start" />
              Retry
            </Button>
          )}
        </div>
      );
    case "timed_out":
      return (
        <div className="flex items-center gap-1.5 py-1 text-xs text-amber-600 dark:text-amber-400">
          <OctagonAlertIcon className="size-3" />
          <span>Timed out</span>
          {onRetry && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRetry}
              className="text-muted-foreground ml-auto"
            >
              <RotateCwIcon data-icon="inline-start" />
              Retry
            </Button>
          )}
        </div>
      );
    default:
      return null;
  }
}
