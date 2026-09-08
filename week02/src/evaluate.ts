import "dotenv/config";

import { loadEvaluationConfig, loadModelConfig } from "./env.js";
import { evaluationCases } from "./evaluation-cases.js";
import { runEvaluationSuite } from "./evaluation.js";
import {
  callModel,
  createRequestScheduler,
  withRateLimitRetry,
} from "./model.js";
import { PROMPT_VERSIONS } from "./prompts.js";
import { writeEvaluationReport } from "./report.js";

async function main(): Promise<void> {
  const config = loadModelConfig();
  const evaluationConfig = loadEvaluationConfig();
  const totalCases = evaluationCases.length * PROMPT_VERSIONS.length;
  let completedCases = 0;

  console.log(
    `开始评测：${evaluationCases.length} 个案例 × ${PROMPT_VERSIONS.length} 个提示词版本 = ${totalCases} 次基础分析。输出修复和 429 重试可能产生额外 HTTP 请求。`,
  );
  console.log(
    `首次请求等待：${evaluationConfig.initialDelayMs} ms；所有 HTTP 请求间隔：${evaluationConfig.requestIntervalMs} ms；429 最大重试：${evaluationConfig.maxRetries} 次。`,
  );
  console.log(
    `连续 429 后冷却：${evaluationConfig.rateLimitCooldownMs} ms；每个案例最多冷却 ${evaluationConfig.maxRateLimitCooldowns} 次。`,
  );

  const waitForRequestSlot = createRequestScheduler({
    intervalMs: evaluationConfig.requestIntervalMs,
    initialDelayMs: evaluationConfig.initialDelayMs,
  });

  const modelCaller = withRateLimitRetry(callModel, {
    maxRetries: evaluationConfig.maxRetries,
    baseDelayMs: evaluationConfig.retryBaseDelayMs,
    maxDelayMs: evaluationConfig.retryMaxDelayMs,
    beforeAttempt: waitForRequestSlot,
    onRetry: ({ attempt, maxAttempts, delayMs }) => {
      console.warn(
        `请求受到限流，第 ${attempt}/${maxAttempts} 次尝试失败，${delayMs} ms 后重试。`,
      );
    },
  });

  const report = await runEvaluationSuite(
    evaluationCases,
    PROMPT_VERSIONS,
    config,
    modelCaller,
    (result) => {
      completedCases += 1;
      console.log(
        `[${completedCases}/${totalCases}] ${result.promptVersion} / ${result.caseId}：${result.success ? "通过" : `失败（${result.errorKind ?? "业务约束"}）`}，HTTP 尝试 ${result.attempts} 次，输出修复 ${result.repairAttempts} 次`,
      );
    },
    {
      rateLimitCooldownMs: evaluationConfig.rateLimitCooldownMs,
      maxRateLimitCooldowns: evaluationConfig.maxRateLimitCooldowns,
      onRateLimitCooldown: ({
        testCase,
        promptVersion,
        cooldown,
        maxCooldowns,
        delayMs,
      }) => {
        console.warn(
          `${promptVersion} / ${testCase.id} 连续受到限流，执行第 ${cooldown}/${maxCooldowns} 次冷却，${delayMs} ms 后重新运行当前案例。`,
        );
      },
    },
  );
  const paths = await writeEvaluationReport(report);

  console.log(`\nJSON 报告：${paths.jsonPath}`);
  console.log(`Markdown 报告：${paths.markdownPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`评测失败：${message}`);
  process.exitCode = 1;
});
