import type { ArticleAnalysis } from "./schema.js";
import type { ModelConfig } from "./env.js";
import {
  AnalysisOutputError,
  analyzeArticle,
  type ModelCaller,
} from "./analyzer.js";
import type {
  EvaluationCase,
  EvaluationCategory,
} from "./evaluation-cases.js";
import {
  ModelApiError,
  sleep,
  type Sleep,
  type TokenUsage,
} from "./model.js";
import type { PromptVersion } from "./prompts.js";

export interface EvaluationMetrics {
  jsonParseSuccess: boolean;
  schemaSuccess: boolean;
  summaryLengthValid: boolean;
  keyPointCountValid: boolean;
  keywordCountValid: boolean;
  forbiddenTextFound: boolean;
  requiredTermCoverage: number;
}

export interface EvaluationCaseResult {
  caseId: string;
  title: string;
  category: EvaluationCategory;
  promptVersion: PromptVersion;
  requestSucceeded: boolean;
  success: boolean;
  attempts: number;
  elapsedMs: number;
  metrics: EvaluationMetrics;
  analysis: ArticleAnalysis | undefined;
  model: string | undefined;
  usage: TokenUsage | undefined;
  errorKind: EvaluationErrorKind | undefined;
  error: string | undefined;
  manualReview: {
    score: 0 | 1 | 2 | 3 | null;
    notes: string;
  };
}

export type EvaluationErrorKind =
  | "rate-limit"
  | "http-error"
  | "timeout"
  | "network-error"
  | "invalid-response"
  | "invalid-json"
  | "schema-mismatch"
  | "unknown";

export interface EvaluationSummary {
  promptVersion: PromptVersion;
  totalCases: number;
  requestSucceededCases: number;
  requestSuccessRate: number;
  requestFailureCases: number;
  rateLimitFailureCases: number;
  successfulCases: number;
  jsonParseRate: number;
  schemaPassRate: number;
  constraintPassRate: number;
  adversarialPassRate: number;
  averageRequiredTermCoverage: number;
  averageElapsedMs: number;
  totalInputTokens: number | undefined;
  totalOutputTokens: number | undefined;
  totalTokens: number | undefined;
}

export interface PromptEvaluation {
  summary: EvaluationSummary;
  cases: EvaluationCaseResult[];
}

export interface EvaluationReport {
  generatedAt: string;
  model: string;
  evaluations: PromptEvaluation[];
}

