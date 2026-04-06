import { request } from "./client";

export const fsApi = {
  list: (machineId: string, path: string) =>
    request<{
      path: string;
      entries: Array<{ name: string; type: "directory" | "file" }>;
      error?: string;
    }>(`/api/machines/${machineId}/fs?path=${encodeURIComponent(path)}`),
  mkdir: (machineId: string, path: string) =>
    request<{ success: boolean; error?: string }>(
      `/api/machines/${machineId}/fs/mkdir`,
      {
        method: "POST",
        body: JSON.stringify({ path }),
      },
    ),
  read: (machineId: string, path: string) =>
    request<{
      path: string;
      content: string | null;
      size?: number;
      error?: string;
    }>(`/api/machines/${machineId}/fs/read?path=${encodeURIComponent(path)}`),
};
