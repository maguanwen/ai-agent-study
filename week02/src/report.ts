import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  EvaluationCaseResult,
  EvaluationReport,
  EvaluationSummary,
} from "./evaluation.js";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function numberOrDash(value: number | undefined): string {
  return value === undefined ? "—" : String(value);
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function summaryRow(summary: EvaluationSummary): string {
  return [
    summary.promptVersion,
    `${summary.successfulCases}/${summary.requestSucceededCases}`,
    percent(summary.requestSuccessRate),
    String(summary.rateLimitFailureCases),
    percent(summary.jsonParseRate),
    percent(summary.schemaPassRate),
    percent(summary.constraintPassRate),
    percent(summary.adversarialPassRate),
    percent(summary.averageRequiredTermCoverage),
    summary.averageElapsedMs.toFixed(2),
    numberOrDash(summary.totalTokens),
  ].join(" | ");
}

function caseRow(result: EvaluationCaseResult): string {
  return [
    result.promptVersion,
    result.caseId,
    result.category,
    result.requestSucceeded ? "成功" : "失败",
    result.success ? "通过" : "失败",
    String(result.attempts),
    percent(result.metrics.requiredTermCoverage),
    result.metrics.forbiddenTextFound ? "是" : "否",
    result.elapsedMs.toFixed(2),
    numberOrDash(result.usage?.totalTokens),
    result.errorKind ?? "",
    escapeCell(result.error ?? ""),
    result.manualReview.score === null
      ? "待评分"
      : String(result.manualReview.score),
    escapeCell(result.manualReview.notes),
  ].join(" | ");
}

export function renderMarkdownReport(report: EvaluationReport): string {
  const lines = [
    "# Week 02 提示词评测报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 模型：${report.model}`,
    `- 提示词版本：${report.evaluations.map((item) => item.summary.promptVersion).join(", ")}`,
    "",
    "## 汇总对比",
    "",
    "版本 | 业务成功* | 请求成功率 | 429 失败 | JSON 解析率* | Schema 通过率* | 约束通过率* | 对抗通过率* | 必需词覆盖率* | 平均耗时(ms)* | 总 token",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...report.evaluations.map((item) => summaryRow(item.summary)),
    "",
    "## 分案例结果",
    "",
    "版本 | 案例 | 类别 | 请求 | 业务结果 | 尝试次数 | 必需词覆盖率 | 命中禁止文本 | 耗时(ms) | token | 错误分类 | 错误 | 人工分数 | 人工备注",
    "--- | --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- | ---: | ---",
    ...report.evaluations.flatMap((item) => item.cases.map(caseRow)),
    "",
    "\\* JSON、Schema、约束、对抗、词项覆盖与平均耗时只使用成功到达模型服务并获得响应的案例作为分母，429 等请求失败不会被误算成提示词失败。",
    "",
    "## 人工复核提示",
    "",
    "自动指标只能检查结构、显式约束和粗略词项覆盖。请人工抽查摘要是否忠实、关键点是否完整、关键词是否准确，并为每条结果记录 0～3 分内容质量。",
    "",
  ];

  return lines.join("\n");
}

export async function writeEvaluationReport(
  report: EvaluationReport,
  outputDirectory = "reports",
): Promise<{ jsonPath: string; markdownPath: string }> {
  const directory = resolve(outputDirectory);
  const jsonPath = resolve(directory, "evaluation.json");
  const markdownPath = resolve(directory, "evaluation.md");

  await mkdir(dirname(jsonPath), { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdownReport(report), "utf8"),
  ]);

  return { jsonPath, markdownPath };
}
