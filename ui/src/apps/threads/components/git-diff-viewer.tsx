import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  FileIcon,
  LoaderIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type BundledTheme, codeToHtml } from "shiki";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";

function getShikiTheme(resolved: "light" | "dark"): BundledTheme {
  return resolved === "dark" ? "github-dark" : "github-light";
}

export function DiffViewer({
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
