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
});

const evaluationConfigSchema = z.object({
  EVAL_REQUEST_INTERVAL_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(6500),
  EVAL_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  EVAL_RETRY_BASE_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(1000),
  EVAL_RETRY_MAX_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10_000),
});

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: number | undefined;
}

export interface EvaluationConfig {
  requestIntervalMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
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
  };
}

export function loadEvaluationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): EvaluationConfig {
  const result = evaluationConfigSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "环境变量"}：${issue.message}`)
      .join("；");
    throw new EnvironmentConfigError(`评测配置错误：${details}`);
  }

  if (
    result.data.EVAL_RETRY_BASE_DELAY_MS >
    result.data.EVAL_RETRY_MAX_DELAY_MS
  ) {
    throw new EnvironmentConfigError(
      "评测配置错误：EVAL_RETRY_BASE_DELAY_MS 不能大于 EVAL_RETRY_MAX_DELAY_MS",
    );
  }

  return {
    requestIntervalMs: result.data.EVAL_REQUEST_INTERVAL_MS,
    maxRetries: result.data.EVAL_MAX_RETRIES,
    retryBaseDelayMs: result.data.EVAL_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: result.data.EVAL_RETRY_MAX_DELAY_MS,
  };
}
