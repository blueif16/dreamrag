"use client";

import { useState, useRef, useEffect } from "react";

interface ThinkingBlockProps {
  thinkingBlocks: string[];
  isLastBlockComplete: boolean;
  isStreaming: boolean;
}

function firstLine(text: string, max = 60): string {
  return text.length > max ? text.slice(0, max) + "\u2026" : text;
}

export function ThinkingBlock({ thinkingBlocks, isLastBlockComplete, isStreaming }: ThinkingBlockProps) {
  const [open, setOpen] = useState(true);
  const [userToggled, setUserToggled] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isComplete = isLastBlockComplete && !isStreaming;

  useEffect(() => {
    if (isComplete && !userToggled) {
      const t = setTimeout(() => setOpen(false), 600);
      return () => clearTimeout(t);
    }
  }, [isComplete, userToggled]);

  useEffect(() => {
    if (open && contentRef.current && !isComplete) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinkingBlocks, open, isComplete]);

  const activelyStreaming = isStreaming && !isLastBlockComplete;
  const preview = firstLine(thinkingBlocks[0] ?? "");

  return (
    <div className="mb-2 text-xs w-[80%]">
      <button
        className="flex w-full items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => { setUserToggled(true); setOpen((o) => !o); }}
        type="button"
      >
        {activelyStreaming ? (
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        )}
        <span className="font-medium">{activelyStreaming ? "Thinking\u2026" : "Thought process"}</span>
        {!open && preview && (
          <span className="truncate text-muted-foreground/50 font-normal">{preview}</span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div
          ref={contentRef}
          className="mt-1 max-h-48 overflow-y-auto font-mono whitespace-pre-wrap text-muted-foreground/80 leading-relaxed [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {thinkingBlocks.map((block, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div className="flex items-center gap-2 my-2 text-muted-foreground/40">
                  <div className="flex-1 h-px bg-border/50" />
                  <span>Step {idx + 1}</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
              )}
              <span>{block}</span>
              {idx === thinkingBlocks.length - 1 && !isLastBlockComplete && isStreaming && (
                <span className="inline-flex gap-0.5 ml-1 align-middle">
                  <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                  <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
