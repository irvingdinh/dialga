import { useEffect, useRef } from "react";

/**
 * Subscribe to thread:update SSE events for a specific machine.
 * Manages an EventSource connection to /api/machines/:machineId/threads/stream.
 * The callback fires on each thread:update event (no parsed data — the event carries no payload).
 */
export function useThreadUpdates(
  machineId: string | undefined,
  onUpdate: () => void,
) {
  const callbackRef = useRef(onUpdate);

  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!machineId) return;

    const evtSource = new EventSource(
      `/api/machines/${machineId}/threads/stream`,
    );

    evtSource.addEventListener("thread:update", () => {
      callbackRef.current();
    });

    return () => evtSource.close();
  }, [machineId]);
}
