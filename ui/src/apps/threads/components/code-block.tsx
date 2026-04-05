import { CheckIcon, CopyIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BundledLanguage,
  bundledLanguages,
  type BundledTheme,
  codeToHtml,
} from "shiki";

const THEME: BundledTheme = "github-light";

// Only resolve languages that shiki actually supports
function resolveLanguage(lang: string | undefined): BundledLanguage | null {
  if (!lang) return null;
  const lower = lang.toLowerCase();
  if (lower in bundledLanguages) return lower as BundledLanguage;
  // Common aliases
  const aliases: Record<string, BundledLanguage> = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    py: "python",
    rb: "ruby",
    yml: "yaml",
    md: "markdown",
    mdx: "mdx",
    rs: "rust",
    dockerfile: "dockerfile",
    tf: "terraform",
    cs: "csharp",
    kt: "kotlin",
    objc: "objective-c",
  };
  return aliases[lower] ?? null;
}

export function CodeBlock({
  children,
  language,
}: {
  children: string;
  language?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const code = children.replace(/\n$/, "");
  const lang = resolveLanguage(language);

  useEffect(() => {
    if (!lang) return;
    let cancelled = false;

    codeToHtml(code, { lang, theme: THEME }).then((result) => {
      if (!cancelled) setHtml(result);
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group/code not-prose relative my-3 overflow-hidden rounded-lg border">
      {/* Header with language + copy button */}
      <div className="bg-muted/60 flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-muted-foreground text-[11px] font-medium">
          {language || "text"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      {html && lang ? (
        <div
          className="overflow-x-auto text-[13px] leading-relaxed [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!bg-transparent [&_pre]:px-4 [&_pre]:py-3"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
