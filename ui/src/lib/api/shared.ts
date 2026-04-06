import { request } from "./client";

export interface SharedMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SharedThread {
  thread: {
    id: string;
    title: string | null;
    workspace_name: string | null;
    created_at: string;
    updated_at: string;
  };
  messages: SharedMessage[];
}

export const sharedApi = {
  get: (token: string) => request<SharedThread>(`/api/shared/${token}`),
};
