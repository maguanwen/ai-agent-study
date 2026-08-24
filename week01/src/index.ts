import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { z } from "zod";

import { loadModelConfig } from "./env.js";
import { callModel } from "./model.js";

const questionSchema = z
  .string()
  .trim()
  .min(1, "问题不能为空")
  .max(2_000, "问题不能超过 2000 个字符");

async function main(): Promise<void> {
  const config = loadModelConfig();
  const terminal = createInterface({ input: stdin, output: stdout });

  try {
    const input = await terminal.question("你想问 AI 什么？\n> ");
    const question = questionSchema.parse(input);
    const startedAt = performance.now();

    const result = await callModel(question, config);
    const elapsedMs = performance.now() - startedAt;

    console.log(`\n回答：${result.answer}`);
    console.log(`模型：${result.model}`);
    console.log(`耗时：${elapsedMs.toFixed(2)} ms`);

    if (result.usage) {
      console.log(
        `Token：输入 ${result.usage.inputTokens}，输出 ${result.usage.outputTokens}，总计 ${result.usage.totalTokens}`,
      );
    } else {
      console.log("Token：服务端未返回用量信息");
    }
  } finally {
    terminal.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    console.error(`输入错误：${error.issues[0]?.message ?? "输入不合法"}`);
  } else if (error instanceof Error) {
    console.error(`程序运行失败：${error.message}`);
  } else {
    console.error("程序运行失败：未知错误");
  }

  process.exitCode = 1;
});
