import { describe, expect, it } from "vitest";

import type { ChatMessage } from "../src/chat.js";
import type { ModelConfig } from "../src/env.js";
import {
  callModel,
  ModelApiError,
  parseChatCompletion,
} from "../src/model.js";

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

describe("callModel", () => {
  it("将完整消息历史发送给模型接口", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "你是学习助手" },
      { role: "user", content: "我叫小明" },
      { role: "assistant", content: "你好，小明" },
      { role: "user", content: "我叫什么？" },
    ];
    const config: ModelConfig = {
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
      model: "test-model",
      timeoutMs: 5_000,
      maxOutputTokens: 600,
      temperature: 0.2,
      maxHistoryTurns: 10,
      logPath: "logs/test.jsonl",
    };
    let requestBody: unknown;
    const fetchMock = (async (
      _input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          model: "test-model",
          choices: [
            {
              message: { role: "assistant", content: "你叫小明。" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    await callModel(messages, config, fetchMock);

    expect(requestBody).toMatchObject({
      model: "test-model",
      messages,
      max_completion_tokens: 600,
      temperature: 0.2,
    });
  });
});
