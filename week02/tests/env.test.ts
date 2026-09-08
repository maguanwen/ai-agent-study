import { describe, expect, it } from "vitest";

import {
  EnvironmentConfigError,
  loadEvaluationConfig,
  loadModelConfig,
} from "../src/env.js";

describe("loadModelConfig", () => {
  it("读取合法配置", () => {
    expect(
      loadModelConfig({
        MODEL_API_KEY: "test-key",
        MODEL_BASE_URL: "https://example.com/v1/",
        MODEL_NAME: "test-model",
        MODEL_TIMEOUT_MS: "5000",
        MODEL_MAX_OUTPUT_TOKENS: "600",
        MODEL_TEMPERATURE: "0.2",
      }),
    ).toEqual({
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
      model: "test-model",
      timeoutMs: 5000,
      maxOutputTokens: 600,
      temperature: 0.2,
    });
  });

  it("拒绝缺失 API Key", () => {
    expect(() =>
      loadModelConfig({
        MODEL_BASE_URL: "https://example.com/v1",
        MODEL_NAME: "test-model",
      }),
    ).toThrow(EnvironmentConfigError);
  });
});

describe("loadEvaluationConfig", () => {
  it("读取节流和重试配置", () => {
    expect(
      loadEvaluationConfig({
        EVAL_REQUEST_INTERVAL_MS: "7000",
        EVAL_INITIAL_DELAY_MS: "7000",
        EVAL_MAX_RETRIES: "2",
        EVAL_RETRY_BASE_DELAY_MS: "7000",
        EVAL_RETRY_MAX_DELAY_MS: "30000",
        EVAL_RATE_LIMIT_COOLDOWN_MS: "60000",
        EVAL_MAX_RATE_LIMIT_COOLDOWNS: "1",
      }),
    ).toEqual({
      requestIntervalMs: 7000,
      initialDelayMs: 7000,
      maxRetries: 2,
      retryBaseDelayMs: 7000,
      retryMaxDelayMs: 30000,
      rateLimitCooldownMs: 60000,
      maxRateLimitCooldowns: 1,
    });
  });

  it("拒绝基础重试等待大于最大等待", () => {
    expect(() =>
      loadEvaluationConfig({
        EVAL_RETRY_BASE_DELAY_MS: "2000",
        EVAL_RETRY_MAX_DELAY_MS: "1000",
      }),
    ).toThrow(EnvironmentConfigError);
  });
});
