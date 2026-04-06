import type { Components } from "react-markdown";
import Markdown from "react-markdown";

import { CodeBlock } from "@/apps/threads/components/code-block";

const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children);
    // Inline code (no language class, single line, short)
    if (!match && !code.includes("\n") && code.length < 200) {
      return (
        <code className="bg-muted rounded px-1.5 py-0.5 text-[13px]">
          {code}
        </code>
      );
    }
    return <CodeBlock language={match?.[1]}>{code}</CodeBlock>;
  },
};

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none overflow-x-hidden">
      <Markdown components={markdownComponents}>{children}</Markdown>
    </div>
  );
}
