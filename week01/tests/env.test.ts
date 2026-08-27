import { describe, expect, it } from "vitest";

import {
  EnvironmentConfigError,
  loadModelConfig,
  loadServerConfig,
} from "../src/env.js";

describe("loadModelConfig", () => {
  it("读取并转换合法配置", () => {
    const config = loadModelConfig({
      MODEL_API_KEY: "test-key",
      MODEL_BASE_URL: "https://example.com/v1/",
      MODEL_NAME: "test-model",
      MODEL_TIMEOUT_MS: "5000",
      MODEL_MAX_OUTPUT_TOKENS: "600",
      MODEL_TEMPERATURE: "0.2",
      CHAT_MAX_TURNS: "8",
      CHAT_LOG_PATH: "logs/test.jsonl",
    });

    expect(config).toEqual({
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
      model: "test-model",
      timeoutMs: 5000,
      maxOutputTokens: 600,
      temperature: 0.2,
      maxHistoryTurns: 8,
      logPath: "logs/test.jsonl",
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

  it("拒绝非正数的最大输出 token", () => {
    expect(() =>
      loadModelConfig({
        MODEL_API_KEY: "test-key",
        MODEL_BASE_URL: "https://example.com/v1",
        MODEL_NAME: "test-model",
        MODEL_MAX_OUTPUT_TOKENS: "0",
      }),
    ).toThrow(EnvironmentConfigError);
  });
});

describe("loadServerConfig", () => {
  it("默认只监听本机的 3000 端口", () => {
    expect(loadServerConfig({})).toEqual({
      host: "127.0.0.1",
      port: 3000,
    });
  });

  it("拒绝不合法端口", () => {
    expect(() => loadServerConfig({ SERVER_PORT: "70000" })).toThrow(
      EnvironmentConfigError,
    );
  });
});
