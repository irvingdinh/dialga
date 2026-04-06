import {
  AlertCircleIcon,
  ArrowDownIcon,
  ChevronUpIcon,
  LoaderIcon,
  MessageSquareIcon,
  SearchIcon,
} from "lucide-react";
import type { RefObject } from "react";

import type { StreamEvent } from "@/apps/threads/components/message-item";
import { MessageItem } from "@/apps/threads/components/message-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
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
}

interface ThreadMessageListProps {
  messages: Message[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isSearchActive: boolean;
  searchQuery: string;
  searchResultCount: number | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadOlder: () => void;
  mergedStreamingEvents: Map<string, StreamEvent[]>;
  messageStatuses: Map<string, string>;
  onCancel: (messageId: string) => void;
  onRetryMessage: (messageId: string) => void;
  onFork: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  isNearBottom: boolean;
  hasNewMessages: boolean;
  onScrollToBottom: () => void;
}

function ThreadViewSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      <div className="flex gap-3">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-4 w-full max-w-80" />
          <Skeleton className="mt-1.5 h-4 w-full max-w-72" />
          <Skeleton className="mt-1.5 h-4 w-48" />
        </div>
      </div>
    </div>
  );
}

export function ThreadMessageList({
  messages,
  isLoading,
  isError,
  onRetry,
  isSearchActive,
  searchQuery,
  searchResultCount,
  hasNextPage,
  isFetchingNextPage,
  onLoadOlder,
  mergedStreamingEvents,
  messageStatuses,
  onCancel,
  onRetryMessage,
  onFork,
  onEdit,
  scrollContainerRef,
  bottomRef,
  isNearBottom,
  hasNewMessages,
  onScrollToBottom,
}: ThreadMessageListProps) {
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg">
        {isLoading && <ThreadViewSkeleton />}

        {isError && !isLoading && (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <AlertCircleIcon className="text-muted-foreground/40 mb-3 size-8" />
            <p className="text-muted-foreground text-sm">
              Failed to load thread.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Retry
            </Button>
          </div>
        )}

        {messages.length === 0 && !isLoading && !isError && (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            {isSearchActive ? (
              <>
                <SearchIcon className="text-muted-foreground/40 mb-3 size-8" />
                <p className="text-muted-foreground text-sm">
                  No messages match &ldquo;{searchQuery}&rdquo;
                </p>
              </>
            ) : (
              <>
                <MessageSquareIcon className="text-muted-foreground/40 mb-3 size-8" />
                <p className="text-muted-foreground text-sm">
                  No messages yet. Send one to get started.
                </p>
              </>
            )}
          </div>
        )}

        {isSearchActive &&
          searchResultCount !== undefined &&
          searchResultCount > 0 && (
            <div className="px-4 pt-3 pb-0">
              <p className="text-muted-foreground text-xs">
                {searchResultCount} result
                {searchResultCount !== 1 ? "s" : ""} for &ldquo;
                {searchQuery}&rdquo;
              </p>
            </div>
          )}

        {messages.length > 0 && (
          <div className="flex flex-col gap-6 px-4 py-4">
            {!isSearchActive && hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLoadOlder}
                  disabled={isFetchingNextPage}
                  className="text-muted-foreground gap-1.5 text-xs"
                >
                  {isFetchingNextPage ? (
                    <LoaderIcon className="size-3.5 animate-spin" />
                  ) : (
                    <ChevronUpIcon className="size-3.5" />
                  )}
                  {isFetchingNextPage ? "Loading..." : "Load older messages"}
                </Button>
              </div>
            )}

            {messages.map((msg) => {
              const effectiveStatus = messageStatuses.get(msg.id) ?? msg.status;
              return (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  streamEvents={
                    isSearchActive
                      ? undefined
                      : mergedStreamingEvents.get(msg.id)
                  }
                  overrideStatus={
                    isSearchActive ? undefined : messageStatuses.get(msg.id)
                  }
                  onCancel={
                    !isSearchActive &&
                    msg.role === "assistant" &&
                    effectiveStatus !== "completed" &&
                    effectiveStatus !== "cancelled" &&
                    effectiveStatus !== "error" &&
                    effectiveStatus !== "timed_out"
                      ? () => onCancel(msg.id)
                      : undefined
                  }
                  onRetry={
                    !isSearchActive &&
                    msg.role === "assistant" &&
                    (effectiveStatus === "error" ||
                      effectiveStatus === "timed_out")
                      ? () => onRetryMessage(msg.id)
                      : undefined
                  }
                  onFork={!isSearchActive ? () => onFork(msg.id) : undefined}
                  onEdit={
                    !isSearchActive && msg.role === "user"
                      ? (content: string) => onEdit(msg.id, content)
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!isNearBottom && !isSearchActive && (
        <div className="pointer-events-none sticky bottom-3 flex justify-center">
          <button
            type="button"
            onClick={onScrollToBottom}
            className="bg-background pointer-events-auto relative flex size-8 items-center justify-center rounded-full border shadow-md transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Scroll to bottom"
          >
            <ArrowDownIcon className="text-muted-foreground size-4" />
            {hasNewMessages && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-blue-500" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
