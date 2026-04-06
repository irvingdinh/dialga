import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api } from "@/lib/api";
import { useUnread } from "@/lib/unread";

export function useUnreadCounts(machines: Array<{ id: string }> | undefined) {
  const { getUnreadCount } = useUnread();

  const machineIds = useMemo(
    () => (machines ?? []).map((m) => m.id),
    [machines],
  );

  const { data: threadsByMachine } = useQuery({
    queryKey: ["threads-unread", machineIds],
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
    staleTime: 30_000,
  });

  return useMemo(() => {
    const counts: Record<string, number> = {};
    if (threadsByMachine) {
      for (const [machineId, threads] of Object.entries(threadsByMachine)) {
        counts[machineId] = getUnreadCount(threads);
      }
    }
    return counts;
  }, [threadsByMachine, getUnreadCount]);
}
