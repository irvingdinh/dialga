import { request } from "./client";

export const workspacesApi = {
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
};
