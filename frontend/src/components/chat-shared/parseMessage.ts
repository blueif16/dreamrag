export interface ParsedMessage {
  thinkingBlocks: string[];
  isLastBlockComplete: boolean;
  text: string;
}

export function parseMessage(content: string): ParsedMessage {
  const thinkingBlocks: string[] = [];
  let isLastBlockComplete = true;

  // Extract all complete <think>...</think> blocks
  const completeRe = /<think>([\s\S]*?)<\/think>/g;
  let match;
  while ((match = completeRe.exec(content)) !== null) {
    thinkingBlocks.push(match[1].trim());
  }

  // Remove all complete blocks to find text + possible open block
  let remaining = content.replace(/<think>[\s\S]*?<\/think>/g, "");

  // Check for unclosed <think>
  const openIdx = remaining.lastIndexOf("<think>");
  if (openIdx !== -1) {
    const partial = remaining.slice(openIdx + 7).trim();
    thinkingBlocks.push(partial);
    isLastBlockComplete = false;
    remaining = remaining.slice(0, openIdx);
  }

  return {
    thinkingBlocks,
    isLastBlockComplete,
    text: remaining.trim(),
  };
}
