import { z } from "zod";

import type { ModelConfig } from "./env.js";

const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.literal("assistant"),
          content: z.string().trim().min(1),
        }),
      }),
    )
    .min(1),
  usage: usageSchema.optional(),
});

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelTextResult {
  text: string;
  model: string;
  usage: TokenUsage | undefined;
  attempts?: number;
}

export type ModelApiErrorKind =
  | "rate-limit"
  | "http-error"
  | "timeout"
  | "network-error"
  | "invalid-response";

export class ModelApiError extends Error {
  override readonly name = "ModelApiError";

  constructor(
    readonly kind: ModelApiErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
    readonly attempts = 1,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export type ModelCaller = (
  messages: readonly ModelMessage[],
  config: ModelConfig,
) => Promise<ModelTextResult>;

export type Sleep = (milliseconds: number) => Promise<void>;

export interface RateLimitRetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: Sleep;
  random?: () => number;
  onRetry?: (event: {
    attempt: number;
    maxAttempts: number;
    delayMs: number;
    error: ModelApiError;
  }) => void;
}

export const sleep: Sleep = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? undefined : Math.max(0, retryAt - now);
}

export function parseChatCompletion(data: unknown): ModelTextResult {
  const result = chatCompletionSchema.safeParse(data);
  if (!result.success) {
    throw new ModelApiError(
      "invalid-response",
      "模型响应格式不符合预期",
      undefined,
      undefined,
      1,
      { cause: result.error },
    );
  }

  const usage = result.data.usage;
  return {
    text: result.data.choices[0]!.message.content,
    model: result.data.model,
    usage: usage
      ? {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        }
      : undefined,
  };
}

export async function callModel(
  messages: readonly ModelMessage[],
  config: ModelConfig,
  fetchImplementation: typeof fetch = fetch,
): Promise<ModelTextResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages,
      max_completion_tokens: config.maxOutputTokens,
      response_format: { type: "json_object" },
    };

    if (config.temperature !== undefined) {
      requestBody.temperature = config.temperature;
    }

    const response = await fetchImplementation(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      if (response.status === 429) {
        throw new ModelApiError(
          "rate-limit",
          "模型请求受到限流（HTTP 429）",
          response.status,
          retryAfterMs,
        );
      }

      const details = (await response.text()).trim().slice(0, 300);
      throw new ModelApiError(
        "http-error",
        `模型请求失败（HTTP ${response.status}）${details ? `：${details}` : ""}`,
        response.status,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error: unknown) {
      throw new ModelApiError(
        "invalid-response",
        "模型服务返回了无法解析的 JSON",
        undefined,
        undefined,
        1,
        { cause: error },
      );
    }

    return parseChatCompletion(data);
  } catch (error: unknown) {
    if (error instanceof ModelApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelApiError(
        "timeout",
        `模型请求超时（${config.timeoutMs} ms）`,
        undefined,
        undefined,
        1,
        { cause: error },
      );
    }

    throw new ModelApiError(
      "network-error",
      "无法连接模型服务",
      undefined,
      undefined,
      1,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function withRateLimitRetry(
  modelCaller: ModelCaller,
  options: RateLimitRetryOptions,
): ModelCaller {
  const sleepImplementation = options.sleep ?? sleep;
  const random = options.random ?? Math.random;

  return async (messages, config) => {
    const maxAttempts = options.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await modelCaller(messages, config);
        return { ...result, attempts: attempt };
      } catch (error: unknown) {
        const shouldRetry =
          error instanceof ModelApiError &&
          error.kind === "rate-limit" &&
          attempt < maxAttempts;

        if (!shouldRetry) {
          if (error instanceof ModelApiError) {
            throw new ModelApiError(
              error.kind,
              error.message,
              error.status,
              error.retryAfterMs,
              attempt,
              { cause: error },
            );
          }
          throw error;
        }

        const exponentialDelay = Math.min(
          options.maxDelayMs,
          options.baseDelayMs * 2 ** (attempt - 1),
        );
        const jitter = Math.floor(random() * options.baseDelayMs);
        const delayMs =
          error.retryAfterMs ??
          Math.min(options.maxDelayMs, exponentialDelay + jitter);

        options.onRetry?.({
          attempt,
          maxAttempts,
          delayMs,
          error,
        });
        await sleepImplementation(delayMs);
      }
    }

    throw new Error("模型重试流程出现未知状态");
  };
}
