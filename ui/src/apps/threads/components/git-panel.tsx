import { GitBranchIcon, LoaderIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

import { ChangesTab, type DeduplicatedFile } from "./git-changes-tab";
import { DiffViewer } from "./git-diff-viewer";
import { type GitLogEntry, HistoryTab } from "./git-history-tab";

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

function deduplicateFiles(rawFiles: GitFile[]): DeduplicatedFile[] {
  const map = new Map<string, { status: string; staged: boolean }>();
  for (const f of rawFiles) {
    const existing = map.get(f.path);
    if (!existing) {
      map.set(f.path, { status: f.status, staged: f.staged });
    } else if (f.staged) {
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

  // Diff viewer replaces the panel content
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
      {loading ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center py-12 text-xs">
          <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center gap-2 py-12">
          <p className="text-destructive px-3 text-center text-xs">{error}</p>
          <Button type="button" variant="ghost" size="xs" onClick={fetchStatus}>
            <RefreshCwIcon className="size-3" />
            Retry
          </Button>
        </div>
      ) : tab === "changes" ? (
        <ChangesTab
          stagedFiles={stagedFiles}
          unstagedFiles={unstagedFiles}
          onStage={handleStage}
          onUnstage={handleUnstage}
          onViewDiff={setViewingDiff}
          stagingFile={stagingFile}
          commitMessage={commitMessage}
          onCommitMessageChange={setCommitMessage}
          onCommit={handleCommit}
          committing={committing}
          commitError={commitError}
        />
      ) : (
        <HistoryTab entries={log} />
      )}
    </div>
  );
}
