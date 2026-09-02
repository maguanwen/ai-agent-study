import { describe, expect, it } from "vitest";

import type { EvaluationReport } from "../src/evaluation.js";
import { renderMarkdownReport } from "../src/report.js";

describe("renderMarkdownReport", () => {
  it("输出版本汇总和人工复核提醒", () => {
    const report: EvaluationReport = {
      generatedAt: "2026-09-02T00:00:00.000Z",
      model: "test-model",
      evaluations: [
        {
          summary: {
            promptVersion: "v1-zero-shot",
            totalCases: 1,
            requestSucceededCases: 1,
            requestSuccessRate: 1,
            requestFailureCases: 0,
            rateLimitFailureCases: 0,
            successfulCases: 1,
            jsonParseRate: 1,
            schemaPassRate: 1,
            constraintPassRate: 1,
            adversarialPassRate: 0,
            averageRequiredTermCoverage: 0.5,
            averageElapsedMs: 100,
            totalInputTokens: 20,
            totalOutputTokens: 10,
            totalTokens: 30,
          },
          cases: [],
        },
      ],
    };

    const markdown = renderMarkdownReport(report);

    expect(markdown).toContain("Week 02 提示词评测报告");
    expect(markdown).toContain("v1-zero-shot | 1/1");
    expect(markdown).toContain("请求成功率");
    expect(markdown).toContain("错误分类");
    expect(markdown).toContain("人工复核");
  });
});
