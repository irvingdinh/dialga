import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { useAuth } from "@/apps/auth/auth-provider";
import { api } from "@/lib/api";
import { useNotificationEvent } from "@/lib/connection";
import { useUnread } from "@/lib/unread";

export function DocumentTitleUpdater() {
  const { user } = useAuth();
  const { getUnreadCount } = useUnread();
  const queryClient = useQueryClient();

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: api.machines.list,
    enabled: !!user,
    staleTime: 60_000,
  });

  const machineIds = useMemo(
    () => (machines ?? []).map((m) => m.id),
    [machines],
  );

  const { data: threadsByMachine } = useQuery({
    queryKey: ["doc-title-threads", machineIds],
    queryFn: async () => {
      const result: Record<
        string,
        Array<{ id: string; updated_at: string }>
      > = {};
      await Promise.all(
        machineIds.map(async (id) => {
          result[id] = await api.threads.list(id);
        }),
      );
      return result;
    },
    enabled: machineIds.length > 0,
    staleTime: 60_000,
  });

  const totalUnread = useMemo(() => {
    if (!threadsByMachine) return 0;
    let count = 0;
    for (const threads of Object.values(threadsByMachine)) {
      count += getUnreadCount(threads);
    }
    return count;
  }, [threadsByMachine, getUnreadCount]);

  // Update document.title
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Dialga` : "Dialga";
  }, [totalUnread]);

  // Reset title on logout
  useEffect(() => {
    if (!user) {
      document.title = "Dialga";
    }
  }, [user]);

  // SSE: invalidate thread data when task notifications arrive
  useNotificationEvent("task:notification", () => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ["doc-title-threads"] });
    }
  });

  return null;
}
