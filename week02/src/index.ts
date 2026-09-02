import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import { AnalysisOutputError, analyzeArticle } from "./analyzer.js";
import { loadModelConfig } from "./env.js";
import {
  DEFAULT_PROMPT_VERSION,
  isPromptVersion,
  PROMPT_VERSIONS,
} from "./prompts.js";

async function main(): Promise<void> {
  const inputPath = resolve(process.argv[2] ?? "fixtures/sample-article.txt");
  const versionArgument = process.argv[3] ?? DEFAULT_PROMPT_VERSION;
  if (!isPromptVersion(versionArgument)) {
    throw new Error(
      `未知提示词版本：${versionArgument}。可用版本：${PROMPT_VERSIONS.join(", ")}`,
    );
  }
  const article = await readFile(inputPath, "utf8");
  const startedAt = performance.now();
  const result = await analyzeArticle(article, loadModelConfig(), {
    promptVersion: versionArgument,
  });
  const elapsedMs = performance.now() - startedAt;

  console.log(JSON.stringify(result.analysis, null, 2));
  console.log(`\n提示词版本：${result.promptVersion}`);
  console.log(`模型：${result.model}`);
  console.log(`耗时：${elapsedMs.toFixed(2)} ms`);
  if (result.usage) {
    console.log(
      `Token：输入 ${result.usage.inputTokens}，输出 ${result.usage.outputTokens}，总计 ${result.usage.totalTokens}`,
    );
  } else {
    console.log("Token：服务端未返回用量信息");
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return `输入错误：${z.prettifyError(error)}`;
  }

  if (error instanceof AnalysisOutputError) {
    return `结构化输出错误：${error.message}`;
  }

  if (error instanceof Error) {
    return `运行失败：${error.message}`;
  }

  return "运行失败：未知错误";
}

main().catch((error: unknown) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
