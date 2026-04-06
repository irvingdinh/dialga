import { useQuery } from "@tanstack/react-query";
import { ClockIcon, CoinsIcon, HashIcon, ZapIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { api } from "@/lib/api";

export function UsageSummary() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["usage", "summary"],
    queryFn: api.usage.summary,
    staleTime: 60_000,
  });

  if (!data || data.message_count === 0) return null;

  const totalTokens = data.total_input_tokens + data.total_output_tokens;

  return (
    <div className="mt-6">
      <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Usage Overview
      </h2>
      <div className="rounded-2xl border px-4 py-3">
        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {data.total_cost_usd > 0 && (
            <span className="flex items-center gap-1.5 font-medium">
              <CoinsIcon className="text-muted-foreground size-3.5 shrink-0" />$
              {data.total_cost_usd.toFixed(2)}
            </span>
          )}
          {totalTokens > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <HashIcon className="size-3.5 shrink-0" />
              {totalTokens >= 1_000_000
                ? `${(totalTokens / 1_000_000).toFixed(1)}M`
                : totalTokens >= 1_000
                  ? `${(totalTokens / 1_000).toFixed(1)}K`
                  : totalTokens}{" "}
              tokens
            </span>
          )}
          {data.message_count > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ZapIcon className="size-3.5 shrink-0" />
              {data.message_count} response
              {data.message_count !== 1 ? "s" : ""}
            </span>
          )}
          {data.total_duration_ms > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ClockIcon className="size-3.5 shrink-0" />
              {data.total_duration_ms >= 3_600_000
                ? `${(data.total_duration_ms / 3_600_000).toFixed(1)}h`
                : data.total_duration_ms >= 60_000
                  ? `${(data.total_duration_ms / 60_000).toFixed(1)}m`
                  : `${(data.total_duration_ms / 1_000).toFixed(1)}s`}
            </span>
          )}
        </div>

        {/* Model breakdown */}
        {Object.keys(data.models).length > 0 && (
          <div className="text-muted-foreground mt-1.5 pl-[22px] text-xs opacity-60">
            {Object.entries(data.models)
              .sort(([, a], [, b]) => b - a)
              .map(([model, count]) =>
                count > 1 ? `${model} ×${count}` : model,
              )
              .join(", ")}
          </div>
        )}

        {/* Per-machine breakdown */}
        {data.by_machine.length > 1 && (
          <div className="mt-2.5 border-t pt-2.5">
            <div className="flex flex-col gap-1">
              {data.by_machine.map((m) => (
                <button
                  key={m.machine_id}
                  onClick={() => navigate(`/machines/${m.machine_id}/threads`)}
                  className="hover:bg-muted/50 -mx-1 flex items-center justify-between rounded-lg px-1 py-0.5 text-xs transition-colors"
                >
                  <span className="text-muted-foreground truncate">
                    {m.machine_name}
                  </span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-3 tabular-nums">
                    {m.total_cost_usd > 0 && (
                      <span>${m.total_cost_usd.toFixed(2)}</span>
                    )}
                    <span>
                      {(
                        m.total_input_tokens + m.total_output_tokens
                      ).toLocaleString()}{" "}
                      tok
                    </span>
                    <span>
                      {m.message_count} msg{m.message_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
