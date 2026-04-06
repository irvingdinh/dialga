export { type AgentLogEntry, agentLogsApi } from "./agent-logs";
export { authApi } from "./auth";
export { ApiError, type HealthInfo } from "./client";
export { activityApi, tasksApi, usageApi } from "./dashboard";
export { fsApi } from "./fs";
export { gitApi } from "./git";
export { machinesApi } from "./machines";
export { messagesApi } from "./messages";
export { threadsApi } from "./threads";
export { workspacesApi } from "./workspaces";

import { agentLogsApi } from "./agent-logs";
import { authApi } from "./auth";
import { activityApi, tasksApi, usageApi } from "./dashboard";
import { fsApi } from "./fs";
import { gitApi } from "./git";
import { machinesApi } from "./machines";
import { messagesApi } from "./messages";
import { threadsApi } from "./threads";
import { workspacesApi } from "./workspaces";

export const api = {
  auth: authApi,
  machines: machinesApi,
  fs: fsApi,
  git: gitApi,
  workspaces: workspacesApi,
  messages: messagesApi,
  threads: threadsApi,
  tasks: tasksApi,
  activity: activityApi,
  usage: usageApi,
  agentLogs: agentLogsApi,
};