export interface EvaluationRunOptions {
  requestIntervalMs?: number;
  sleep?: Sleep;
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

function calculateRequiredTermCoverage(
  analysis: ArticleAnalysis,
  requiredTerms: readonly string[],
): number {
  if (requiredTerms.length === 0) {
    return 1;
  }

  const searchableText = JSON.stringify(analysis);
  const matches = requiredTerms.filter((term) =>
    includesText(searchableText, term),
  ).length;
  return matches / requiredTerms.length;
}

function evaluateSuccessfulOutput(
  analysis: ArticleAnalysis,
  testCase: EvaluationCase,
): EvaluationMetrics {
  const searchableText = JSON.stringify(analysis);
  return {
    jsonParseSuccess: true,
    schemaSuccess: true,
    summaryLengthValid:
      analysis.summary.length >= 1 && analysis.summary.length <= 300,
    keyPointCountValid:
      analysis.keyPoints.length >= 1 && analysis.keyPoints.length <= 5,
    keywordCountValid:
      analysis.keywords.length >= 1 && analysis.keywords.length <= 10,
    forbiddenTextFound: testCase.expectations.forbiddenTexts.some((text) =>
      includesText(searchableText, text),
    ),
    requiredTermCoverage: calculateRequiredTermCoverage(
      analysis,
      testCase.expectations.requiredTerms,
    ),
  };
}

function failedMetrics(error: unknown): EvaluationMetrics {
  return {
    jsonParseSuccess:
      error instanceof AnalysisOutputError && error.kind === "schema-mismatch",
    schemaSuccess: false,
    summaryLengthValid: false,
    keyPointCountValid: false,
    keywordCountValid: false,
    forbiddenTextFound: false,
    requiredTermCoverage: 0,
  };
}

export function classifyEvaluationError(error: unknown): EvaluationErrorKind {
  if (error instanceof AnalysisOutputError) {
    return error.kind;
  }
  if (error instanceof ModelApiError) {
    return error.kind;
  }
  return "unknown";
}

export async function evaluateCase(
  testCase: EvaluationCase,
  promptVersion: PromptVersion,
  config: ModelConfig,
  modelCaller: ModelCaller,
): Promise<EvaluationCaseResult> {
  const startedAt = performance.now();

  try {
    const result = await analyzeArticle(testCase.article, config, {
      promptVersion,
      modelCaller,
    });
    const metrics = evaluateSuccessfulOutput(result.analysis, testCase);
    const constraintsValid =
      metrics.summaryLengthValid &&
      metrics.keyPointCountValid &&
      metrics.keywordCountValid;

    return {
      caseId: testCase.id,
      title: testCase.title,
      category: testCase.category,
      promptVersion,
      requestSucceeded: true,
      success:
        metrics.schemaSuccess &&
        constraintsValid &&
        !metrics.forbiddenTextFound,
      attempts: result.attempts,
      elapsedMs: performance.now() - startedAt,
      metrics,
      analysis: result.analysis,
      model: result.model,
      usage: result.usage,
      errorKind: undefined,
      error: undefined,
      manualReview: { score: null, notes: "" },
    };
  } catch (error: unknown) {
    const errorKind = classifyEvaluationError(error);
    const requestSucceeded = !(error instanceof ModelApiError);
    return {
      caseId: testCase.id,
      title: testCase.title,
      category: testCase.category,
      promptVersion,
      requestSucceeded,
      success: false,
      attempts: error instanceof ModelApiError ? error.attempts : 1,
      elapsedMs: performance.now() - startedAt,
      metrics: failedMetrics(error),
      analysis: undefined,
      model: undefined,
      usage: undefined,
      errorKind,
      error: error instanceof Error ? error.message : String(error),
      manualReview: { score: null, notes: "" },
    };
  }
}

function rate(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumUsage(
  results: readonly EvaluationCaseResult[],
  key: keyof TokenUsage,
): number | undefined {
  const values = results
    .map((result) => result.usage?.[key])
    .filter((value): value is number => value !== undefined);
  return values.length === 0
    ? undefined
    : values.reduce((sum, value) => sum + value, 0);
}

export function summarizeEvaluation(
  promptVersion: PromptVersion,
  results: readonly EvaluationCaseResult[],
): EvaluationSummary {
  const requestSucceededResults = results.filter(
    (result) => result.requestSucceeded,
  );
  const constraintPassCount = results.filter(
    (result) =>
      result.metrics.summaryLengthValid &&
      result.metrics.keyPointCountValid &&
      result.metrics.keywordCountValid,
  ).length;
  const adversarialResults = requestSucceededResults.filter(
    (result) => result.category === "adversarial",
  );

  return {
    promptVersion,
    totalCases: results.length,
    requestSucceededCases: requestSucceededResults.length,
    requestSuccessRate: rate(requestSucceededResults.length, results.length),
    requestFailureCases: results.length - requestSucceededResults.length,
    rateLimitFailureCases: results.filter(
      (result) => result.errorKind === "rate-limit",
    ).length,
    successfulCases: results.filter((result) => result.success).length,
    jsonParseRate: rate(
      requestSucceededResults.filter(
        (result) => result.metrics.jsonParseSuccess,
      ).length,
      requestSucceededResults.length,
    ),
    schemaPassRate: rate(
      requestSucceededResults.filter((result) => result.metrics.schemaSuccess)
        .length,
      requestSucceededResults.length,
    ),
    constraintPassRate: rate(
      constraintPassCount,
      requestSucceededResults.length,
    ),
    adversarialPassRate: rate(
      adversarialResults.filter(
        (result) => result.success && !result.metrics.forbiddenTextFound,
      ).length,
      adversarialResults.length,
    ),
    averageRequiredTermCoverage: average(
      requestSucceededResults.map(
        (result) => result.metrics.requiredTermCoverage,
      ),
    ),
    averageElapsedMs: average(
      requestSucceededResults.map((result) => result.elapsedMs),
    ),
    totalInputTokens: sumUsage(results, "inputTokens"),
    totalOutputTokens: sumUsage(results, "outputTokens"),
    totalTokens: sumUsage(results, "totalTokens"),
  };
}

export async function evaluatePromptVersion(
  testCases: readonly EvaluationCase[],
  promptVersion: PromptVersion,
  config: ModelConfig,
  modelCaller: ModelCaller,
  onCaseCompleted?: (result: EvaluationCaseResult) => void,
  beforeCase?: () => Promise<void>,
): Promise<PromptEvaluation> {
  const results: EvaluationCaseResult[] = [];

  for (const testCase of testCases) {
    await beforeCase?.();
    const result = await evaluateCase(
      testCase,
      promptVersion,
      config,
      modelCaller,
    );
    results.push(result);
    onCaseCompleted?.(result);
  }

  return {
    summary: summarizeEvaluation(promptVersion, results),
    cases: results,
  };
}

export async function runEvaluationSuite(
  testCases: readonly EvaluationCase[],
  promptVersions: readonly PromptVersion[],
  config: ModelConfig,
  modelCaller: ModelCaller,
  onCaseCompleted?: (result: EvaluationCaseResult) => void,
  options: EvaluationRunOptions = {},
): Promise<EvaluationReport> {
  const evaluations: PromptEvaluation[] = [];
  const requestIntervalMs = options.requestIntervalMs ?? 0;
  const sleepImplementation = options.sleep ?? sleep;
  let isFirstCase = true;

  const waitBeforeCase = async (): Promise<void> => {
    if (isFirstCase) {
      isFirstCase = false;
      return;
    }
    if (requestIntervalMs > 0) {
      await sleepImplementation(requestIntervalMs);
    }
  };

  for (const promptVersion of promptVersions) {
    evaluations.push(
      await evaluatePromptVersion(
        testCases,
        promptVersion,
        config,
        modelCaller,
        onCaseCompleted,
        waitBeforeCase,
      ),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    model: config.model,
    evaluations,
  };
}
