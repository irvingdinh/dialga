import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckIcon,
  FolderIcon,
  MessageSquareIcon,
  MonitorIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from "lucide-react";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadListThread {
  id: string;
  machine_id: string;
  workspace_id: string | null;
  workspace_name: string | null;
  title: string | null;
  status: string;
  is_pinned: boolean;
  message_count: number;
  latest_message: {
    role: string;
    content: string;
    status: string;
  } | null;
  created_at: string;
  updated_at: string;
  // present in listAll responses
  machine_name?: string | null;
  machine_status?: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function timeAgo(dateStr: string, compact = false): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (compact) {
    if (seconds < 60) return "now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------

export function ThreadListSkeleton({
  showMachine = false,
}: {
  showMachine?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-2xl border px-4 py-3"
        >
          <Skeleton className="mt-0.5 size-4 rounded" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-48" />
            {showMachine && <Skeleton className="mt-1.5 h-3 w-32" />}
            <Skeleton className="mt-1.5 h-3 w-24" />
          </div>
          <Skeleton className="mt-0.5 h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function LatestMessagePreview({
  message,
}: {
  message: { role: string; content: string; status: string };
}) {
  if (message.role === "assistant") {
    if (message.status === "running") {
      return <span className="italic">Running...</span>;
    }
    if (message.status === "queued") {
      return <span className="italic">Waiting in queue...</span>;
    }
    if (message.status === "error") {
      return <span className="text-red-500 dark:text-red-400">Error</span>;
    }
    if (message.status === "timed_out") {
      return (
        <span className="text-amber-600 dark:text-amber-400">Timed out</span>
      );
    }
    if (message.status === "cancelled") {
      return <span className="italic">Cancelled</span>;
    }
  }

  const prefix = message.role === "user" ? "You: " : "";
  const text = message.content.replace(/\n/g, " ").trim();
  return (
    <span>
      {prefix && <span className="text-muted-foreground/70">{prefix}</span>}
      {text || <span className="italic">Empty message</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ThreadListItem
// ---------------------------------------------------------------------------

interface ThreadListItemProps {
  thread: ThreadListThread;
  isUnread: boolean;
  isSelectMode: boolean;
  isSelected: boolean;
  isDeleting: boolean;
  showMachine?: boolean;
  onNavigate: () => void;
  onToggleSelect: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export function ThreadListItem({
  thread,
  isUnread,
  isSelectMode,
  isSelected,
  isDeleting,
  showMachine = false,
  onNavigate,
  onToggleSelect,
  onTogglePin,
  onToggleArchive,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}: ThreadListItemProps) {
  if (isDeleting) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm text-red-800 dark:text-red-400">
          Delete this thread and all its messages?
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancelDelete}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirmDelete}>
            Delete
          </Button>
        </div>
      </div>
    );
  }

  // Build metadata items
  const metadataItems: React.ReactNode[] = [];

  if (thread.status === "archived") {
    metadataItems.push(
      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
        archived
      </Badge>,
    );
  }

  if (showMachine && thread.machine_name) {
    metadataItems.push(
      <span className="flex items-center gap-1">
        <MonitorIcon className="size-3" />
        <span className="max-w-[120px] truncate">{thread.machine_name}</span>
        <span
          className={`size-1.5 rounded-full ${
            thread.machine_status === "online"
              ? "bg-emerald-500"
              : "bg-muted-foreground/30"
          }`}
        />
      </span>,
    );
  }

  if (thread.workspace_name) {
    metadataItems.push(
      <span className="flex items-center gap-1">
        <FolderIcon className="size-3" />
        {thread.workspace_name}
      </span>,
    );
  }

  if (thread.message_count > 0) {
    metadataItems.push(
      <span>
        {thread.message_count} {thread.message_count === 1 ? "msg" : "msgs"}
      </span>,
    );
  }

  metadataItems.push(<span>{timeAgo(thread.updated_at)}</span>);

  return (
    <div
      className={`group hover:bg-muted/50 flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${thread.status === "archived" ? "opacity-60" : ""} ${isSelected ? "border-blue-500/50 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-950/20" : ""}`}
    >
      {isSelectMode ? (
        <button onClick={onToggleSelect} className="mt-0.5 shrink-0">
          <div
            className={`flex size-4 items-center justify-center rounded border transition-colors ${
              isSelected
                ? "border-blue-500 bg-blue-500 text-white"
                : "border-input hover:border-foreground/40"
            }`}
          >
            {isSelected && <CheckIcon className="size-3" />}
          </div>
        </button>
      ) : null}
      <button
        onClick={() => {
          if (isSelectMode) {
            onToggleSelect();
          } else {
            onNavigate();
          }
        }}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        {!isSelectMode &&
          (thread.is_pinned ? (
            <PinIcon className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          ) : (
            <MessageSquareIcon className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
          ))}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-sm font-medium">
            {isUnread && (
              <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
            )}
            <span className="truncate">{thread.title ?? "New thread"}</span>
          </div>
          {thread.latest_message && (
            <div className="text-muted-foreground mt-0.5 truncate text-xs">
              <LatestMessagePreview message={thread.latest_message} />
            </div>
          )}
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {metadataItems.map((item, i) => (
              <Fragment key={i}>
                {i > 0 && <span>·</span>}
                {item}
              </Fragment>
            ))}
          </div>
        </div>
      </button>
      {!isSelectMode && (
        <div className="mt-0.5 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={`hover:text-foreground ${thread.is_pinned ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground/40"}`}
            title={thread.is_pinned ? "Unpin thread" : "Pin thread"}
          >
            {thread.is_pinned ? (
              <PinOffIcon className="size-4" />
            ) : (
              <PinIcon className="size-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive();
            }}
            className="text-muted-foreground/40 hover:text-foreground"
            title={
              thread.status === "archived"
                ? "Unarchive thread"
                : "Archive thread"
            }
          >
            {thread.status === "archived" ? (
              <ArchiveRestoreIcon className="size-4" />
            ) : (
              <ArchiveIcon className="size-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartDelete();
            }}
            className="text-muted-foreground/40 hover:text-destructive"
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelectAllBar
// ---------------------------------------------------------------------------

interface SelectAllBarProps {
  selectedCount: number;
  totalCount: number;
  onToggleSelectAll: () => void;
}

export function SelectAllBar({
  selectedCount,
  totalCount,
  onToggleSelectAll,
}: SelectAllBarProps) {
  const allSelected = selectedCount === totalCount;
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={onToggleSelectAll}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
      >
        <div
          className={`flex size-4 items-center justify-center rounded border transition-colors ${
            allSelected
              ? "border-blue-500 bg-blue-500 text-white"
              : "border-input"
          }`}
        >
          {allSelected && <CheckIcon className="size-3" />}
        </div>
        {allSelected ? "Deselect all" : "Select all"}
      </button>
      <span className="text-muted-foreground text-xs">
        {selectedCount} selected
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FloatingActionBar
// ---------------------------------------------------------------------------

interface FloatingActionBarProps {
  selectedCount: number;
  hasSelectedActive: boolean;
  hasSelectedArchived: boolean;
  confirmBulkDelete: boolean;
  bulkActionPending: boolean;
  onBulkAction: (action: "archive" | "unarchive" | "delete") => void;
  onCancelBulkDelete: () => void;
}

export function FloatingActionBar({
  selectedCount,
  hasSelectedActive,
  hasSelectedArchived,
  confirmBulkDelete,
  bulkActionPending,
  onBulkAction,
  onCancelBulkDelete,
}: FloatingActionBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="bg-background pointer-events-auto flex items-center gap-2 rounded-2xl border px-4 py-2.5 shadow-lg">
        {confirmBulkDelete ? (
          <>
            <span className="text-sm text-red-600 dark:text-red-400">
              Delete {selectedCount} thread
              {selectedCount !== 1 ? "s" : ""}?
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelBulkDelete}
              disabled={bulkActionPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkAction("delete")}
              disabled={bulkActionPending}
            >
              {bulkActionPending ? "Deleting..." : "Delete"}
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground mr-1 text-sm">
              {selectedCount} selected
            </span>
            {hasSelectedActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction("archive")}
                disabled={bulkActionPending}
                className="gap-1.5"
              >
                <ArchiveIcon className="size-3.5" />
                Archive
              </Button>
            )}
            {hasSelectedArchived && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction("unarchive")}
                disabled={bulkActionPending}
                className="gap-1.5"
              >
                <ArchiveRestoreIcon className="size-3.5" />
                Unarchive
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkAction("delete")}
              disabled={bulkActionPending}
              className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
