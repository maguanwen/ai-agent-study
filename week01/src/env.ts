import { z } from "zod";

const modelConfigSchema = z.object({
  MODEL_API_KEY: z.string().trim().min(1, "不能为空"),
  MODEL_BASE_URL: z.string().trim().url("必须是合法 URL"),
  MODEL_NAME: z.string().trim().min(1, "不能为空"),
  MODEL_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(30_000),
  MODEL_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(800),
  MODEL_TEMPERATURE: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().min(0).max(2).optional(),
  ),
  CHAT_MAX_TURNS: z.coerce.number().int().positive().max(100).default(10),
  CHAT_LOG_PATH: z.string().trim().min(1).default("logs/chat.jsonl"),
});

const serverConfigSchema = z.object({
  SERVER_HOST: z.string().trim().min(1).default("127.0.0.1"),
  SERVER_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: number | undefined;
  maxHistoryTurns: number;
  logPath: string;
}

export interface ServerConfig {
  host: string;
  port: number;
}

export class EnvironmentConfigError extends Error {
  override readonly name = "EnvironmentConfigError";
}

export function loadModelConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ModelConfig {
  const result = modelConfigSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "环境变量"}：${issue.message}`)
      .join("；");

    throw new EnvironmentConfigError(`模型配置错误：${details}`);
  }

  return {
    apiKey: result.data.MODEL_API_KEY,
    baseUrl: result.data.MODEL_BASE_URL.replace(/\/+$/, ""),
    model: result.data.MODEL_NAME,
    timeoutMs: result.data.MODEL_TIMEOUT_MS,
    maxOutputTokens: result.data.MODEL_MAX_OUTPUT_TOKENS,
    temperature: result.data.MODEL_TEMPERATURE,
    maxHistoryTurns: result.data.CHAT_MAX_TURNS,
    logPath: result.data.CHAT_LOG_PATH,
  };
}

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const result = serverConfigSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "环境变量"}：${issue.message}`)
      .join("；");

    throw new EnvironmentConfigError(`HTTP 服务配置错误：${details}`);
  }

  return {
    host: result.data.SERVER_HOST,
    port: result.data.SERVER_PORT,
  };
}
