import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  FileIcon,
  FileMinusIcon,
  FilePlusIcon,
  FileQuestionIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  LoaderIcon,
  PencilIcon,
  RefreshCwIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type BundledTheme, codeToHtml } from "shiki";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";

interface GitPanelProps {
  machineId: string;
  workingDirectory: string;
  onClose: () => void;
}

interface GitFile {
  status: string;
  path: string;
  staged: boolean;
}

interface GitLogEntry {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
}

function getShikiTheme(resolved: "light" | "dark"): BundledTheme {
  return resolved === "dark" ? "github-dark" : "github-light";
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

function DiffViewer({
  machineId,
  workingDirectory,
  filePath,
  onBack,
}: {
  machineId: string;
  workingDirectory: string;
  filePath: string;
  onBack: () => void;
}) {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { resolved } = useTheme();
  const theme = getShikiTheme(resolved);

  const fetchDiff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.git.diff(machineId, workingDirectory, filePath);
      if (result.error) {
        setError(result.error);
        setDiff(null);
      } else {
        setDiff(result.diff);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load diff. Is the machine online?",
      );
      setDiff(null);
    } finally {
      setLoading(false);
    }
  }, [machineId, workingDirectory, filePath]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  // Syntax highlight diff
  useEffect(() => {
    if (!diff) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    codeToHtml(diff, { lang: "diff", theme }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [diff, theme]);

  const handleCopy = useCallback(() => {
    if (!diff) return;
    navigator.clipboard.writeText(diff);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [diff]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeftIcon className="size-3.5" />
        </Button>
        <FileIcon className="text-muted-foreground size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">
          {filePath}
        </span>
        {diff && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-[11px] transition-colors"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyIcon className="size-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center py-12 text-xs">
            <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
            Loading diff...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <p className="text-destructive px-4 text-center text-xs">{error}</p>
            <Button type="button" variant="ghost" size="xs" onClick={fetchDiff}>
              <RefreshCwIcon className="size-3" />
              Retry
            </Button>
          </div>
        ) : diff ? (
          html ? (
            <div
              className="overflow-x-auto text-[13px] leading-relaxed [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!bg-transparent [&_pre]:px-4 [&_pre]:py-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
              <code>{diff}</code>
            </pre>
          )
        ) : (
          <div className="text-muted-foreground flex flex-col items-center py-12 text-center text-xs">
            No changes for this file.
          </div>
        )}
      </div>
    </div>
  );
}

// Build a deduplicated file list with staging info
interface DeduplicatedFile {
  path: string;
  status: string;
  staged: boolean;
}

function deduplicateFiles(rawFiles: GitFile[]): DeduplicatedFile[] {
  const map = new Map<string, { status: string; staged: boolean }>();
  for (const f of rawFiles) {
    const existing = map.get(f.path);
    if (!existing) {
      map.set(f.path, { status: f.status, staged: f.staged });
    } else if (f.staged) {
      // If file has a staged entry, mark as staged and use staged status
      map.set(f.path, { status: f.status, staged: true });
    }
  }
  return Array.from(map.entries()).map(([path, info]) => ({
    path,
    status: info.status,
    staged: info.staged,
  }));
}

export function GitPanel({
  machineId,
  workingDirectory,
  onClose,
}: GitPanelProps) {
  const [files, setFiles] = useState<DeduplicatedFile[]>([]);
  const [branch, setBranch] = useState("");
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingDiff, setViewingDiff] = useState<string | null>(null);
  const [tab, setTab] = useState<"changes" | "log">("changes");
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");
  const [stagingFile, setStagingFile] = useState<string | null>(null);

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusResult, logResult] = await Promise.all([
        api.git.status(machineId, workingDirectory),
        api.git.log(machineId, workingDirectory, 15),
      ]);

      if (statusResult.error) {
        setError(statusResult.error);
        return;
      }

      setBranch(statusResult.branch ?? "");
      setFiles(deduplicateFiles(statusResult.files ?? []));
      setLog(logResult.entries ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Machine not responding. Is it online?",
      );
    } finally {
      setLoading(false);
    }
  }, [machineId, workingDirectory]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStage = useCallback(
    async (filePaths: string[]) => {
      setStagingFile(filePaths[0]);
      try {
        const result = await api.git.stage(
          machineId,
          workingDirectory,
          filePaths,
        );
        if (result.error) {
          setCommitError(result.error);
          return;
        }
        // Optimistically update local state
        setFiles((prev) =>
          prev.map((f) =>
            filePaths.includes(f.path) ? { ...f, staged: true } : f,
          ),
        );
      } catch (err) {
        setCommitError(
          err instanceof ApiError ? err.message : "Failed to stage files",
        );
      } finally {
        setStagingFile(null);
      }
    },
    [machineId, workingDirectory],
  );

  const handleUnstage = useCallback(
    async (filePaths: string[]) => {
      setStagingFile(filePaths[0]);
      try {
        const result = await api.git.unstage(
          machineId,
          workingDirectory,
          filePaths,
        );
        if (result.error) {
          setCommitError(result.error);
          return;
        }
        setFiles((prev) =>
          prev.map((f) =>
            filePaths.includes(f.path) ? { ...f, staged: false } : f,
          ),
        );
      } catch (err) {
        setCommitError(
          err instanceof ApiError ? err.message : "Failed to unstage files",
        );
      } finally {
        setStagingFile(null);
      }
    },
    [machineId, workingDirectory],
  );

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    setCommitting(true);
    setCommitError("");
    try {
      const result = await api.git.commit(
        machineId,
        workingDirectory,
        commitMessage.trim(),
      );
      if (!result.success) {
        setCommitError(result.error ?? "Commit failed");
        return;
      }
      // Clear commit form and refresh
      setCommitMessage("");
      await fetchStatus();
    } catch (err) {
      setCommitError(
        err instanceof ApiError ? err.message : "Failed to commit",
      );
    } finally {
      setCommitting(false);
    }
  }, [
    commitMessage,
    stagedFiles.length,
    machineId,
    workingDirectory,
    fetchStatus,
  ]);

  // If viewing a diff, show the diff viewer
  if (viewingDiff) {
    return (
      <div className="flex h-full flex-col">
        <DiffViewer
          machineId={machineId}
          workingDirectory={workingDirectory}
          filePath={viewingDiff}
          onBack={() => setViewingDiff(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <GitBranchIcon className="text-muted-foreground size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {branch ? (
            <>
              Git{" "}
              <span className="font-mono text-[11px] font-normal opacity-70">
                {branch}
              </span>
            </>
          ) : (
            "Git"
          )}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={fetchStatus}
          title="Refresh"
          className="text-muted-foreground"
        >
          <RefreshCwIcon className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon className="size-3.5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setTab("changes")}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "changes"
              ? "border-foreground text-foreground border-b-2"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Changes
          {files.length > 0 && (
            <span className="bg-muted text-muted-foreground ml-1.5 inline-flex size-4 items-center justify-center rounded-full text-[10px]">
              {files.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("log")}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "log"
              ? "border-foreground text-foreground border-b-2"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center py-12 text-xs">
            <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <p className="text-destructive px-3 text-center text-xs">{error}</p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={fetchStatus}
            >
              <RefreshCwIcon className="size-3" />
              Retry
            </Button>
          </div>
        ) : tab === "changes" ? (
          /* Changes tab */
          files.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center py-12 text-center text-xs">
              <CheckIcon className="mb-2 size-5 opacity-40" />
              Working tree clean
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Staged section */}
              {stagedFiles.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <span className="text-[10px] font-semibold tracking-wider text-green-600 uppercase dark:text-green-400">
                      Staged ({stagedFiles.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleUnstage(stagedFiles.map((f) => f.path))
                      }
                      className="text-muted-foreground hover:text-foreground text-[10px] transition-colors"
                    >
                      Unstage all
                    </button>
                  </div>
                  {stagedFiles.map((file) => (
                    <div
                      key={`staged-${file.path}`}
                      className="group/file hover:bg-muted flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors"
                    >
                      <button
                        type="button"
                        title="Unstage file"
                        onClick={() => handleUnstage([file.path])}
                        disabled={stagingFile === file.path}
                        className="flex size-4 shrink-0 items-center justify-center rounded border border-green-500 bg-green-500 text-white transition-colors hover:bg-green-600 disabled:opacity-50 dark:border-green-600 dark:bg-green-600 dark:hover:bg-green-700"
                      >
                        <CheckIcon className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingDiff(file.path)}
                        className="flex min-w-0 flex-1 items-center gap-1.5"
                      >
                        <StatusIcon status={file.status} />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">
                          {file.path}
                        </span>
                      </button>
                      <StatusBadge status={file.status} staged={true} />
                    </div>
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
                      onClick={() =>
                        handleStage(unstagedFiles.map((f) => f.path))
                      }
                      className="text-muted-foreground hover:text-foreground text-[10px] transition-colors"
                    >
                      Stage all
                    </button>
                  </div>
                  {unstagedFiles.map((file) => (
                    <div
                      key={`unstaged-${file.path}`}
                      className="group/file hover:bg-muted flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors"
                    >
                      <button
                        type="button"
                        title="Stage file"
                        onClick={() => handleStage([file.path])}
                        disabled={stagingFile === file.path}
                        className="flex size-4 shrink-0 items-center justify-center rounded border transition-colors hover:border-green-500 hover:bg-green-50 disabled:opacity-50 dark:hover:border-green-600 dark:hover:bg-green-950"
                      >
                        <span className="size-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingDiff(file.path)}
                        className="flex min-w-0 flex-1 items-center gap-1.5"
                      >
                        <StatusIcon status={file.status} />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">
                          {file.path}
                        </span>
                      </button>
                      <StatusBadge status={file.status} staged={false} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : /* Log tab */
        log.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center py-12 text-center text-xs">
            No commits yet
          </div>
        ) : (
          <div>
            {log.map((entry) => (
              <div
                key={entry.hash}
                className="flex items-start gap-2 px-3 py-2"
              >
                <GitCommitHorizontalIcon className="text-muted-foreground/50 mt-0.5 size-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{entry.message}</p>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[10px]">
                    <span className="font-mono">{entry.short_hash}</span>
                    <span>&middot;</span>
                    <span>{entry.author}</span>
                    <span>&middot;</span>
                    <span>{formatRelative(entry.date)}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commit form — visible on Changes tab when there are staged files */}
      {tab === "changes" && !loading && !error && stagedFiles.length > 0 && (
        <div className="border-t px-3 py-2">
          {commitError && (
            <p className="text-destructive mb-1.5 text-[11px]">{commitError}</p>
          )}
          <div className="flex items-start gap-2">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleCommit();
                }
              }}
              placeholder="Commit message..."
              rows={2}
              className="bg-muted min-h-[3rem] min-w-0 flex-1 resize-none rounded-md border px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleCommit}
              disabled={committing || !commitMessage.trim()}
              title={`Commit ${stagedFiles.length} file${stagedFiles.length > 1 ? "s" : ""} (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter)`}
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
            {stagedFiles.length} file{stagedFiles.length > 1 ? "s" : ""} staged
          </p>
        </div>
      )}
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
