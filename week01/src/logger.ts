import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { TokenUsage } from "./model.js";

export interface ChatLogEntry {
  timestamp: string;
  question: string;
  answer: string;
  model: string;
  elapsedMs: number;
  usage: TokenUsage | undefined;
}

export async function appendChatLog(
  logPath: string,
  entry: ChatLogEntry,
): Promise<void> {
  const absolutePath = resolve(logPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await appendFile(absolutePath, `${JSON.stringify(entry)}\n`, "utf8");
}
