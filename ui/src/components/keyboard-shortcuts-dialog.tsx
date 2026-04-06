import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/apps/auth/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const isMac = navigator.platform.includes("Mac");
const mod = isMac ? "\u2318" : "Ctrl+";

interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string[]; description: string }[];
}

const groups: ShortcutGroup[] = [
  {
    label: "Global",
    shortcuts: [
      { keys: [`${mod}K`], description: "Command palette" },
      { keys: ["?"], description: "Keyboard shortcuts" },
    ],
  },
  {
    label: "Thread List",
    shortcuts: [
      { keys: ["/"], description: "Focus search" },
      { keys: ["N"], description: "New thread" },
      { keys: ["Esc"], description: "Exit selection / clear search" },
    ],
  },
  {
    label: "Thread View",
    shortcuts: [
      { keys: ["/"], description: "Toggle message search" },
      { keys: ["Esc"], description: "Close panel / search / cancel" },
      { keys: ["E"], description: "Toggle file browser" },
      { keys: ["G"], description: "Toggle git panel" },
      { keys: ["I"], description: "Toggle workspace context" },
      { keys: ["S"], description: "Toggle starred messages filter" },
    ],
  },
  {
    label: "Message Input",
    shortcuts: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift+Enter"], description: "New line" },
    ],
  },
  {
    label: "Git Panel",
    shortcuts: [
      { keys: [`${mod}Enter`], description: "Commit staged changes" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="bg-muted inline-flex min-w-[1.5rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none">
      {children}
    </kbd>
  );
}

/** Custom event name for opening shortcuts dialog from other components */
export const OPEN_SHORTCUTS_EVENT = "dialga:open-keyboard-shortcuts";

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!user) return;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInput) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    },
    [user],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Listen for custom event from command palette
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SHORTCUTS_EVENT, handler);
  }, []);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="-mx-2 max-h-[60vh] overflow-y-auto px-2">
          {groups.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                {group.label}
              </h3>
              <div className="flex flex-col gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Shortcuts are disabled when a text input is focused.
        </p>
      </DialogContent>
    </Dialog>
  );
}
