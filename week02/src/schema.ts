import { z } from "zod";

export const articleInputSchema = z
  .string()
  .trim()
  .min(50, "文章不能少于 50 个字符")
  .max(20_000, "文章不能超过 20000 个字符");

export const articleAnalysisSchema = z
  .object({
    summary: z.string().trim().min(1).max(300),
    keyPoints: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
    keywords: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
  })
  .strict();

export type ArticleAnalysis = z.infer<typeof articleAnalysisSchema>;
