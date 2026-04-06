import {
  CheckIcon,
  FileMinusIcon,
  FilePlusIcon,
  FileQuestionIcon,
  LoaderIcon,
  PencilIcon,
  SendIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export interface DeduplicatedFile {
  path: string;
  status: string;
  staged: boolean;
}

interface ChangesTabProps {
  stagedFiles: DeduplicatedFile[];
  unstagedFiles: DeduplicatedFile[];
  onStage: (filePaths: string[]) => void;
  onUnstage: (filePaths: string[]) => void;
  onViewDiff: (filePath: string) => void;
  stagingFile: string | null;
  commitMessage: string;
  onCommitMessageChange: (message: string) => void;
  onCommit: () => void;
  committing: boolean;
  commitError: string;
}

function statusLabel(status: string): string {
  switch (status) {
    case "M":
      return "Modified";
    case "A":
      return "Added";
    case "D":
      return "Deleted";
    case "R":
      return "Renamed";
    case "C":
      return "Copied";
    case "?":
      return "Untracked";
    case "!":
      return "Ignored";
    default:
      return status;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "A":
      return (
        <FilePlusIcon className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
      );
    case "D":
      return (
        <FileMinusIcon className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
      );
    case "?":
      return (
        <FileQuestionIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      );
    case "M":
    default:
      return (
        <PencilIcon className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
      );
  }
}

function StatusBadge({ status, staged }: { status: string; staged: boolean }) {
  const colors: Record<string, string> = {
    M: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    D: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    "?": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  const color = colors[status] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${color}`}
      title={`${statusLabel(status)}${staged ? " (staged)" : ""}`}
    >
      {status}
      {staged && <span className="opacity-60">S</span>}
    </span>
  );
}

function FileRow({
  file,
  staged,
  onToggleStaging,
  onViewDiff,
  stagingFile,
}: {
  file: DeduplicatedFile;
  staged: boolean;
  onToggleStaging: () => void;
  onViewDiff: () => void;
  stagingFile: string | null;
}) {
  return (
    <div className="group/file hover:bg-muted flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors">
      <button
        type="button"
        title={staged ? "Unstage file" : "Stage file"}
        onClick={onToggleStaging}
        disabled={stagingFile === file.path}
        className={
          staged
            ? "flex size-4 shrink-0 items-center justify-center rounded border border-green-500 bg-green-500 text-white transition-colors hover:bg-green-600 disabled:opacity-50 dark:border-green-600 dark:bg-green-600 dark:hover:bg-green-700"
            : "flex size-4 shrink-0 items-center justify-center rounded border transition-colors hover:border-green-500 hover:bg-green-50 disabled:opacity-50 dark:hover:border-green-600 dark:hover:bg-green-950"
        }
      >
        {staged ? (
          <CheckIcon className="size-2.5" />
        ) : (
          <span className="size-0" />
        )}
      </button>
      <button
        type="button"
        onClick={onViewDiff}
        className="flex min-w-0 flex-1 items-center gap-1.5"
      >
        <StatusIcon status={file.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {file.path}
        </span>
      </button>
      <StatusBadge status={file.status} staged={staged} />
    </div>
  );
}

function CommitForm({
  commitMessage,
  onCommitMessageChange,
  onCommit,
  committing,
  commitError,
  stagedCount,
}: {
  commitMessage: string;
  onCommitMessageChange: (message: string) => void;
  onCommit: () => void;
  committing: boolean;
  commitError: string;
  stagedCount: number;
}) {
  return (
    <div className="border-t px-3 py-2">
      {commitError && (
        <p className="text-destructive mb-1.5 text-[11px]">{commitError}</p>
      )}
      <div className="flex items-start gap-2">
        <textarea
          value={commitMessage}
          onChange={(e) => onCommitMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onCommit();
            }
          }}
          placeholder="Commit message..."
          rows={2}
          className="bg-muted min-h-[3rem] min-w-0 flex-1 resize-none rounded-md border px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
        />
        <Button
          variant="default"
          size="sm"
          onClick={onCommit}
          disabled={committing || !commitMessage.trim()}
          title={`Commit ${stagedCount} file${stagedCount > 1 ? "s" : ""} (${navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter)`}
          className="shrink-0"
        >
          {committing ? (
            <LoaderIcon className="size-3 animate-spin" />
          ) : (
            <SendIcon className="size-3" />
          )}
          Commit
        </Button>
      </div>
      <p className="text-muted-foreground mt-1 text-[10px]">
        {stagedCount} file{stagedCount > 1 ? "s" : ""} staged
      </p>
    </div>
  );
}

export function ChangesTab({
  stagedFiles,
  unstagedFiles,
  onStage,
  onUnstage,
  onViewDiff,
  stagingFile,
  commitMessage,
  onCommitMessageChange,
  onCommit,
  committing,
  commitError,
}: ChangesTabProps) {
  if (stagedFiles.length === 0 && unstagedFiles.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center py-12 text-center text-xs">
        <CheckIcon className="mb-2 size-5 opacity-40" />
        Working tree clean
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* Staged section */}
        {stagedFiles.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-[10px] font-semibold tracking-wider text-green-600 uppercase dark:text-green-400">
                Staged ({stagedFiles.length})
              </span>
              <button
                type="button"
                onClick={() => onUnstage(stagedFiles.map((f) => f.path))}
                className="text-muted-foreground hover:text-foreground text-[10px] transition-colors"
              >
                Unstage all
              </button>
            </div>
            {stagedFiles.map((file) => (
              <FileRow
                key={`staged-${file.path}`}
                file={file}
                staged={true}
                onToggleStaging={() => onUnstage([file.path])}
                onViewDiff={() => onViewDiff(file.path)}
                stagingFile={stagingFile}
              />
            ))}
          </div>
        )}

        {/* Unstaged section */}
        {unstagedFiles.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Changes ({unstagedFiles.length})
              </span>
              <button
                type="button"
                onClick={() => onStage(unstagedFiles.map((f) => f.path))}
                className="text-muted-foreground hover:text-foreground text-[10px] transition-colors"
              >
                Stage all
              </button>
            </div>
            {unstagedFiles.map((file) => (
              <FileRow
                key={`unstaged-${file.path}`}
                file={file}
                staged={false}
                onToggleStaging={() => onStage([file.path])}
                onViewDiff={() => onViewDiff(file.path)}
                stagingFile={stagingFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Commit form */}
      {stagedFiles.length > 0 && (
        <CommitForm
          commitMessage={commitMessage}
          onCommitMessageChange={onCommitMessageChange}
          onCommit={onCommit}
          committing={committing}
          commitError={commitError}
          stagedCount={stagedFiles.length}
        />
      )}
    </>
  );
}
