import { useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  BotIcon,
  FolderIcon,
  LinkIcon,
  UserIcon,
} from "lucide-react";
import { useMemo } from "react";

import { MarkdownContent } from "@/apps/threads/components/markdown-content";
import {
  CopyMessageButton,
  extractCopyableText,
} from "@/apps/threads/components/message-actions";
import {
  EventGroupRenderer,
  parseMetadataEvents,
} from "@/apps/threads/components/message-content-blocks";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type SharedMessage } from "@/lib/api";

function SharedMessageItem({ message }: { message: SharedMessage }) {
  const isUser = message.role === "user";
  const metadataGroups = useMemo(
    () => parseMetadataEvents(message.metadata),
    [message.metadata],
  );
  const copyableText = useMemo(
    () =>
      !isUser && message.status === "completed"
        ? extractCopyableText(message.content, message.metadata)
        : "",
    [isUser, message.status, message.content, message.metadata],
  );

  if (isUser) {
    return (
      <div className="group/msg flex gap-3">
        <div className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full">
          <UserIcon className="text-muted-foreground size-3" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">User</span>
            <span className="text-muted-foreground text-[11px]">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <CopyMessageButton text={message.content} />
          </div>
          <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100">
        <BotIcon className="size-3 text-white dark:text-neutral-900" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Assistant</span>
          {message.model && (
            <Badge variant="secondary" className="text-[10px]">
              {message.model}
            </Badge>
          )}
          <span className="text-muted-foreground text-[11px]">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.status === "completed" && (
            <CopyMessageButton text={copyableText} />
          )}
        </div>
        <div className="mt-2">
          {message.status === "completed" &&
            (metadataGroups ? (
              <EventGroupRenderer groups={metadataGroups} />
            ) : (
              message.content && (
                <MarkdownContent>{message.content}</MarkdownContent>
              )
            ))}
          {(message.status === "error" || message.status === "timed_out") &&
            message.content && (
              <p className="text-muted-foreground mt-1 text-sm italic">
                {message.content}
              </p>
            )}
          {message.status === "cancelled" && (
            <p className="text-muted-foreground mt-1 text-sm italic">
              Cancelled
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SharedThreadPage({
  shareToken,
}: {
  shareToken: string;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["shared-thread", shareToken],
    queryFn: () => api.shared.get(shareToken),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-dvh items-start justify-center pt-16">
        <div className="w-full max-w-2xl px-4">
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="mb-8 h-4 w-32" />
          <div className="space-y-6">
            <div className="flex gap-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    const status =
      error && "status" in error ? (error as { status: number }).status : 0;
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <AlertCircleIcon className="text-muted-foreground mx-auto mb-3 size-10" />
          <h2 className="mb-1 text-lg font-semibold">
            {status === 404 ? "Thread not found" : "Something went wrong"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {status === 404
              ? "This shared link may have been removed or is no longer available."
              : "Failed to load the shared thread. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { thread, messages } = data;

  return (
    <div className="bg-background min-h-dvh">
      {/* Header */}
      <div className="border-b">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <div className="text-muted-foreground mb-3 flex items-center gap-2 text-[11px]">
            <LinkIcon className="size-3" />
            <span className="tracking-wide uppercase">Shared conversation</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            {thread.title ?? "Untitled Thread"}
          </h1>
          <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-xs">
            {thread.workspace_name && (
              <span className="flex items-center gap-1">
                <FolderIcon className="size-3" />
                {thread.workspace_name}
              </span>
            )}
            <span>
              {new Date(thread.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            This thread has no messages.
          </p>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <SharedMessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <p className="text-muted-foreground text-center text-[11px] tracking-wide uppercase">
            Shared via Dialga
          </p>
        </div>
      </div>
    </div>
  );
}
