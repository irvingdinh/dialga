import {
  BotIcon,
  CpuIcon,
  FileTextIcon,
  FolderIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";

interface ThreadContextBarProps {
  isOpen: boolean;
  workspaceAgent: string | null;
  workspaceModel: string | null;
  workspaceCustomInstruction: string | null;
  workingDirectory: string | null;
  machineDefaultAgent?: string;
  machineDefaultModel?: string;
}

function agentLabel(agent: string): string {
  if (agent === "claude") return "Claude Code";
  if (agent === "codex") return "Codex CLI";
  return agent;
}

export function ThreadContextBar({
  isOpen,
  workspaceAgent,
  workspaceModel,
  workspaceCustomInstruction,
  workingDirectory,
  machineDefaultAgent,
  machineDefaultModel,
}: ThreadContextBarProps) {
  const [instructionExpanded, setInstructionExpanded] = useState(false);

  if (!isOpen) return null;

  const resolvedAgent = workspaceAgent || machineDefaultAgent || null;
  const resolvedModel = workspaceModel || machineDefaultModel || null;
  const agentSource = workspaceAgent ? "workspace" : "machine";
  const modelSource = workspaceModel ? "workspace" : "machine";

  const hasAnyInfo =
    resolvedAgent ||
    resolvedModel ||
    workingDirectory ||
    workspaceCustomInstruction;

  return (
    <div className="border-b px-4 py-2">
      <div className="mx-auto max-w-lg space-y-1.5">
        {!hasAnyInfo ? (
          <p className="text-muted-foreground text-xs">
            No workspace context configured.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {resolvedAgent && (
                <span className="text-foreground flex items-center gap-1 font-medium">
                  <BotIcon className="size-3 shrink-0" />
                  {agentLabel(resolvedAgent)}
                  <span className="text-muted-foreground font-normal opacity-60">
                    ({agentSource})
                  </span>
                </span>
              )}
              {resolvedModel && (
                <span className="text-foreground flex items-center gap-1 font-medium">
                  <SparklesIcon className="size-3 shrink-0" />
                  {resolvedModel}
                  <span className="text-muted-foreground font-normal opacity-60">
                    ({modelSource})
                  </span>
                </span>
              )}
              {workingDirectory && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <FolderIcon className="size-3 shrink-0" />
                  <span className="truncate font-mono text-[11px]">
                    {workingDirectory}
                  </span>
                </span>
              )}
            </div>
            {workspaceCustomInstruction && (
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => setInstructionExpanded((v) => !v)}
                  className="text-muted-foreground flex items-center gap-1 hover:underline"
                >
                  <FileTextIcon className="size-3 shrink-0" />
                  <span>Custom instruction</span>
                  <CpuIcon className="size-2.5 shrink-0 opacity-40" />
                </button>
                {instructionExpanded && (
                  <pre className="bg-muted text-muted-foreground mt-1 max-h-32 overflow-auto rounded-md px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {workspaceCustomInstruction}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Resolve the effective model from the resolution chain: workspace → machine */
export function resolveModel(
  workspaceModel: string | null | undefined,
  machineDefaultModel: string | null | undefined,
): string | null {
  return workspaceModel || machineDefaultModel || null;
}
