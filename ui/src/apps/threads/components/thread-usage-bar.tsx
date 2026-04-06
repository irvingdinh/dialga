import {
  ClockIcon,
  CoinsIcon,
  HashIcon,
  MessageSquareIcon,
} from "lucide-react";

interface UsageData {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_duration_ms: number;
  message_count: number;
  models: Record<string, number>;
}

interface ThreadUsageBarProps {
  isOpen: boolean;
  usageData: UsageData | undefined;
}

export function ThreadUsageBar({ isOpen, usageData }: ThreadUsageBarProps) {
  if (!isOpen) return null;

  return (
    <div className="border-b px-4 py-2">
      <div className="mx-auto max-w-lg">
        {usageData && usageData.message_count > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {usageData.total_cost_usd > 0 && (
              <span className="text-foreground flex items-center gap-1 font-medium">
                <CoinsIcon className="size-3 shrink-0" />$
                {usageData.total_cost_usd.toFixed(4)}
              </span>
            )}
            {(usageData.total_input_tokens > 0 ||
              usageData.total_output_tokens > 0) && (
              <span className="text-muted-foreground flex items-center gap-1">
                <HashIcon className="size-3 shrink-0" />
                {(
                  usageData.total_input_tokens + usageData.total_output_tokens
                ).toLocaleString()}{" "}
                tokens
                <span className="opacity-60">
                  ({usageData.total_input_tokens.toLocaleString()} in /{" "}
                  {usageData.total_output_tokens.toLocaleString()} out)
                </span>
              </span>
            )}
            {usageData.total_duration_ms > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <ClockIcon className="size-3 shrink-0" />
                {usageData.total_duration_ms >= 60000
                  ? `${(usageData.total_duration_ms / 60000).toFixed(1)}m`
                  : `${(usageData.total_duration_ms / 1000).toFixed(1)}s`}
              </span>
            )}
            {usageData.message_count > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <MessageSquareIcon className="size-3 shrink-0" />
                {usageData.message_count} response
                {usageData.message_count !== 1 ? "s" : ""}
              </span>
            )}
            {Object.keys(usageData.models).length > 0 && (
              <span className="text-muted-foreground opacity-60">
                {Object.entries(usageData.models)
                  .map(([model, count]) =>
                    count > 1 ? `${model} ×${count}` : model,
                  )
                  .join(", ")}
              </span>
            )}
          </div>
        ) : usageData ? (
          <p className="text-muted-foreground text-xs">No usage data yet.</p>
        ) : (
          <p className="text-muted-foreground text-xs">Loading...</p>
        )}
      </div>
    </div>
  );
}
