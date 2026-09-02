import { describe, expect, it, vi } from "vitest";

import type { ModelConfig } from "../src/env.js";
import {
  ModelApiError,
  callModel,
  parseChatCompletion,
  parseRetryAfter,
  withRateLimitRetry,
} from "../src/model.js";

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

  it("把 429 分类为限流错误并读取 Retry-After", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("账户相关的上游错误详情不应写入报告", {
        status: 429,
        headers: { "Retry-After": "6" },
      }),
    );

    const promise = callModel([], config, fetchMock);

    await expect(promise).rejects.toMatchObject({
      kind: "rate-limit",
      status: 429,
      retryAfterMs: 6000,
      message: "模型请求受到限流（HTTP 429）",
    });
  });
});

describe("parseRetryAfter", () => {
  it("支持秒数与 HTTP 日期", () => {
    expect(parseRetryAfter("1.5", 0)).toBe(1500);
    expect(
      parseRetryAfter("Thu, 01 Jan 1970 00:00:05 GMT", 1000),
    ).toBe(4000);
  });
});

describe("withRateLimitRetry", () => {
  it("429 后有限重试并优先使用 Retry-After", async () => {
    const modelCaller = vi
      .fn()
      .mockRejectedValueOnce(
        new ModelApiError("rate-limit", "限流", 429, 6000),
      )
      .mockResolvedValue({
        text: "{}",
        model: "test-model",
        usage: undefined,
      });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const caller = withRateLimitRetry(modelCaller, {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
      sleep,
      random: () => 0.5,
    });

    await expect(caller([], config)).resolves.toMatchObject({ attempts: 2 });
    expect(sleep).toHaveBeenCalledWith(6000);
    expect(modelCaller).toHaveBeenCalledTimes(2);
  });

  it("重试耗尽后记录总尝试次数，非 429 不重试", async () => {
    const rateLimitedCaller = vi
      .fn()
      .mockRejectedValue(new ModelApiError("rate-limit", "限流", 429));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const caller = withRateLimitRetry(rateLimitedCaller, {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
      sleep,
      random: () => 0,
    });

    await expect(caller([], config)).rejects.toMatchObject({
      kind: "rate-limit",
      attempts: 3,
    });
    expect(rateLimitedCaller).toHaveBeenCalledTimes(3);

    const unauthorizedCaller = vi
      .fn()
      .mockRejectedValue(new ModelApiError("http-error", "未授权", 401));
    const nonRetryingCaller = withRateLimitRetry(unauthorizedCaller, {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
      sleep,
    });

    await expect(nonRetryingCaller([], config)).rejects.toMatchObject({
      kind: "http-error",
      attempts: 1,
    });
    expect(unauthorizedCaller).toHaveBeenCalledOnce();
  });
});
