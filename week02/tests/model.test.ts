import { describe, expect, it, vi } from "vitest";

import type { ModelConfig } from "../src/env.js";
import { callModel, parseChatCompletion } from "../src/model.js";

const config: ModelConfig = {
  apiKey: "secret",
  baseUrl: "https://example.com/v1",
  model: "test-model",
  timeoutMs: 1000,
  maxOutputTokens: 500,
  temperature: 0.2,
};

describe("parseChatCompletion", () => {
  it("转换模型文本和 token 用量", () => {
    expect(
      parseChatCompletion({
        model: "test-model",
        choices: [
          {
            message: {
              role: "assistant",
              content: '{"summary":"摘要","keyPoints":["要点"],"keywords":["关键词"]}',
            },
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      }),
    ).toEqual({
      text: '{"summary":"摘要","keyPoints":["要点"],"keywords":["关键词"]}',
      model: "test-model",
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    });
  });
});

describe("callModel", () => {
  it("启用 JSON mode 并且不修改原始消息", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "test-model",
          choices: [
            {
              message: {
                role: "assistant",
                content: '{"summary":"摘要","keyPoints":["要点"],"keywords":["关键词"]}',
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const messages = [
      { role: "system" as const, content: "只返回 JSON" },
      { role: "user" as const, content: "分析文章" },
    ];

    await callModel(messages, config, fetchMock);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toEqual(messages);
    expect(init?.headers).toEqual({
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    });
  });
});
