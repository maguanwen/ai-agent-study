import { describe, expect, it, vi } from "vitest";

import type { ModelConfig } from "../src/env.js";
import { evaluationCases } from "../src/evaluation-cases.js";
import {
  evaluateCase,
  runEvaluationSuite,
  summarizeEvaluation,
  type EvaluationCaseResult,
} from "../src/evaluation.js";
import { ModelApiError } from "../src/model.js";
import { articleInputSchema } from "../src/schema.js";

const config: ModelConfig = {
  apiKey: "secret",
  baseUrl: "https://example.com/v1",
  model: "test-model",
  timeoutMs: 1000,
  maxOutputTokens: 500,
  temperature: 0.2,
};

const validModelResult = {
  text: JSON.stringify({
    summary: "文章介绍了主题和改进措施。",
    keyPoints: ["关键点一", "关键点二"],
    keywords: ["主题", "改进"],
  }),
  model: "test-model",
  usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
};

describe("evaluation cases", () => {
  it("包含 10 条合法文章并覆盖三类场景", () => {
    expect(evaluationCases).toHaveLength(10);
    expect(new Set(evaluationCases.map((item) => item.category))).toEqual(
      new Set(["normal", "boundary", "adversarial"]),
    );
    for (const testCase of evaluationCases) {
      expect(() => articleInputSchema.parse(testCase.article)).not.toThrow();
    }
  });
});

describe("evaluateCase", () => {
  it("记录成功结果、token 和约束指标", async () => {
    const modelCaller = vi.fn().mockResolvedValue(validModelResult);
    const result = await evaluateCase(
      evaluationCases[0]!,
      "v1-zero-shot",
      config,
      modelCaller,
    );

    expect(result.success).toBe(true);
    expect(result.requestSucceeded).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.metrics.jsonParseSuccess).toBe(true);
    expect(result.metrics.schemaSuccess).toBe(true);
    expect(result.usage?.totalTokens).toBe(30);
  });

  it("区分非法 JSON 和 Schema 错误", async () => {
    const invalidJson = vi.fn().mockResolvedValue({
      ...validModelResult,
      text: "不是 JSON",
    });
    const invalidSchema = vi.fn().mockResolvedValue({
      ...validModelResult,
      text: '{"summary":"缺少数组字段"}',
    });

    const first = await evaluateCase(
      evaluationCases[0]!,
      "v1-zero-shot",
      config,
      invalidJson,
    );
    const second = await evaluateCase(
      evaluationCases[0]!,
      "v1-zero-shot",
      config,
      invalidSchema,
    );

    expect(first.metrics.jsonParseSuccess).toBe(false);
    expect(first.errorKind).toBe("invalid-json");
    expect(first.requestSucceeded).toBe(true);
    expect(second.metrics.jsonParseSuccess).toBe(true);
    expect(second.metrics.schemaSuccess).toBe(false);
    expect(second.errorKind).toBe("schema-mismatch");
  });

  it("把 429 记录为请求失败而不是 JSON 失败", async () => {
    const modelCaller = vi
      .fn()
      .mockRejectedValue(
        new ModelApiError("rate-limit", "模型请求受到限流", 429, 6000, 3),
      );

    const result = await evaluateCase(
      evaluationCases[0]!,
      "v1-zero-shot",
      config,
      modelCaller,
    );

    expect(result).toMatchObject({
      requestSucceeded: false,
      success: false,
      errorKind: "rate-limit",
      attempts: 3,
    });
  });
});

describe("evaluation summary", () => {
  it("汇总成功率、耗时和 token", () => {
    const result: EvaluationCaseResult = {
      caseId: "case-1",
      title: "测试",
      category: "normal",
      promptVersion: "v1-zero-shot",
      requestSucceeded: true,
      success: true,
      attempts: 1,
      elapsedMs: 100,
      metrics: {
        jsonParseSuccess: true,
        schemaSuccess: true,
        summaryLengthValid: true,
        keyPointCountValid: true,
        keywordCountValid: true,
        forbiddenTextFound: false,
        requiredTermCoverage: 0.5,
      },
      analysis: validModelResult.text
        ? JSON.parse(validModelResult.text)
        : undefined,
      model: "test-model",
      usage: validModelResult.usage,
      errorKind: undefined,
      error: undefined,
      manualReview: { score: null, notes: "" },
    };

    const rateLimitFailure: EvaluationCaseResult = {
      ...result,
      caseId: "case-2",
      requestSucceeded: false,
      success: false,
      attempts: 3,
      metrics: {
        jsonParseSuccess: false,
        schemaSuccess: false,
        summaryLengthValid: false,
        keyPointCountValid: false,
        keywordCountValid: false,
        forbiddenTextFound: false,
        requiredTermCoverage: 0,
      },
      analysis: undefined,
      model: undefined,
      usage: undefined,
      errorKind: "rate-limit",
      error: "模型请求受到限流",
    };

    expect(summarizeEvaluation("v1-zero-shot", [result, rateLimitFailure])).toEqual(
      expect.objectContaining({
        successfulCases: 1,
        requestSucceededCases: 1,
        requestSuccessRate: 0.5,
        requestFailureCases: 1,
        rateLimitFailureCases: 1,
        jsonParseRate: 1,
        schemaPassRate: 1,
        averageRequiredTermCoverage: 0.5,
        totalTokens: 30,
      }),
    );
  });

  it("顺序执行两个版本的完整测试集", async () => {
    const modelCaller = vi.fn().mockResolvedValue(validModelResult);
    const onCaseCompleted = vi.fn();
    const sleep = vi.fn().mockResolvedValue(undefined);
    const report = await runEvaluationSuite(
      evaluationCases,
      ["v1-zero-shot", "v2-few-shot"],
      config,
      modelCaller,
      onCaseCompleted,
      { requestIntervalMs: 6500, sleep },
    );

    expect(report.evaluations).toHaveLength(2);
    expect(modelCaller).toHaveBeenCalledTimes(20);
    expect(onCaseCompleted).toHaveBeenCalledTimes(20);
    expect(sleep).toHaveBeenCalledTimes(19);
    expect(sleep).toHaveBeenCalledWith(6500);
  });
});
