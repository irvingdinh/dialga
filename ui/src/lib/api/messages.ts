import { request } from "./client";

export const messagesApi = {
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
  edit: (messageId: string, content: string) =>
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
    }>(`/api/messages/${messageId}/edit`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};
