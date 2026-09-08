import { describe, expect, it } from "vitest";

import {
  buildAnalysisMessages,
  buildAnalysisRepairMessages,
  isPromptVersion,
  PROMPT_VERSIONS,
} from "../src/prompts.js";

const article = "这是一篇长度足够的测试文章，用于检查不同提示词版本构造出的消息结构是否符合预期，并确认真实文章放在最后一个用户消息中。";

describe("buildAnalysisMessages", () => {
  it("zero-shot 只包含任务指令和真实文章", () => {
    const messages = buildAnalysisMessages(article, "v1-zero-shot");

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(messages[1]?.content).toContain(article);
  });

  it("few-shot 先提供示例，再提供真实任务", () => {
    const messages = buildAnalysisMessages(article, "v2-few-shot");

    expect(messages).toHaveLength(4);
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(() => JSON.parse(messages[2]!.content)).not.toThrow();
    expect(messages[3]?.content).toContain(article);
  });
});

describe("buildAnalysisRepairMessages", () => {
  it("保留原任务并追加错误输出和校验信息", () => {
    const original = buildAnalysisMessages(article, "v1-zero-shot");
    const messages = buildAnalysisRepairMessages(
      original,
      '{"summary":"缺少字段"}',
      "keyPoints: expected array",
    );

    expect(messages).toHaveLength(original.length + 2);
    expect(messages.at(-2)).toEqual({
      role: "assistant",
      content: '{"summary":"缺少字段"}',
    });
    expect(messages.at(-1)?.content).toContain("keyPoints: expected array");
    expect(messages.at(-1)?.content).toContain("不要添加文章中不存在的事实");
  });
});

describe("prompt versions", () => {
  it("公开两个稳定版本并校验命令行输入", () => {
    expect(PROMPT_VERSIONS).toEqual(["v1-zero-shot", "v2-few-shot"]);
    expect(isPromptVersion("v2-few-shot")).toBe(true);
    expect(isPromptVersion("unknown")).toBe(false);
  });
});
