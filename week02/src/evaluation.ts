import type { ArticleAnalysis } from "./schema.js";
import type { ModelConfig } from "./env.js";
import {
  AnalysisOutputError,
  AnalysisRequestError,
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
  repairAttempts: number;
  rateLimitCooldowns: number;
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
  | "quota-exhausted"
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
  rateLimitCooldownCases: number;
  rateLimitRecoveredCases: number;
  repairTriggeredCases: number;
  repairSuccessfulCases: number;
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
  rateLimitCooldownMs?: number;
  maxRateLimitCooldowns?: number;
  sleep?: Sleep;
  onRateLimitCooldown?: (event: {
    testCase: EvaluationCase;
    promptVersion: PromptVersion;
    cooldown: number;
    maxCooldowns: number;
    delayMs: number;
  }) => void;
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
  if (error instanceof AnalysisRequestError) {
    return error.apiError.kind;
  }
  return "unknown";
}

function requestSucceeded(error: unknown): boolean {
  return !(
    error instanceof ModelApiError || error instanceof AnalysisRequestError
  );
}

function attemptsFromError(error: unknown): number {
  if (
    error instanceof ModelApiError ||
    error instanceof AnalysisOutputError ||
    error instanceof AnalysisRequestError
  ) {
    return error.attempts;
  }
  return 1;
}

function repairAttemptsFromError(error: unknown): number {
  if (
    error instanceof AnalysisOutputError ||
    error instanceof AnalysisRequestError
  ) {
    return error.repairAttempts;
  }
  return 0;
}

function usageFromError(error: unknown): TokenUsage | undefined {
  if (
    error instanceof AnalysisOutputError ||
    error instanceof AnalysisRequestError
  ) {
    return error.usage;
  }
  return undefined;
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
      repairAttempts: result.repairAttempts,
      rateLimitCooldowns: 0,
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
    return {
      caseId: testCase.id,
      title: testCase.title,
      category: testCase.category,
      promptVersion,
      requestSucceeded: requestSucceeded(error),
      success: false,
      attempts: attemptsFromError(error),
      repairAttempts: repairAttemptsFromError(error),
      rateLimitCooldowns: 0,
      elapsedMs: performance.now() - startedAt,
      metrics: failedMetrics(error),
      analysis: undefined,
      model: undefined,
      usage: usageFromError(error),
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

function addTokenUsage(
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
    rateLimitCooldownCases: results.filter(
      (result) => result.rateLimitCooldowns > 0,
    ).length,
    rateLimitRecoveredCases: results.filter(
      (result) => result.rateLimitCooldowns > 0 && result.requestSucceeded,
    ).length,
    repairTriggeredCases: results.filter(
      (result) => result.repairAttempts > 0,
    ).length,
    repairSuccessfulCases: results.filter(
      (result) => result.repairAttempts > 0 && result.success,
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
  options: EvaluationRunOptions = {},
): Promise<PromptEvaluation> {
  const results: EvaluationCaseResult[] = [];
  const cooldownMs = options.rateLimitCooldownMs ?? 0;
  const maxCooldowns = options.maxRateLimitCooldowns ?? 0;
  const sleepImplementation = options.sleep ?? sleep;

  for (const testCase of testCases) {
    let cooldowns = 0;
    let attempts = 0;
    let repairAttempts = 0;
    let elapsedMs = 0;
    let usage: TokenUsage | undefined;
    let finalResult: EvaluationCaseResult;

    while (true) {
      const result = await evaluateCase(
        testCase,
        promptVersion,
        config,
        modelCaller,
      );
      attempts += result.attempts;
      repairAttempts += result.repairAttempts;
      elapsedMs += result.elapsedMs;
      usage = addTokenUsage(usage, result.usage);

      if (result.errorKind !== "rate-limit" || cooldowns >= maxCooldowns) {
        finalResult = {
          ...result,
          attempts,
          repairAttempts,
          rateLimitCooldowns: cooldowns,
          elapsedMs,
          usage,
        };
        break;
      }

      cooldowns += 1;
      options.onRateLimitCooldown?.({
        testCase,
        promptVersion,
        cooldown: cooldowns,
        maxCooldowns,
        delayMs: cooldownMs,
      });
      if (cooldownMs > 0) {
        await sleepImplementation(cooldownMs);
        elapsedMs += cooldownMs;
      }
    }

    results.push(finalResult);
    onCaseCompleted?.(finalResult);
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

  for (const promptVersion of promptVersions) {
    evaluations.push(
      await evaluatePromptVersion(
        testCases,
        promptVersion,
        config,
        modelCaller,
        onCaseCompleted,
        options,
      ),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    model: config.model,
    evaluations,
  };
}
