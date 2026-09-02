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
import type { TokenUsage } from "./model.js";
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
  success: boolean;
  elapsedMs: number;
  metrics: EvaluationMetrics;
  analysis: ArticleAnalysis | undefined;
  model: string | undefined;
  usage: TokenUsage | undefined;
  error: string | undefined;
  manualReview: {
    score: 0 | 1 | 2 | 3 | null;
    notes: string;
  };
}

export interface EvaluationSummary {
  promptVersion: PromptVersion;
  totalCases: number;
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
      success:
        metrics.schemaSuccess &&
        constraintsValid &&
        !metrics.forbiddenTextFound,
      elapsedMs: performance.now() - startedAt,
      metrics,
      analysis: result.analysis,
      model: result.model,
      usage: result.usage,
      error: undefined,
      manualReview: { score: null, notes: "" },
    };
  } catch (error: unknown) {
    return {
      caseId: testCase.id,
      title: testCase.title,
      category: testCase.category,
      promptVersion,
      success: false,
      elapsedMs: performance.now() - startedAt,
      metrics: failedMetrics(error),
      analysis: undefined,
      model: undefined,
      usage: undefined,
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
  const constraintPassCount = results.filter(
    (result) =>
      result.metrics.summaryLengthValid &&
      result.metrics.keyPointCountValid &&
      result.metrics.keywordCountValid,
  ).length;
  const adversarialResults = results.filter(
    (result) => result.category === "adversarial",
  );

  return {
    promptVersion,
    totalCases: results.length,
    successfulCases: results.filter((result) => result.success).length,
    jsonParseRate: rate(
      results.filter((result) => result.metrics.jsonParseSuccess).length,
      results.length,
    ),
    schemaPassRate: rate(
      results.filter((result) => result.metrics.schemaSuccess).length,
      results.length,
    ),
    constraintPassRate: rate(constraintPassCount, results.length),
    adversarialPassRate: rate(
      adversarialResults.filter(
        (result) => result.success && !result.metrics.forbiddenTextFound,
      ).length,
      adversarialResults.length,
    ),
    averageRequiredTermCoverage: average(
      results.map((result) => result.metrics.requiredTermCoverage),
    ),
    averageElapsedMs: average(results.map((result) => result.elapsedMs)),
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
): Promise<PromptEvaluation> {
  const results: EvaluationCaseResult[] = [];

  for (const testCase of testCases) {
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
      ),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    model: config.model,
    evaluations,
  };
}
