import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { z } from "zod";

import {
  ChatSession,
  HELP_TEXT,
  parseCommand,
} from "./chat.js";
import { loadModelConfig } from "./env.js";
import { appendChatLog } from "./logger.js";
import { callModel } from "./model.js";

const questionSchema = z
  .string()
  .trim()
  .min(1, "问题不能为空")
  .max(2_000, "问题不能超过 2000 个字符");

async function main(): Promise<void> {
  const config = loadModelConfig();
  const session = new ChatSession(config.maxHistoryTurns);
  const terminal = createInterface({ input: stdin, output: stdout });

  try {
    console.log("AI Agent 多轮聊天已启动，输入 /help 查看命令。\n");

    while (true) {
      const input = await terminal.question("> ");
      const command = parseCommand(input);

      if (command === "exit") {
        console.log("再见！");
        break;
      }

      if (command === "help") {
        console.log(HELP_TEXT);
        continue;
      }

      if (command === "clear") {
        session.clear();
        console.log("对话历史已清空。");
        continue;
      }

      if (command === "history") {
        printHistory(session.getConversation());
        continue;
      }

      if (input.trim().startsWith("/")) {
        console.log("未知命令，请输入 /help 查看可用命令。");
        continue;
      }

      try {
        const question = questionSchema.parse(input);
        const messages = session.createRequestMessages(question);
        const startedAt = performance.now();
        const result = await callModel(messages, config);
        const elapsedMs = performance.now() - startedAt;

        session.commitTurn(question, result.answer);

        console.log(`\n助手：${result.answer}`);
        console.log(`模型：${result.model}`);
        console.log(`耗时：${elapsedMs.toFixed(2)} ms`);

        if (result.usage) {
          console.log(
            `Token：输入 ${result.usage.inputTokens}，输出 ${result.usage.outputTokens}，总计 ${result.usage.totalTokens}`,
          );
        } else {
          console.log("Token：服务端未返回用量信息");
        }

        try {
          await appendChatLog(config.logPath, {
            timestamp: new Date().toISOString(),
            question,
            answer: result.answer,
            model: result.model,
            elapsedMs,
            usage: result.usage,
          });
        } catch (error: unknown) {
          console.error(`日志写入失败：${getErrorMessage(error)}`);
        }

        console.log(`当前保留 ${session.turnCount} 轮对话。\n`);
      } catch (error: unknown) {
        console.error(getErrorMessage(error));
      }
    }
  } finally {
    terminal.close();
  }
}

function printHistory(
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>,
): void {
  if (messages.length === 0) {
    console.log("当前没有对话历史。");
    return;
  }

  console.log("\n对话历史：");
  for (const message of messages) {
    const label = message.role === "user" ? "用户" : "助手";
    console.log(`${label}：${message.content}`);
  }
  console.log();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return `输入错误：${error.issues[0]?.message ?? "输入不合法"}`;
  }

  if (error instanceof Error) {
    return `操作失败：${error.message}`;
  }

  return "操作失败：未知错误";
}

main().catch((error: unknown) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
