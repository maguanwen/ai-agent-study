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
}

export class ModelApiError extends Error {
  override readonly name = "ModelApiError";

  constructor(
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function parseChatCompletion(data: unknown): ModelTextResult {
  const result = chatCompletionSchema.safeParse(data);
  if (!result.success) {
    throw new ModelApiError("模型响应格式不符合预期", undefined, {
      cause: result.error,
    });
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
      const details = (await response.text()).trim().slice(0, 500);
      throw new ModelApiError(
        `模型请求失败（HTTP ${response.status}）${details ? `：${details}` : ""}`,
        response.status,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error: unknown) {
      throw new ModelApiError("模型服务返回了无法解析的 JSON", undefined, {
        cause: error,
      });
    }

    return parseChatCompletion(data);
  } catch (error: unknown) {
    if (error instanceof ModelApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelApiError(`模型请求超时（${config.timeoutMs} ms）`, undefined, {
        cause: error,
      });
    }

    throw new ModelApiError("无法连接模型服务", undefined, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
