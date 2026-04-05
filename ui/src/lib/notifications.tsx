import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { useAuth } from "@/apps/auth/auth-provider";

interface TaskNotification {
  type: "task_completed" | "task_error" | "task_timed_out" | "task_cancelled";
  thread_id: string;
  thread_title: string | null;
  machine_name: string;
  message_id: string;
  summary?: string;
}

function getNotificationLabel(type: TaskNotification["type"]): string {
  switch (type) {
    case "task_completed":
      return "Task completed";
    case "task_error":
      return "Task failed";
    case "task_timed_out":
      return "Task timed out";
    case "task_cancelled":
      return "Task cancelled";
  }
}

export function NotificationListener() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;

    const evtSource = new EventSource("/api/notifications/stream");

    evtSource.addEventListener("task:notification", (e) => {
      try {
        const data = JSON.parse(e.data) as TaskNotification;

        // Suppress notifications for the thread the user is currently viewing
        const currentPath = locationRef.current;
        if (currentPath === `/threads/${data.thread_id}`) return;

        const title = data.thread_title || "Untitled thread";
        const label = getNotificationLabel(data.type);

        if (data.type === "task_error" || data.type === "task_timed_out") {
          toast.error(`${label} — ${title}`, {
            description: data.machine_name,
            action: {
              label: "View",
              onClick: () => navigate(`/threads/${data.thread_id}`),
            },
            duration: 8000,
          });
        } else if (data.type === "task_completed") {
          toast.success(`${label} — ${title}`, {
            description: data.machine_name,
            action: {
              label: "View",
              onClick: () => navigate(`/threads/${data.thread_id}`),
            },
            duration: 5000,
          });
        }
        // Skip cancelled — user already knows
      } catch {
        // Ignore parse errors
      }
    });

    evtSource.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => evtSource.close();
  }, [user, navigate]);

  return null;
}
