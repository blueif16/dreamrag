"use client";

import { useCopilotKit } from "@copilotkitnext/react";
import { randomUUID } from "@ag-ui/client";
import type { Message, AbstractAgent } from "@ag-ui/client";
import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { parseMessage, ThinkingBlock, MessageActions, LoadingDots } from "@/components/chat-shared";

interface ChatProps {
  agent: AbstractAgent;
}

export function Chat({ agent }: ChatProps) {
  const { copilotkit } = useCopilotKit();

  const messages: Message[] = agent.messages;
  const isRunning = agent.isRunning;

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isListening, toggleListening } = useVoiceInput({
    onTranscript: (text) => setInput((prev) => prev ? `${prev} ${text}` : text),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isRunning) return;
    const text = input;
    setInput("");
    agent.addMessage({ id: randomUUID(), role: "user", content: text });
    copilotkit.runAgent({ agent });
  };

  const visibleMessages = messages.filter(
    (msg: any) => (msg.role === "user" || msg.role === "assistant") && msg.content?.trim()
  );

  // Merge thinkingBlocks from consecutive assistant messages into the first of each group
  const mergedThinking = new Map<string, string[]>();
  const skipThinking = new Set<string>();
  let currentGroupBlocks: string[] = [];
  let currentGroupFirstId: string | null = null;
  for (const msg of visibleMessages as any[]) {
    if (msg.role === "user") {
      currentGroupBlocks = [];
      currentGroupFirstId = null;
    } else {
      const { thinkingBlocks } = parseMessage(msg.content);
      if (currentGroupFirstId === null) {
        currentGroupFirstId = msg.id;
        currentGroupBlocks = [...thinkingBlocks];
        mergedThinking.set(msg.id, currentGroupBlocks);
      } else {
        currentGroupBlocks.push(...thinkingBlocks);
        mergedThinking.set(currentGroupFirstId, currentGroupBlocks);
        skipThinking.add(msg.id);
      }
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {visibleMessages?.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p>Send a message to get started.</p>
            </div>
          )}

          {visibleMessages.map((msg: any, i: number) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="mb-4 flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  </div>
                </div>
              );
            }
            const isLastMsg = i === visibleMessages.length - 1;
            const { text, isLastBlockComplete } = parseMessage(msg.content);
            const blocksToShow = skipThinking.has(msg.id) ? [] : (mergedThinking.get(msg.id) ?? []);
            return (
              <div key={msg.id} className="mb-4 flex flex-col items-start">
                  {blocksToShow.length > 0 && (
                    <ThinkingBlock
                      thinkingBlocks={blocksToShow}
                      isLastBlockComplete={isLastBlockComplete}
                      isStreaming={isLastMsg && isRunning}
                    />
                  )}
                <div className="flex flex-col items-start max-w-[80%]">
                  {text && (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                      <Markdown>{text}</Markdown>
                    </div>
                  )}
                  {text && <MessageActions text={text} />}
                </div>
              </div>
            );
          })}

          {isRunning && (
            <div className="mb-4 flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-3">
                <LoadingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <input
            autoFocus
            className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none ring-ring focus:ring-2"
            disabled={isRunning}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            value={input}
          />
          <button
            className={cn(
              "flex items-center justify-center rounded-xl border p-3 transition-colors",
              isListening
                ? "border-red-500 bg-red-50 text-red-500 dark:bg-red-950"
                : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            onClick={toggleListening}
            type="button"
            title={isListening ? "Stop recording" : "Voice input"}
            disabled={isRunning}
          >
            {isListening ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            )}
          </button>
          {isRunning ? (
            <button
              className="flex items-center justify-center rounded-xl border bg-background p-3 text-foreground hover:bg-muted"
              onClick={() => agent.abortRun()}
              type="button"
              title="Stop"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            </button>
          ) : (
            <button
              className="flex items-center justify-center rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-50"
              disabled={!input.trim()}
              onClick={handleSend}
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Dev state viewer */}
      {process.env.NODE_ENV === "development" && (
        <details className="fixed bottom-20 right-4 z-50 max-h-96 max-w-sm overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-300 shadow-lg">
          <summary className="cursor-pointer font-mono text-gray-400">
            Agent State
          </summary>
          <pre className="mt-2 font-mono">
            {agent.state ? JSON.stringify(agent.state, null, 2) : 'No state'}
          </pre>
        </details>
      )}
    </div>
  );
}
