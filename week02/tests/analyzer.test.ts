import { describe, expect, it, vi } from "vitest";

import {
  AnalysisOutputError,
  AnalysisRequestError,
  analyzeArticle,
  parseArticleAnalysis,
} from "../src/analyzer.js";
import type { ModelConfig } from "../src/env.js";
import { ModelApiError } from "../src/model.js";

const config: ModelConfig = {
  apiKey: "secret",
  baseUrl: "https://example.com/v1",
  model: "test-model",
  timeoutMs: 1000,
  maxOutputTokens: 500,
  temperature: 0.2,
};

const article =
  "这是一篇用于测试文章分析功能的示例文章。它包含足够多的字符，可以通过输入校验，并用于验证模型调用和结构化输出解析流程。";

describe("parseArticleAnalysis", () => {
  it("解析合法业务 JSON", () => {
    expect(
      parseArticleAnalysis(
        '{"summary":"测试摘要","keyPoints":["要点一"],"keywords":["测试"]}',
      ),
    ).toEqual({
      summary: "测试摘要",
      keyPoints: ["要点一"],
      keywords: ["测试"],
    });
  });

  it("区分非法 JSON 与 Schema 错误", () => {
    expect(() => parseArticleAnalysis("不是 JSON")).toThrow(
      new AnalysisOutputError("invalid-json", "模型输出不是合法 JSON"),
    );
    expect(() => parseArticleAnalysis('{"summary":"只有摘要"}')).toThrow(
      /不符合文章分析 Schema/,
    );
  });
});

describe("analyzeArticle", () => {
  it("构造提示词、调用模型并返回元数据", async () => {
    const modelCaller = vi.fn().mockResolvedValue({
      text: '{"summary":"测试摘要","keyPoints":["要点一"],"keywords":["测试"]}',
      model: "test-model",
      usage: { inputTokens: 30, outputTokens: 15, totalTokens: 45 },
    });

    const result = await analyzeArticle(article, config, { modelCaller });

    expect(modelCaller).toHaveBeenCalledOnce();
    const messages = modelCaller.mock.calls[0]?.[0];
    expect(messages?.[0]).toEqual(
      expect.objectContaining({ role: "system" }),
    );
    expect(messages?.[1]?.content).toContain(article);
    expect(result).toEqual({
      analysis: {
        summary: "测试摘要",
        keyPoints: ["要点一"],
        keywords: ["测试"],
      },
      model: "test-model",
      promptVersion: "v1-zero-shot",
      usage: { inputTokens: 30, outputTokens: 15, totalTokens: 45 },
      attempts: 1,
      repairAttempts: 0,
    });
  });

  it("允许选择 few-shot 提示词版本", async () => {
    const modelCaller = vi.fn().mockResolvedValue({
      text: '{"summary":"测试摘要","keyPoints":["要点一"],"keywords":["测试"]}',
      model: "test-model",
      usage: undefined,
    });

    const result = await analyzeArticle(article, config, {
      promptVersion: "v2-few-shot",
      modelCaller,
    });

    expect(result.promptVersion).toBe("v2-few-shot");
    expect(modelCaller.mock.calls[0]?.[0]).toHaveLength(4);
  });

  it("Schema 失败后修复一次并累计 HTTP 尝试与 token", async () => {
    const modelCaller = vi
      .fn()
      .mockResolvedValueOnce({
        text: '{"summary":"缺少数组字段"}',
        model: "test-model",
        usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
        attempts: 1,
      })
      .mockResolvedValueOnce({
        text: '{"summary":"修复摘要","keyPoints":["要点"],"keywords":["测试"]}',
        model: "test-model",
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        attempts: 2,
      });
    const result = await analyzeArticle(article, config, {
      modelCaller,
    });

    expect(modelCaller).toHaveBeenCalledTimes(2);
    expect(modelCaller.mock.calls[1]?.[0].at(-1)?.content).toContain(
      "模型输出不符合文章分析 Schema",
    );
    expect(result).toMatchObject({
      attempts: 3,
      repairAttempts: 1,
      usage: { inputTokens: 50, outputTokens: 15, totalTokens: 65 },
      analysis: { summary: "修复摘要" },
    });
  });

  it("修复达到上限后明确失败", async () => {
    const modelCaller = vi.fn().mockResolvedValue({
      text: '{"summary":"始终缺少数组字段"}',
      model: "test-model",
      usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
    });

    const promise = analyzeArticle(article, config, { modelCaller });

    await expect(promise).rejects.toMatchObject({
      name: "AnalysisOutputError",
      kind: "schema-mismatch",
      attempts: 2,
      repairAttempts: 1,
      usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
    });
    expect(modelCaller).toHaveBeenCalledTimes(2);
  });

  it("API 请求错误不会触发输出修复", async () => {
    const modelCaller = vi
      .fn()
      .mockRejectedValue(new ModelApiError("rate-limit", "限流", 429));

    const promise = analyzeArticle(article, config, { modelCaller });

    await expect(promise).rejects.toBeInstanceOf(AnalysisRequestError);
    await expect(promise).rejects.toMatchObject({
      attempts: 1,
      repairAttempts: 0,
      apiError: { kind: "rate-limit" },
    });
    expect(modelCaller).toHaveBeenCalledOnce();
  });

  it("允许关闭输出修复", async () => {
    const modelCaller = vi.fn().mockResolvedValue({
      text: "不是 JSON",
      model: "test-model",
      usage: undefined,
    });

    await expect(
      analyzeArticle(article, config, { modelCaller, maxRepairAttempts: 0 }),
    ).rejects.toMatchObject({ repairAttempts: 0, attempts: 1 });
    expect(modelCaller).toHaveBeenCalledOnce();
  });
});
