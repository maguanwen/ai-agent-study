import { z } from "zod";

import type { ModelConfig } from "./env.js";
import {
  callModel,
  ModelApiError,
  type ModelCaller,
  type ModelTextResult,
  type TokenUsage,
} from "./model.js";
import {
  buildAnalysisMessages,
  buildAnalysisRepairMessages,
  DEFAULT_PROMPT_VERSION,
  type PromptVersion,
} from "./prompts.js";
import {
  articleAnalysisSchema,
  articleInputSchema,
  type ArticleAnalysis,
} from "./schema.js";

export interface AnalysisResult {
  analysis: ArticleAnalysis;
  model: string;
  promptVersion: PromptVersion;
  usage: TokenUsage | undefined;
  attempts: number;
  repairAttempts: number;
}

export type { ModelCaller } from "./model.js";

export type AnalysisOutputErrorKind = "invalid-json" | "schema-mismatch";

export class AnalysisOutputError extends Error {
  override readonly name = "AnalysisOutputError";
  readonly repairAttempts: number;
  readonly attempts: number;
  readonly usage: TokenUsage | undefined;

  constructor(
    readonly kind: AnalysisOutputErrorKind,
    message: string,
    options: ErrorOptions & {
      repairAttempts?: number;
      attempts?: number;
      usage?: TokenUsage;
    } = {},
  ) {
    super(message, options);
    this.repairAttempts = options.repairAttempts ?? 0;
    this.attempts = options.attempts ?? 0;
    this.usage = options.usage;
  }
}

export class AnalysisRequestError extends Error {
  override readonly name = "AnalysisRequestError";

  constructor(
    readonly apiError: ModelApiError,
    readonly attempts: number,
    readonly repairAttempts: number,
    readonly usage: TokenUsage | undefined,
  ) {
    super(apiError.message, { cause: apiError });
  }
}

function addUsage(
  current: TokenUsage | undefined,
  next: TokenUsage | undefined,
): TokenUsage | undefined {
  if (!current && !next) {
    return undefined;
  }

  return {
    inputTokens: (current?.inputTokens ?? 0) + (next?.inputTokens ?? 0),
    outputTokens: (current?.outputTokens ?? 0) + (next?.outputTokens ?? 0),
    totalTokens: (current?.totalTokens ?? 0) + (next?.totalTokens ?? 0),
  };
}

export function parseArticleAnalysis(text: string): ArticleAnalysis {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error: unknown) {
    throw new AnalysisOutputError("invalid-json", "模型输出不是合法 JSON", {
      cause: error,
    });
  }

  const result = articleAnalysisSchema.safeParse(data);
  if (!result.success) {
    const details = z.prettifyError(result.error);
    throw new AnalysisOutputError(
      "schema-mismatch",
      `模型输出不符合文章分析 Schema：\n${details}`,
      { cause: result.error },
    );
  }

  return result.data;
}

export async function analyzeArticle(
  article: string,
  config: ModelConfig,
  options: {
    promptVersion?: PromptVersion;
    modelCaller?: ModelCaller;
    maxRepairAttempts?: number;
  } = {},
): Promise<AnalysisResult> {
  const validArticle = articleInputSchema.parse(article);
  const promptVersion = options.promptVersion ?? DEFAULT_PROMPT_VERSION;
  const modelCaller = options.modelCaller ?? callModel;
  const maxRepairAttempts = options.maxRepairAttempts ?? 1;

  if (!Number.isInteger(maxRepairAttempts) || maxRepairAttempts < 0) {
    throw new RangeError("maxRepairAttempts 必须是非负整数");
  }

  let messages = buildAnalysisMessages(validArticle, promptVersion);
  let attempts = 0;
  let repairAttempts = 0;
  let usage: TokenUsage | undefined;

  while (true) {
    let modelResult: ModelTextResult;
    try {
      modelResult = await modelCaller(messages, config);
    } catch (error: unknown) {
      if (error instanceof ModelApiError) {
        throw new AnalysisRequestError(
          error,
          attempts + error.attempts,
          repairAttempts,
          usage,
        );
      }
      throw error;
    }

    attempts += modelResult.attempts ?? 1;
    usage = addUsage(usage, modelResult.usage);

    try {
      return {
        analysis: parseArticleAnalysis(modelResult.text),
        model: modelResult.model,
        promptVersion,
        usage,
        attempts,
        repairAttempts,
      };
    } catch (error: unknown) {
      if (!(error instanceof AnalysisOutputError)) {
        throw error;
      }

      if (repairAttempts >= maxRepairAttempts) {
        throw new AnalysisOutputError(
          error.kind,
          `${error.message}\n输出修复已达到上限（${maxRepairAttempts} 次）`,
          {
            cause: error,
            repairAttempts,
            attempts,
            ...(usage ? { usage } : {}),
          },
        );
      }

      repairAttempts += 1;
      messages = buildAnalysisRepairMessages(
        messages,
        modelResult.text,
        error.message,
      );
    }
  }
}
