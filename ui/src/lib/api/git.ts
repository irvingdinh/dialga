import { request } from "./client";

export const gitApi = {
  status: (machineId: string, path: string) =>
    request<{
      root?: string;
      branch?: string;
      files?: Array<{ status: string; path: string; staged: boolean }>;
      error?: string;
    }>(
      `/api/machines/${machineId}/git/status?path=${encodeURIComponent(path)}`,
    ),
  diff: (machineId: string, path: string, file?: string) => {
    const sp = new URLSearchParams({ path });
    if (file) sp.set("file", file);
    return request<{ diff: string; file?: string | null; error?: string }>(
      `/api/machines/${machineId}/git/diff?${sp.toString()}`,
    );
  },
  log: (machineId: string, path: string, limit?: number) => {
    const sp = new URLSearchParams({ path });
    if (limit) sp.set("limit", String(limit));
    return request<{
      entries: Array<{
        hash: string;
        short_hash: string;
        author: string;
        date: string;
        message: string;
      }>;
      error?: string;
    }>(`/api/machines/${machineId}/git/log?${sp.toString()}`);
  },
  stage: (machineId: string, path: string, files: string[]) =>
    request<{ success: boolean; error?: string }>(
      `/api/machines/${machineId}/git/stage`,
      { method: "POST", body: JSON.stringify({ path, files }) },
    ),
  unstage: (machineId: string, path: string, files: string[]) =>
    request<{ success: boolean; error?: string }>(
      `/api/machines/${machineId}/git/unstage`,
      { method: "POST", body: JSON.stringify({ path, files }) },
    ),
  commit: (machineId: string, path: string, message: string) =>
    request<{
      success: boolean;
      commit?: {
        hash: string;
        short_hash: string;
        author: string;
        date: string;
        message: string;
      };
      error?: string;
    }>(`/api/machines/${machineId}/git/commit`, {
      method: "POST",
      body: JSON.stringify({ path, message }),
    }),
};
