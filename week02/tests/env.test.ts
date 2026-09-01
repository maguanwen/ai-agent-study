import { describe, expect, it } from "vitest";

import { EnvironmentConfigError, loadModelConfig } from "../src/env.js";

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
