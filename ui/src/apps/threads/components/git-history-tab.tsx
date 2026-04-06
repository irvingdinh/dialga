import { GitCommitHorizontalIcon } from "lucide-react";

export interface GitLogEntry {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
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

export function HistoryTab({ entries }: { entries: GitLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center py-12 text-center text-xs">
        No commits yet
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry) => (
        <div key={entry.hash} className="flex items-start gap-2 px-3 py-2">
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
  );
}
