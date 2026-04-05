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
};
