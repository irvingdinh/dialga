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

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
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
