import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  DownloadIcon,
  FolderIcon,
  FolderOpenIcon,
  GitBranchIcon,
  InfoIcon,
  LinkIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ThreadViewHeaderProps {
  thread:
    | {
        title: string | null;
        status: string;
        is_pinned: boolean;
        share_token: string | null;
        workspace_name: string | null;
        working_directory: string | null;
      }
    | undefined;
  threadLoading: boolean;
  // Title editing
  isEditingTitle: boolean;
  editTitle: string;
  titleInputRef: RefObject<HTMLInputElement | null>;
  onStartEditTitle: () => void;
  onSaveTitle: () => void;
  onCancelEditTitle: () => void;
  onEditTitleChange: (value: string) => void;
  // Navigation
  onBack: () => void;
  onOpenWorkspaceSelector: () => void;
  // Panel toggles
  isFileBrowserOpen: boolean;
  isGitPanelOpen: boolean;
  onToggleFileBrowser: () => void;
  onToggleGitPanel: () => void;
  // Search, starred filter, context & usage
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  isStarredFilterActive: boolean;
  onToggleStarredFilter: () => void;
  isContextOpen: boolean;
  onToggleContext: () => void;
  isUsageOpen: boolean;
  onToggleUsage: () => void;
  // Share
  onOpenShare: () => void;
  // Actions
  onExport: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onStartDelete: () => void;
}

export function ThreadViewHeader({
  thread,
  threadLoading,
  isEditingTitle,
  editTitle,
  titleInputRef,
  onStartEditTitle,
  onSaveTitle,
  onCancelEditTitle,
  onEditTitleChange,
  onBack,
  onOpenWorkspaceSelector,
  isFileBrowserOpen,
  isGitPanelOpen,
  onToggleFileBrowser,
  onToggleGitPanel,
  isSearchOpen,
  onToggleSearch,
  isStarredFilterActive,
  onToggleStarredFilter,
  isContextOpen,
  onToggleContext,
  isUsageOpen,
  onToggleUsage,
  onOpenShare,
  onExport,
  onTogglePin,
  onToggleArchive,
  onStartDelete,
}: ThreadViewHeaderProps) {
  return (
    <div className="border-b px-4 py-3">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          {threadLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveTitle();
                if (e.key === "Escape") onCancelEditTitle();
              }}
              onBlur={onSaveTitle}
              className="bg-muted w-full rounded-md border px-2 py-0.5 text-sm font-semibold tracking-tight outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
            />
          ) : (
            <button
              type="button"
              onClick={onStartEditTitle}
              className="group flex max-w-full items-center gap-1.5"
            >
              <h1 className="truncate text-sm font-semibold tracking-tight">
                {thread?.title ?? "New thread"}
              </h1>
              <PencilIcon className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          {!threadLoading && (
            <button
              type="button"
              onClick={onOpenWorkspaceSelector}
              className="text-muted-foreground group flex max-w-full items-center gap-1 truncate text-[11px] hover:underline"
            >
              <FolderIcon className="size-2.5 shrink-0" />
              <span className="truncate">
                {thread?.workspace_name ?? "No workspace"}
              </span>
            </button>
          )}
        </div>
        {!threadLoading && (
          <div className="flex shrink-0 items-center gap-0.5">
            {thread?.working_directory && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleFileBrowser}
                  className={`shrink-0 ${isFileBrowserOpen ? "text-foreground" : "text-muted-foreground"}`}
                  title="Browse workspace files"
                >
                  <FolderOpenIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleGitPanel}
                  className={`shrink-0 ${isGitPanelOpen ? "text-foreground" : "text-muted-foreground"}`}
                  title="Git changes"
                >
                  <GitBranchIcon className="size-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSearch}
              className={`shrink-0 ${isSearchOpen ? "text-foreground" : "text-muted-foreground"}`}
              title="Search messages"
            >
              <SearchIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleStarredFilter}
              className={`shrink-0 ${isStarredFilterActive ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"}`}
              title={
                isStarredFilterActive
                  ? "Show all messages"
                  : "Show starred messages"
              }
            >
              <StarIcon
                className="size-4"
                fill={isStarredFilterActive ? "currentColor" : "none"}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleContext}
              className={`shrink-0 ${isContextOpen ? "text-foreground" : "text-muted-foreground"}`}
              title="Workspace context"
            >
              <InfoIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleUsage}
              className={`shrink-0 ${isUsageOpen ? "text-foreground" : "text-muted-foreground"}`}
              title="Thread usage stats"
            >
              <BarChart3Icon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onExport}
              className="text-muted-foreground shrink-0"
              title="Export as Markdown"
            >
              <DownloadIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onOpenShare}
              className={`shrink-0 ${thread?.share_token ? "text-blue-500 dark:text-blue-400" : "text-muted-foreground"}`}
              title={thread?.share_token ? "Manage share link" : "Share thread"}
            >
              <LinkIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onTogglePin}
              className={`shrink-0 ${thread?.is_pinned ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"}`}
              title={thread?.is_pinned ? "Unpin thread" : "Pin thread"}
            >
              {thread?.is_pinned ? (
                <PinOffIcon className="size-4" />
              ) : (
                <PinIcon className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleArchive}
              className="text-muted-foreground shrink-0"
              title={
                thread?.status === "archived"
                  ? "Unarchive thread"
                  : "Archive thread"
              }
            >
              {thread?.status === "archived" ? (
                <ArchiveRestoreIcon className="size-4" />
              ) : (
                <ArchiveIcon className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onStartDelete}
              className="text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
