import {
  CheckIcon,
  ClipboardIcon,
  GitForkIcon,
  PencilIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

export function extractCopyableText(
  content: string,
  metadata: Record<string, unknown> | null,
): string {
  if (!metadata) return content;
  try {
    const parsed = metadata as {
      events?: Array<{ type: string; content: string }>;
    };
    if (!parsed.events || !Array.isArray(parsed.events)) return content;
    const textParts: string[] = [];
    for (const event of parsed.events) {
      if (event.type === "text" && event.content) {
        textParts.push(event.content);
      }
    }
    return textParts.length > 0 ? textParts.join("") : content;
  } catch {
    return content;
  }
}

export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  if (!text) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 max-sm:opacity-100"
      title={copied ? "Copied" : "Copy message"}
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <ClipboardIcon className="size-3.5" />
      )}
    </button>
  );
}

export function ForkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 max-sm:opacity-100"
      title="Fork conversation from here"
    >
      <GitForkIcon className="size-3.5" />
    </button>
  );
}

export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 max-sm:opacity-100"
      title="Edit message"
    >
      <PencilIcon className="size-3.5" />
    </button>
  );
}
