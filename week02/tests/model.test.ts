import { describe, expect, it, vi } from "vitest";

import type { ModelConfig } from "../src/env.js";
import {
  ModelApiError,
  callModel,
  createRequestScheduler,
  parseChatCompletion,
  parseRetryAfter,
  parseResetDuration,
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

  it("从错误消息中读取等待时间，并区分配额耗尽", async () => {
    const rateLimitFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: "rate_limit_error",
            message: "Rate limit reached. Please try again in 6s.",
          },
        }),
        { status: 429 },
      ),
    );
    await expect(callModel([], config, rateLimitFetch)).rejects.toMatchObject({
      kind: "rate-limit",
      retryAfterMs: 6000,
    });

    const quotaFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: "insufficient_quota",
            code: "insufficient_quota",
            message: "账户详情不应进入本地报告",
          },
        }),
        { status: 429 },
      ),
    );
    await expect(callModel([], config, quotaFetch)).rejects.toMatchObject({
      kind: "quota-exhausted",
      status: 429,
      message: "模型账户额度不足（HTTP 429），等待重试无法恢复",
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

describe("parseResetDuration", () => {
  it("支持服务端常见的组合时长", () => {
    expect(parseResetDuration("1m2s")).toBe(62_000);
    expect(parseResetDuration("750ms")).toBe(750);
    expect(parseResetDuration(null)).toBeUndefined();
  });
});

describe("createRequestScheduler", () => {
  it("首次请求也等待，并为每次真实请求保留固定间隔", async () => {
    let now = 0;
    const schedulerSleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const waitForSlot = createRequestScheduler({
      intervalMs: 7000,
      initialDelayMs: 7000,
      sleep: schedulerSleep,
      now: () => now,
    });

    await waitForSlot();
    await waitForSlot();
    await waitForSlot();

    expect(schedulerSleep.mock.calls).toEqual([[7000], [7000], [7000]]);
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
    const beforeAttempt = vi.fn().mockResolvedValue(undefined);
    const caller = withRateLimitRetry(modelCaller, {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
      sleep,
      random: () => 0.5,
      beforeAttempt,
    });

    await expect(caller([], config)).resolves.toMatchObject({ attempts: 2 });
    expect(sleep).toHaveBeenCalledWith(6000);
    expect(modelCaller).toHaveBeenCalledTimes(2);
    expect(beforeAttempt).toHaveBeenCalledTimes(2);
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

  it("配额耗尽不会重试", async () => {
    const quotaCaller = vi
      .fn()
      .mockRejectedValue(
        new ModelApiError("quota-exhausted", "模型配额已耗尽", 429),
      );
    const retrySleep = vi.fn().mockResolvedValue(undefined);
    const caller = withRateLimitRetry(quotaCaller, {
      maxRetries: 2,
      baseDelayMs: 7000,
      maxDelayMs: 30_000,
      sleep: retrySleep,
    });

    await expect(caller([], config)).rejects.toMatchObject({
      kind: "quota-exhausted",
      attempts: 1,
    });
    expect(quotaCaller).toHaveBeenCalledOnce();
    expect(retrySleep).not.toHaveBeenCalled();
  });
});
