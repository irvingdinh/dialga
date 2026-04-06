import { useEffect } from "react";

type ShortcutHandler = (e: KeyboardEvent) => void;

interface ShortcutDef {
  key: string;
  handler: ShortcutHandler;
  /** Allow this shortcut even when an input/textarea is focused */
  allowInInput?: boolean;
}

/**
 * Register page-level keyboard shortcuts.
 * Shortcuts are suppressed when text inputs are focused (unless allowInInput is set).
 * Uses keydown with capture phase to run before other handlers.
 */
export function usePageShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (shortcut.key !== e.key) continue;
        if (isInput && !shortcut.allowInInput) continue;
        // Don't intercept when modifier keys are held (except Shift for ?)
        if (e.metaKey || e.ctrlKey || e.altKey) continue;

        shortcut.handler(e);
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}
