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

// Deduplicate git files — combine staged + unstaged entries for same path
function deduplicateFiles(files: GitFile[]): GitFile[] {
  const seen = new Map<string, GitFile>();
  for (const f of files) {
    const existing = seen.get(f.path);
    if (!existing) {
      seen.set(f.path, f);
    } else if (f.staged && !existing.staged) {
      // Prefer staged entry if we have both
      seen.set(f.path, f);
    }
  }
  return Array.from(seen.values());
}

export function GitPanel({
  machineId,
  workingDirectory,
  onClose,
}: GitPanelProps) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [branch, setBranch] = useState("");
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingDiff, setViewingDiff] = useState<string | null>(null);
  const [tab, setTab] = useState<"changes" | "log">("changes");

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
            <div>
              {files.map((file) => (
                <button
                  key={`${file.path}-${file.staged}`}
                  type="button"
                  onClick={() => setViewingDiff(file.path)}
                  className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
                >
                  <StatusIcon status={file.status} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {file.path}
                  </span>
                  <StatusBadge status={file.status} staged={file.staged} />
                </button>
              ))}
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
