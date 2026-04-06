import { useQuery } from "@tanstack/react-query";
import {
  InboxIcon,
  KeyboardIcon,
  LogOutIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/apps/auth/auth-provider";
import { OPEN_SHORTCUTS_EVENT } from "@/components/keyboard-shortcuts-dialog";
import { QuickNewThreadDialog } from "@/components/quick-new-thread-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();

  // Global Cmd+K / Ctrl+K handler
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch machines for navigation (cached)
  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: () => api.machines.list(),
    enabled: open && !!user,
    staleTime: 30_000,
  });

  // Search threads globally when search has text
  const { data: searchResults } = useQuery({
    queryKey: ["threads-search", search],
    queryFn: () => api.threads.search(search),
    enabled: open && search.trim().length >= 2,
    staleTime: 10_000,
  });

  const runAction = useCallback(
    (action: () => void) => {
      setOpen(false);
      setSearch("");
      action();
    },
    [setOpen],
  );

  const navigateTo = useCallback(
    (path: string) => runAction(() => navigate(path)),
    [runAction, navigate],
  );

  if (!user) return null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSearch("");
        }}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogContent
          className="bg-background overflow-hidden rounded-xl border p-0 shadow-2xl sm:max-w-lg"
          showCloseButton={false}
        >
          <Command className="rounded-none" shouldFilter={!search.trim()} loop>
            <CommandInput
              placeholder="Search threads, machines, or type a command..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-80">
              <CommandEmpty className="text-muted-foreground py-8 text-center text-sm">
                <SearchIcon className="mx-auto mb-2 h-5 w-5 opacity-40" />
                No results found.
              </CommandEmpty>

              {/* Thread search results */}
              {search.trim().length >= 2 &&
                searchResults &&
                searchResults.length > 0 && (
                  <CommandGroup heading="Threads">
                    {searchResults.map((t) => (
                      <CommandItem
                        key={t.id}
                        value={`thread-${t.id}-${t.title ?? ""}`}
                        onSelect={() => navigateTo(`/threads/${t.id}`)}
                      >
                        <MessageSquareIcon className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm">
                            {t.title || "Untitled thread"}
                          </span>
                          <span className="text-muted-foreground truncate text-xs">
                            {t.machine_name}
                            {t.workspace_name ? ` / ${t.workspace_name}` : ""}
                          </span>
                        </div>
                        <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                          {timeAgo(t.updated_at)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

              {/* Machines navigation */}
              {machines && machines.length > 0 && (
                <CommandGroup heading="Machines">
                  {machines.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={`machine-${m.id}-${m.name}`}
                      onSelect={() => navigateTo(`/machines/${m.id}/threads`)}
                    >
                      <MonitorIcon className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{m.name}</span>
                      <span
                        className={`mr-1 h-2 w-2 shrink-0 rounded-full ${
                          m.status === "online"
                            ? "bg-emerald-500"
                            : "bg-neutral-300 dark:bg-neutral-600"
                        }`}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />

              {/* Quick actions */}
              <CommandGroup heading="Actions">
                {machines && machines.length > 0 && (
                  <CommandItem
                    value="new-thread"
                    onSelect={() => runAction(() => setNewThreadOpen(true))}
                  >
                    <PlusIcon className="text-muted-foreground mr-2 h-4 w-4" />
                    <span className="flex-1">New thread</span>
                  </CommandItem>
                )}
                {machines && machines.length > 0 && (
                  <CommandItem
                    value="machine-settings"
                    onSelect={() =>
                      navigateTo(`/machines/${machines[0].id}/settings`)
                    }
                  >
                    <SettingsIcon className="text-muted-foreground mr-2 h-4 w-4" />
                    <span className="flex-1">Machine settings</span>
                  </CommandItem>
                )}
                <CommandItem
                  value="toggle-dark-mode-theme"
                  onSelect={() => runAction(toggle)}
                >
                  {resolved === "dark" ? (
                    <SunIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  ) : (
                    <MoonIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  )}
                  <span className="flex-1">
                    {resolved === "dark"
                      ? "Switch to light mode"
                      : "Switch to dark mode"}
                  </span>
                </CommandItem>
                <CommandItem
                  value="user-settings-profile"
                  onSelect={() => navigateTo("/settings")}
                >
                  <SettingsIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  <span className="flex-1">Settings</span>
                </CommandItem>
                <CommandItem
                  value="keyboard-shortcuts-help"
                  onSelect={() =>
                    runAction(() => {
                      window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));
                    })
                  }
                >
                  <KeyboardIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  <span className="flex-1">Keyboard shortcuts</span>
                  <CommandShortcut>?</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="all-threads-inbox"
                  onSelect={() => navigateTo("/threads")}
                >
                  <InboxIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  <span className="flex-1">All threads</span>
                </CommandItem>
                <CommandItem
                  value="go-home-machines"
                  onSelect={() => navigateTo("/machines")}
                >
                  <MonitorIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  <span className="flex-1">Go to machines</span>
                </CommandItem>
                <CommandItem
                  value="sign-out-logout"
                  onSelect={() => runAction(() => void logout())}
                >
                  <LogOutIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  <span className="flex-1">Sign out</span>
                  <CommandShortcut>
                    {navigator.platform.includes("Mac") ? "⌘" : "Ctrl+"}K
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </CommandList>

            {/* Footer hint */}
            <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs">
              <span>
                <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
                  ↑↓
                </kbd>{" "}
                navigate{" "}
                <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
                  ↵
                </kbd>{" "}
                select{" "}
                <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
                  esc
                </kbd>{" "}
                close
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>

      <QuickNewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        onCreated={(threadId) => navigate(`/threads/${threadId}`)}
      />
    </>
  );
}
