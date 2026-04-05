import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, MessageSquareIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function ThreadViewPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();

  const { data: thread } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.threads.get(threadId!),
    enabled: !!threadId,
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (thread?.machine_id) {
              navigate(`/machines/${thread.machine_id}/threads`);
            } else {
              navigate(-1);
            }
          }}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {thread?.title ?? "New thread"}
          </h1>
          {thread?.workspace_name && (
            <p className="text-muted-foreground truncate text-xs">
              {thread.workspace_name}
            </p>
          )}
        </div>
      </div>

      {/* Placeholder */}
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center text-center text-sm">
        <MessageSquareIcon className="text-muted-foreground/40 mb-3 size-8" />
        <p>Chat view coming in the next phase.</p>
        <p className="mt-1">Thread created successfully.</p>
      </div>
    </div>
  );
}
