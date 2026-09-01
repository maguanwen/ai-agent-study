import { describe, expect, it } from "vitest";

import { articleAnalysisSchema, articleInputSchema } from "../src/schema.js";

describe("articleAnalysisSchema", () => {
  it("接受合法分析结果", () => {
    expect(
      articleAnalysisSchema.parse({
        summary: "文章介绍了 AI Agent 的基本组成。",
        keyPoints: ["理解目标", "调用工具"],
        keywords: ["AI Agent", "工具调用"],
      }),
    ).toEqual({
      summary: "文章介绍了 AI Agent 的基本组成。",
      keyPoints: ["理解目标", "调用工具"],
      keywords: ["AI Agent", "工具调用"],
    });
  });

  it("拒绝缺失字段和额外字段", () => {
    expect(() =>
      articleAnalysisSchema.parse({
        summary: "摘要",
        keyPoints: ["关键点"],
        extra: true,
      }),
    ).toThrow();
  });
});

describe("articleInputSchema", () => {
  it("拒绝过短文章", () => {
    expect(() => articleInputSchema.parse("太短了")).toThrow();
  });
});
