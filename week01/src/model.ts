import { z } from "zod";

import type { ChatMessage } from "./chat.js";
import type { ModelConfig } from "./env.js";
import { readSseData } from "./sse.js";

const tokenUsageSchema = z.object({
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
  usage: tokenUsageSchema.optional(),
});

const chatCompletionChunkSchema = z.object({
  model: z.string().min(1),
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().nullable().optional(),
      }),
    }),
  ),
  usage: tokenUsageSchema.nullable().optional(),
});

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelResult {
  answer: string;
  model: string;
  usage: TokenUsage | undefined;
}

export interface StreamChunk {
  model: string;
  textDelta: string | undefined;
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

export function parseChatCompletion(data: unknown): ModelResult {
  const result = chatCompletionSchema.safeParse(data);

  if (!result.success) {
    throw new ModelApiError("模型响应格式不符合预期", undefined, {
      cause: result.error,
    });
  }

  const usage = result.data.usage;

  return {
    answer: result.data.choices[0]!.message.content,
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

export function parseChatCompletionChunk(data: unknown): StreamChunk {
  const result = chatCompletionChunkSchema.safeParse(data);

  if (!result.success) {
    throw new ModelApiError("模型流响应格式不符合预期", undefined, {
      cause: result.error,
    });
  }

  const usage = result.data.usage;

  return {
    model: result.data.model,
    textDelta: result.data.choices[0]?.delta.content ?? undefined,
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
  messages: readonly ChatMessage[],
  config: ModelConfig,
  fetchImplementation: typeof fetch = fetch,
): Promise<ModelResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      max_completion_tokens: config.maxOutputTokens,
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
      const suffix = details ? `：${details}` : "";

      throw new ModelApiError(
        `模型请求失败（HTTP ${response.status}）${suffix}`,
        response.status,
      );
    }

    return parseChatCompletion(await response.json());
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

export async function streamModel(
  messages: readonly ChatMessage[],
  config: ModelConfig,
  onTextDelta: (delta: string) => void,
  fetchImplementation: typeof fetch = fetch,
): Promise<ModelResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      max_completion_tokens: config.maxOutputTokens,
      stream: true,
      stream_options: { include_usage: true },
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
      const suffix = details ? `：${details}` : "";
      throw new ModelApiError(
        `模型请求失败（HTTP ${response.status}）${suffix}`,
        response.status,
      );
    }

    if (!response.body) {
      throw new ModelApiError("模型服务没有返回可读取的数据流");
    }

    let answer = "";
    let model = config.model;
    let usage: TokenUsage | undefined;

    for await (const eventData of readSseData(response.body)) {
      if (eventData === "[DONE]") {
        break;
      }

      let event: unknown;
      try {
        event = JSON.parse(eventData);
      } catch (error: unknown) {
        throw new ModelApiError("模型流包含无法解析的 JSON", undefined, {
          cause: error,
        });
      }

      const chunk = parseChatCompletionChunk(event);
      model = chunk.model;

      if (chunk.textDelta) {
        answer += chunk.textDelta;
        onTextDelta(chunk.textDelta);
      }

      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    if (!answer.trim()) {
      throw new ModelApiError("模型流结束但没有返回文本内容");
    }

    return { answer, model, usage };
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
