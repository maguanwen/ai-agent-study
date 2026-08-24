import { describe, expect, it } from "vitest";

import { EnvironmentConfigError, loadModelConfig } from "../src/env.js";

describe("loadModelConfig", () => {
  it("读取并转换合法配置", () => {
    const config = loadModelConfig({
      MODEL_API_KEY: "test-key",
      MODEL_BASE_URL: "https://example.com/v1/",
      MODEL_NAME: "test-model",
      MODEL_TIMEOUT_MS: "5000",
      MODEL_TEMPERATURE: "0.2",
    });

    expect(config).toEqual({
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
      model: "test-model",
      timeoutMs: 5000,
      temperature: 0.2,
    });
  });

  it("缺少密钥时提供明确错误", () => {
    expect(() =>
      loadModelConfig({
        MODEL_BASE_URL: "https://example.com/v1",
        MODEL_NAME: "test-model",
      }),
    ).toThrow(EnvironmentConfigError);
  });
});
