import { SendIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface MessageInputProps {
  onSend: (content: string, model?: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [model, setModel] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed, model.trim() || undefined);
    setContent("");
    textareaRef.current?.focus();
  }, [content, model, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  return (
    <div className="bg-background border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              disabled={disabled}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full resize-none rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:opacity-50 dark:focus:ring-neutral-100/10"
            />
            {model !== "" && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model override"
                  className="border-input bg-background text-muted-foreground w-32 rounded-lg border px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-neutral-100/10"
                />
                <button
                  type="button"
                  onClick={() => setModel("")}
                  className="text-muted-foreground hover:text-foreground text-[11px]"
                >
                  clear
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <Button
              size="icon"
              onClick={handleSend}
              disabled={disabled || !content.trim()}
            >
              <SendIcon className="size-4" />
            </Button>
            {model === "" && (
              <button
                type="button"
                onClick={() => setModel(" ")}
                className="text-muted-foreground hover:text-foreground text-[10px]"
              >
                model
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
