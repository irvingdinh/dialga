import { ApiError, request } from "./client";

export const threadsApi = {
  listAll: (params?: {
    machine_id?: string;
    status?: string;
    q?: string;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.machine_id) sp.set("machine_id", params.machine_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.q) sp.set("q", params.q);
    if (params?.sort) sp.set("sort", params.sort);
    const query = sp.toString() ? `?${sp.toString()}` : "";
    return request<
      Array<{
        id: string;
        machine_id: string;
        machine_name: string | null;
        machine_status: string;
        workspace_id: string | null;
        workspace_name: string | null;
        title: string | null;
        status: string;
        is_pinned: boolean;
        message_count: number;
        latest_message: {
          role: string;
          content: string;
          status: string;
        } | null;
        created_at: string;
        updated_at: string;
      }>
    >(`/api/threads${query}`);
  },
  list: (
    machineId: string,
    params?: { status?: string; q?: string; sort?: string },
  ) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.q) sp.set("q", params.q);
    if (params?.sort) sp.set("sort", params.sort);
    const query = sp.toString() ? `?${sp.toString()}` : "";
    return request<
      Array<{
        id: string;
        machine_id: string;
        workspace_id: string | null;
        workspace_name: string | null;
        title: string | null;
        status: string;
        is_pinned: boolean;
        message_count: number;
        latest_message: {
          role: string;
          content: string;
          status: string;
        } | null;
        created_at: string;
        updated_at: string;
      }>
    >(`/api/machines/${machineId}/threads${query}`);
  },
  create: (machineId: string, data?: { workspace_id?: string }) =>
    request<{
      id: string;
      machine_id: string;
      workspace_id: string | null;
      title: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(`/api/machines/${machineId}/threads`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  get: (threadId: string) =>
    request<{
      id: string;
      machine_id: string;
      workspace_id: string | null;
      workspace_name: string | null;
      working_directory: string | null;
      workspace_agent: string | null;
      workspace_model: string | null;
      workspace_custom_instruction: string | null;
      title: string | null;
      status: string;
      is_pinned: boolean;
      created_at: string;
      updated_at: string;
    }>(`/api/threads/${threadId}`),
  update: (
    threadId: string,
    data: {
      title?: string;
      status?: string;
      workspace_id?: string | null;
      is_pinned?: boolean;
    },
  ) =>
    request<{
      id: string;
      machine_id: string;
      workspace_id: string | null;
      workspace_name: string | null;
      working_directory: string | null;
      workspace_agent: string | null;
      workspace_model: string | null;
      workspace_custom_instruction: string | null;
      title: string | null;
      status: string;
      is_pinned: boolean;
      created_at: string;
      updated_at: string;
    }>(`/api/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (threadId: string) =>
    request<{ success: true }>(`/api/threads/${threadId}`, {
      method: "DELETE",
    }),
  bulk: (threadIds: string[], action: "archive" | "unarchive" | "delete") =>
    request<{ success: true; affected: number }>(`/api/threads/bulk`, {
      method: "POST",
      body: JSON.stringify({ thread_ids: threadIds, action }),
    }),
  search: (q: string) =>
    request<
      Array<{
        id: string;
        machine_id: string;
        machine_name: string;
        workspace_name: string | null;
        title: string | null;
        status: string;
        updated_at: string;
      }>
    >(`/api/threads/search?q=${encodeURIComponent(q)}`),
  usage: (threadId: string) =>
    request<{
      total_cost_usd: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_duration_ms: number;
      message_count: number;
      models: Record<string, number>;
    }>(`/api/threads/${threadId}/usage`),
  fork: (threadId: string, afterMessageId: string) =>
    request<{
      id: string;
      machine_id: string;
      workspace_id: string | null;
      workspace_name: string | null;
      working_directory: string | null;
      workspace_agent: string | null;
      workspace_model: string | null;
      workspace_custom_instruction: string | null;
      title: string | null;
      status: string;
      is_pinned: boolean;
      created_at: string;
      updated_at: string;
    }>(`/api/threads/${threadId}/fork`, {
      method: "POST",
      body: JSON.stringify({ after_message_id: afterMessageId }),
    }),
  exportMarkdown: async (threadId: string): Promise<void> => {
    const res = await fetch(`/api/threads/${threadId}/export.md`, {
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.message ?? res.statusText);
    }
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filenameMatch = disposition.match(/filename="(.+)"/);
    const filename = filenameMatch?.[1] ?? "thread.md";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
