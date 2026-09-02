import "dotenv/config";

import { loadModelConfig } from "./env.js";
import { evaluationCases } from "./evaluation-cases.js";
import { runEvaluationSuite } from "./evaluation.js";
import { callModel } from "./model.js";
import { PROMPT_VERSIONS } from "./prompts.js";
import { writeEvaluationReport } from "./report.js";

async function main(): Promise<void> {
  const config = loadModelConfig();
  const totalRequests = evaluationCases.length * PROMPT_VERSIONS.length;
  let completedRequests = 0;

  console.log(
    `开始评测：${evaluationCases.length} 个案例 × ${PROMPT_VERSIONS.length} 个提示词版本 = ${totalRequests} 次模型请求。`,
  );

  const report = await runEvaluationSuite(
    evaluationCases,
    PROMPT_VERSIONS,
    config,
    callModel,
    (result) => {
      completedRequests += 1;
      console.log(
        `[${completedRequests}/${totalRequests}] ${result.promptVersion} / ${result.caseId}：${result.success ? "通过" : "失败"}`,
      );
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
