import { z } from "zod";

const modelConfigSchema = z.object({
  MODEL_API_KEY: z.string().trim().min(1, "不能为空"),
  MODEL_BASE_URL: z.string().trim().url("必须是合法 URL"),
  MODEL_NAME: z.string().trim().min(1, "不能为空"),
  MODEL_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(30_000),
  MODEL_TEMPERATURE: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().min(0).max(2).optional(),
  ),
});

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  temperature: number | undefined;
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
    temperature: result.data.MODEL_TEMPERATURE,
  };
}
