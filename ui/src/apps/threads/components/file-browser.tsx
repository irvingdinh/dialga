import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  FileIcon,
  FolderIcon,
  HomeIcon,
  LoaderIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BundledLanguage,
  bundledLanguages,
  type BundledTheme,
  codeToHtml,
} from "shiki";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";

interface FileBrowserProps {
  machineId: string;
  rootPath: string;
  onClose: () => void;
}

type FsEntry = { name: string; type: "directory" | "file" };

function getShikiTheme(resolved: "light" | "dark"): BundledTheme {
  return resolved === "dark" ? "github-dark" : "github-light";
}

function resolveLanguage(filename: string): BundledLanguage | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (ext in bundledLanguages) return ext as BundledLanguage;
  const aliases: Record<string, BundledLanguage> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    mts: "typescript",
    cts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    sh: "bash",
    zsh: "bash",
    py: "python",
    rb: "ruby",
    yml: "yaml",
    md: "markdown",
    mdx: "mdx",
    rs: "rust",
    dockerfile: "dockerfile",
    tf: "terraform",
    cs: "csharp",
    kt: "kotlin",
    objc: "objective-c",
  };
  return aliases[ext] ?? null;
}

function FileViewer({
  machineId,
  filePath,
  onBack,
}: {
  machineId: string;
  filePath: string;
  onBack: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { resolved } = useTheme();

  const filename = filePath.split("/").pop() || filePath;
  const lang = resolveLanguage(filename);
  const theme = getShikiTheme(resolved);

  const fetchFile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.fs.read(machineId, filePath);
      if (result.error) {
        setError(result.error);
        setContent(null);
      } else {
        setContent(result.content);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to read file. Is the machine online?",
      );
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [machineId, filePath]);

  useEffect(() => {
    fetchFile();
  }, [fetchFile]);

  // Syntax highlight when content or theme changes
  useEffect(() => {
    if (!content || !lang) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    codeToHtml(content, { lang, theme }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [content, lang, theme]);

  const handleCopy = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="flex h-full flex-col">
      {/* File viewer header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeftIcon className="size-3.5" />
        </Button>
        <FileIcon className="text-muted-foreground size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">
          {filename}
        </span>
        {content !== null && (
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

      {/* File content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center py-12 text-xs">
            <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
            Loading file...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <p className="text-destructive px-4 text-center text-xs">{error}</p>
            <Button type="button" variant="ghost" size="xs" onClick={fetchFile}>
              <RefreshCwIcon className="size-3" />
              Retry
            </Button>
          </div>
        ) : content !== null ? (
          html && lang ? (
            <div
              className="overflow-x-auto text-[13px] leading-relaxed [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!bg-transparent [&_pre]:px-4 [&_pre]:py-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
              <code>{content}</code>
            </pre>
          )
        ) : null}
      </div>
    </div>
  );
}

export function FileBrowser({
  machineId,
  rootPath,
  onClose,
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  const fetchDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError("");
      try {
        const result = await api.fs.list(machineId, path);
        if (result.error) {
          setError(result.error);
          setEntries([]);
        } else {
          setCurrentPath(result.path);
          setEntries(result.entries);
        }
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Machine not responding. Is it online?",
        );
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [machineId],
  );

  useEffect(() => {
    fetchDirectory(rootPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, rootPath]);

  function navigateTo(path: string) {
    fetchDirectory(path);
  }

  function navigateUp() {
    const parent = currentPath.replace(/\/[^/]+\/?$/, "") || "/";
    fetchDirectory(parent);
  }

  function handleEntryClick(entry: FsEntry) {
    const fullPath =
      currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    if (entry.type === "directory") {
      navigateTo(fullPath);
    } else {
      setViewingFile(fullPath);
    }
  }

  // Build breadcrumb segments
  const pathSegments = currentPath.split("/").filter(Boolean);
  const rootSegments = rootPath.split("/").filter(Boolean);

  // If viewing a file, show the file viewer
  if (viewingFile) {
    return (
      <div className="flex h-full flex-col">
        <FileViewer
          machineId={machineId}
          filePath={viewingFile}
          onBack={() => setViewingFile(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <FolderIcon className="text-muted-foreground size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          Files
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon className="size-3.5" />
        </Button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-1.5">
        <button
          type="button"
          onClick={() => navigateTo(rootPath)}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
        >
          <HomeIcon className="size-3" />
        </button>
        {pathSegments.slice(rootSegments.length).map((segment, i) => {
          const fullPath =
            "/" +
            [
              ...rootSegments,
              ...pathSegments.slice(
                rootSegments.length,
                rootSegments.length + i + 1,
              ),
            ].join("/");
          const isLast = i === pathSegments.length - rootSegments.length - 1;
          return (
            <div key={fullPath} className="flex items-center gap-1">
              <ChevronRightIcon className="text-muted-foreground/50 size-2.5 shrink-0" />
              {isLast ? (
                <span className="truncate font-mono text-[11px] font-medium">
                  {segment}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo(fullPath)}
                  className="text-muted-foreground hover:text-foreground truncate font-mono text-[11px] transition-colors"
                >
                  {segment}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Directory listing */}
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
              onClick={() => fetchDirectory(currentPath)}
            >
              <RefreshCwIcon className="size-3" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Go up — only if we're deeper than root */}
            {currentPath !== rootPath && (
              <button
                type="button"
                onClick={navigateUp}
                className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
              >
                <FolderIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
                <span className="text-muted-foreground text-xs">..</span>
              </button>
            )}
            {entries.length === 0 && (
              <div className="text-muted-foreground py-12 text-center text-xs">
                Empty directory
              </div>
            )}
            {entries.map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => handleEntryClick(entry)}
                className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
              >
                {entry.type === "directory" ? (
                  <FolderIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
                ) : (
                  <FileIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
                )}
                <span className="truncate text-xs">{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
