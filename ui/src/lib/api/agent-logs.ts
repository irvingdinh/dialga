import { request } from "./client";

export interface AgentLogEntry {
  id: string;
  machine_id: string;
  type: string;
  message: string;
  metadata: string | null;
  created_at: string;
}

export const agentLogsApi = {
  list: (
    machineId: string,
    opts?: { limit?: number; before?: string; type?: string },
  ) => {
    const sp = new URLSearchParams();
    if (opts?.limit) sp.set("limit", String(opts.limit));
    if (opts?.before) sp.set("before", opts.before);
    if (opts?.type) sp.set("type", opts.type);
    const query = sp.toString() ? `?${sp.toString()}` : "";
    return request<{ logs: AgentLogEntry[]; has_more: boolean }>(
      `/api/machines/${machineId}/logs${query}`,
    );
  },
};
