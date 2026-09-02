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
        EVAL_REQUEST_INTERVAL_MS: "6500",
        EVAL_MAX_RETRIES: "2",
        EVAL_RETRY_BASE_DELAY_MS: "1000",
        EVAL_RETRY_MAX_DELAY_MS: "10000",
      }),
    ).toEqual({
      requestIntervalMs: 6500,
      maxRetries: 2,
      retryBaseDelayMs: 1000,
      retryMaxDelayMs: 10000,
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
