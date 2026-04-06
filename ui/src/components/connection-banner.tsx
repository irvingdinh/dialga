import { WifiOffIcon } from "lucide-react";

import { useAuth } from "@/apps/auth/auth-provider";
import { useConnectionStatus } from "@/lib/connection";

export function ConnectionBanner() {
  const { user } = useAuth();
  const status = useConnectionStatus();

  if (!user || status === "connected") return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
      <WifiOffIcon className="size-3 shrink-0" />
      <span>
        {status === "reconnecting"
          ? "Reconnecting to real-time updates\u2026"
          : "Connection lost. Retrying\u2026"}
      </span>
    </div>
  );
}
