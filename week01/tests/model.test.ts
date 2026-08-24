import { describe, expect, it } from "vitest";

import { ModelApiError, parseChatCompletion } from "../src/model.js";

describe("parseChatCompletion", () => {
  it("解析回答和 token 用量", () => {
    const result = parseChatCompletion({
      model: "test-model",
      choices: [
        {
          message: {
            role: "assistant",
            content: "AI Agent 是能够调用模型和工具完成任务的程序。",
          },
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 12,
        total_tokens: 32,
      },
    });

    expect(result.answer).toContain("AI Agent");
    expect(result.usage).toEqual({
      inputTokens: 20,
      outputTokens: 12,
      totalTokens: 32,
    });
  });

  it("拒绝缺少回答内容的响应", () => {
    expect(() =>
      parseChatCompletion({
        model: "test-model",
        choices: [{ message: { role: "assistant" } }],
      }),
    ).toThrow(ModelApiError);
  });
});
