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

  // Single API call for ALL threads across all machines (replaces N per-machine calls)
  const { data: allThreads } = useQuery({
    queryKey: ["threads-unread"],
    queryFn: () => api.threads.listAll(),
    enabled: machineIds.length > 0,
    staleTime: 30_000,
  });

  return useMemo(() => {
    const counts: Record<string, number> = {};
    if (allThreads) {
      // Group threads by machine_id, then compute unread count per machine
      const byMachine = new Map<
        string,
        Array<{ id: string; updated_at: string }>
      >();
      for (const thread of allThreads) {
        let arr = byMachine.get(thread.machine_id);
        if (!arr) {
          arr = [];
          byMachine.set(thread.machine_id, arr);
        }
        arr.push(thread);
      }
      for (const [machineId, threads] of byMachine) {
        counts[machineId] = getUnreadCount(threads);
      }
    }
    return counts;
  }, [allThreads, getUnreadCount]);
}
