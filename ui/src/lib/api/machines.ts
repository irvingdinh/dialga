import type { HealthInfo } from "./client";
import { request } from "./client";

export const machinesApi = {
  list: () =>
    request<
      Array<{
        id: string;
        name: string;
        default_agent: string;
        default_model: string;
        status: string;
        health_info: HealthInfo | null;
        last_seen_at: string | null;
        created_at: string;
        thread_count: number;
        workspace_count: number;
      }>
    >("/api/machines"),
  create: (data: {
    name: string;
    default_agent?: string;
    default_model?: string;
  }) =>
    request<{ id: string; name: string; token: string }>("/api/machines", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  get: (id: string) =>
    request<{
      id: string;
      name: string;
      default_agent: string;
      default_model: string;
      status: string;
      health_info: HealthInfo | null;
      last_seen_at: string | null;
      created_at: string;
    }>(`/api/machines/${id}`),
  update: (
    id: string,
    data: { name?: string; default_agent?: string; default_model?: string },
  ) =>
    request<{
      id: string;
      name: string;
      default_agent: string;
      default_model: string;
      status: string;
    }>(`/api/machines/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: true }>(`/api/machines/${id}`, { method: "DELETE" }),
  regenerateToken: (id: string) =>
    request<{ token: string }>(`/api/machines/${id}/regenerate-token`, {
      method: "POST",
    }),
};
