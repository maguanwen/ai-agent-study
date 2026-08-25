import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { appendChatLog } from "../src/logger.js";

describe("appendChatLog", () => {
  it("以 JSON Lines 格式追加对话记录", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-agent-study-"));
    const logPath = join(directory, "nested", "chat.jsonl");

    try {
      await appendChatLog(logPath, {
        timestamp: "2026-08-25T00:00:00.000Z",
        question: "什么是 Agent？",
        answer: "Agent 是能够执行任务的程序。",
        model: "test-model",
        elapsedMs: 123,
        usage: undefined,
      });

      const content = await readFile(logPath, "utf8");
      expect(JSON.parse(content.trim())).toMatchObject({
        question: "什么是 Agent？",
        model: "test-model",
      });
      expect(content).not.toContain("MODEL_API_KEY");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
