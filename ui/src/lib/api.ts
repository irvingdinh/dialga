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
    list: (threadId: string, params?: { limit?: number; before?: string }) => {
      const sp = new URLSearchParams();
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.before) sp.set("before", params.before);
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

  threads: {
    list: (machineId: string, params?: { status?: string; q?: string }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      if (params?.q) sp.set("q", params.q);
      const query = sp.toString() ? `?${sp.toString()}` : "";
      return request<
        Array<{
          id: string;
          machine_id: string;
          workspace_id: string | null;
          workspace_name: string | null;
          title: string | null;
          status: string;
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
        title: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>(`/api/threads/${threadId}`),
    update: (threadId: string, data: { title?: string; status?: string }) =>
      request<{
        id: string;
        machine_id: string;
        workspace_id: string | null;
        workspace_name: string | null;
        title: string | null;
        status: string;
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
  },
};
