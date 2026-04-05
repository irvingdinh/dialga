import {
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  HomeIcon,
  LoaderIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

interface FolderPickerProps {
  machineId: string;
  value: string;
  onChange: (path: string) => void;
}

export function FolderPicker({
  machineId,
  value,
  onChange,
}: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(value || "/");
  const [entries, setEntries] = useState<
    Array<{ name: string; type: "directory" | "file" }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [mkdirError, setMkdirError] = useState("");

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
          setEntries(result.entries.filter((e) => e.type === "directory"));
          onChange(result.path);
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
    [machineId, onChange],
  );

  useEffect(() => {
    fetchDirectory(value || "/");
    // Only on mount / when machineId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

  function navigateTo(path: string) {
    fetchDirectory(path);
  }

  function navigateUp() {
    const parent = currentPath.replace(/\/[^/]+\/?$/, "") || "/";
    fetchDirectory(parent);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreating(true);
    setMkdirError("");
    try {
      const fullPath =
        currentPath === "/"
          ? `/${newFolderName.trim()}`
          : `${currentPath}/${newFolderName.trim()}`;
      const result = await api.fs.mkdir(machineId, fullPath);
      if (result.error) {
        setMkdirError(result.error);
      } else {
        setNewFolderName("");
        setCreatingFolder(false);
        fetchDirectory(fullPath);
      }
    } catch (err) {
      setMkdirError(
        err instanceof ApiError ? err.message : "Failed to create folder",
      );
    } finally {
      setCreating(false);
    }
  }

  // Build breadcrumb segments from currentPath
  const pathSegments = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      {/* Current path display + breadcrumbs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => navigateTo("/")}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
        >
          <HomeIcon className="size-3.5" />
        </button>
        {pathSegments.map((segment, i) => {
          const fullPath = "/" + pathSegments.slice(0, i + 1).join("/");
          const isLast = i === pathSegments.length - 1;
          return (
            <div key={fullPath} className="flex items-center gap-1">
              <ChevronRightIcon className="text-muted-foreground/50 size-3 shrink-0" />
              {isLast ? (
                <span className="truncate font-mono text-xs font-medium">
                  {segment}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo(fullPath)}
                  className="text-muted-foreground hover:text-foreground truncate font-mono text-xs transition-colors"
                >
                  {segment}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Directory listing */}
      <div className="border-border max-h-48 overflow-y-auto rounded-xl border">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center py-6 text-xs">
            <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-6">
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
            {/* Go up */}
            {currentPath !== "/" && (
              <button
                type="button"
                onClick={navigateUp}
                className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
              >
                <FolderIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
                <span className="text-muted-foreground text-xs">..</span>
              </button>
            )}
            {entries.length === 0 && currentPath === "/" && (
              <div className="text-muted-foreground py-6 text-center text-xs">
                No directories found
              </div>
            )}
            {entries.map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() =>
                  navigateTo(
                    currentPath === "/"
                      ? `/${entry.name}`
                      : `${currentPath}/${entry.name}`,
                  )
                }
                className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
              >
                <FolderIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
                <span className="truncate text-xs">{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {creatingFolder ? (
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateFolder();
                  }
                  if (e.key === "Escape") {
                    setCreatingFolder(false);
                    setNewFolderName("");
                    setMkdirError("");
                  }
                }}
                placeholder="Folder name"
                className="h-7 flex-1 font-mono text-xs"
                autoFocus
                disabled={creating}
              />
              <Button
                type="button"
                size="xs"
                onClick={handleCreateFolder}
                disabled={creating || !newFolderName.trim()}
              >
                {creating ? "..." : "Create"}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  setCreatingFolder(false);
                  setNewFolderName("");
                  setMkdirError("");
                }}
              >
                Cancel
              </Button>
            </div>
            {mkdirError && (
              <p className="text-destructive text-xs">{mkdirError}</p>
            )}
          </div>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setCreatingFolder(true)}
          >
            <FolderPlusIcon className="size-3" />
            New Folder
          </Button>
        )}
      </div>

      {/* Selected path readout */}
      <div className="bg-muted rounded-lg px-3 py-1.5">
        <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
          Selected
        </p>
        <p className="truncate font-mono text-xs font-medium">{currentPath}</p>
      </div>
    </div>
  );
}
