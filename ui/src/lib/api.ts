export interface HealthInfo {
  agents: {
    claude: { available: boolean; version?: string; error?: string };
    codex: { available: boolean; version?: string; error?: string };
  };
  os: string;
  os_version: string;
  arch: string;
  node_version: string;
  running_tasks: string[];
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

// Auth
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ success: true }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    session: () =>
      request<{ id: string; email: string; name: string }>("/api/auth"),
    logout: () =>
      request<{ success: true }>("/api/auth/logout", { method: "POST" }),
    updateProfile: (data: { name?: string }) =>
      request<{ id: string; email: string; name: string }>(
        "/api/auth/profile",
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: true }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      }),
  },

  machines: {
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
  },

  fs: {
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
  },

  git: {
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
  },

  workspaces: {
    list: (machineId: string) =>
      request<
        Array<{
          id: string;
          machine_id: string;
          name: string;
          working_directory: string;
          custom_instruction: string | null;
          agent: string | null;
          model: string | null;
          created_at: string;
        }>
      >(`/api/machines/${machineId}/workspaces`),
    create: (
      machineId: string,
      data: {
        name: string;
        working_directory: string;
        custom_instruction?: string;
        agent?: string;
        model?: string;
      },
    ) =>
      request<{
        id: string;
        machine_id: string;
        name: string;
        working_directory: string;
        custom_instruction: string | null;
        agent: string | null;
        model: string | null;
        created_at: string;
      }>(`/api/machines/${machineId}/workspaces`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        working_directory?: string;
        custom_instruction?: string;
        agent?: string;
        model?: string;
      },
    ) =>
      request<{
        id: string;
        machine_id: string;
        name: string;
        working_directory: string;
        custom_instruction: string | null;
        agent: string | null;
        model: string | null;
      }>(`/api/workspaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: true }>(`/api/workspaces/${id}`, {
        method: "DELETE",
      }),
  },

  messages: {
    list: (
      threadId: string,
      params?: { limit?: number; before?: string; q?: string },
    ) => {
      const sp = new URLSearchParams();
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.before) sp.set("before", params.before);
      if (params?.q) sp.set("q", params.q);
      const query = sp.toString() ? `?${sp.toString()}` : "";
      return request<{
        messages: Array<{
          id: string;
          thread_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          model: string | null;
          status: string;
          metadata: Record<string, unknown> | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        }>;
        has_more: boolean;
      }>(`/api/threads/${threadId}/messages${query}`);
    },
    send: (threadId: string, data: { content: string; model?: string }) =>
      request<{
        user_message: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          status: string;
          created_at: string;
        };
        assistant_message: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          model: string | null;
          status: string;
          created_at: string;
        };
      }>(`/api/threads/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    cancel: (messageId: string) =>
      request<{ id: string; status: string; completed_at: string }>(
        `/api/messages/${messageId}/cancel`,
        { method: "POST" },
      ),
    retry: (messageId: string) =>
      request<{
        assistant_message: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          model: string | null;
          status: string;
          created_at: string;
        };
      }>(`/api/messages/${messageId}/retry`, { method: "POST" }),
  },

  tasks: {
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
  },

  activity: {
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
  },

  threads: {
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
  },

  usage: {
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
  },
};
