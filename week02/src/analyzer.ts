import { z } from "zod";

import type { ModelConfig } from "./env.js";
import {
  callModel,
  type ModelCaller,
  type TokenUsage,
} from "./model.js";
import {
  buildAnalysisMessages,
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
}

export type { ModelCaller } from "./model.js";

export type AnalysisOutputErrorKind = "invalid-json" | "schema-mismatch";

export class AnalysisOutputError extends Error {
  override readonly name = "AnalysisOutputError";

  constructor(
    readonly kind: AnalysisOutputErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
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
  } = {},
): Promise<AnalysisResult> {
  const validArticle = articleInputSchema.parse(article);
  const promptVersion = options.promptVersion ?? DEFAULT_PROMPT_VERSION;
  const modelCaller = options.modelCaller ?? callModel;
  const modelResult = await modelCaller(
    buildAnalysisMessages(validArticle, promptVersion),
    config,
  );

  return {
    analysis: parseArticleAnalysis(modelResult.text),
    model: modelResult.model,
    promptVersion,
    usage: modelResult.usage,
    attempts: modelResult.attempts ?? 1,
  };
}
