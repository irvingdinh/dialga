import { request } from "./client";

export const tasksApi = {
  active: () =>
    request<{
      tasks: Array<{
        message_id: string;
        thread_id: string;
        thread_title: string | null;
        machine_id: string;
        machine_name: string;
        workspace_name: string | null;
        status: string;
        model: string | null;
        created_at: string;
        started_at: string | null;
      }>;
    }>("/api/tasks/active"),
};

export const activityApi = {
  recent: (limit?: number) => {
    const sp = new URLSearchParams();
    if (limit) sp.set("limit", String(limit));
    const query = sp.toString() ? `?${sp.toString()}` : "";
    return request<{
      items: Array<{
        message_id: string;
        thread_id: string;
        thread_title: string | null;
        machine_id: string;
        machine_name: string;
        workspace_name: string | null;
        status: string;
        model: string | null;
        content: string | null;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
      }>;
    }>(`/api/activity/recent${query}`);
  },
};

export const usageApi = {
  summary: () =>
    request<{
      total_cost_usd: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_duration_ms: number;
      message_count: number;
      models: Record<string, number>;
      by_machine: Array<{
        machine_id: string;
        machine_name: string;
        total_cost_usd: number;
        total_input_tokens: number;
        total_output_tokens: number;
        message_count: number;
      }>;
    }>("/api/usage/summary"),
};
