import { z } from "zod";

import type { ModelConfig } from "./env.js";
import {
  callModel,
  type ModelMessage,
  type ModelTextResult,
  type TokenUsage,
} from "./model.js";
import { buildAnalysisMessages, PROMPT_VERSION } from "./prompts.js";
import {
  articleAnalysisSchema,
  articleInputSchema,
  type ArticleAnalysis,
} from "./schema.js";

export interface AnalysisResult {
  analysis: ArticleAnalysis;
  model: string;
  promptVersion: typeof PROMPT_VERSION;
  usage: TokenUsage | undefined;
}

type ModelCaller = (
  messages: readonly ModelMessage[],
  config: ModelConfig,
) => Promise<ModelTextResult>;

export class AnalysisOutputError extends Error {
  override readonly name = "AnalysisOutputError";
}

export function parseArticleAnalysis(text: string): ArticleAnalysis {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error: unknown) {
    throw new AnalysisOutputError("模型输出不是合法 JSON", { cause: error });
  }

  const result = articleAnalysisSchema.safeParse(data);
  if (!result.success) {
    const details = z.prettifyError(result.error);
    throw new AnalysisOutputError(`模型输出不符合文章分析 Schema：\n${details}`, {
      cause: result.error,
    });
  }

  return result.data;
}

export async function analyzeArticle(
  article: string,
  config: ModelConfig,
  modelCaller: ModelCaller = callModel,
): Promise<AnalysisResult> {
  const validArticle = articleInputSchema.parse(article);
  const modelResult = await modelCaller(
    buildAnalysisMessages(validArticle),
    config,
  );

  return {
    analysis: parseArticleAnalysis(modelResult.text),
    model: modelResult.model,
    promptVersion: PROMPT_VERSION,
    usage: modelResult.usage,
  };
}
