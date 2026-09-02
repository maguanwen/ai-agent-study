import { describe, expect, it, vi } from "vitest";

import {
  AnalysisOutputError,
  analyzeArticle,
  parseArticleAnalysis,
} from "../src/analyzer.js";
import type { ModelConfig } from "../src/env.js";

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
});
