import { z } from "zod";

export const knowledgeInputSchema = z.object({
  query: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(5).default(3),
}).strict();

export const knowledgeResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    source: z.string(),
  }).strict()).max(5),
}).strict();

// 教学用固定资料，source 是条目的来源标识；这里尚未使用向量检索。
const entries: z.infer<typeof knowledgeResponseSchema>["results"] = [
  { id: "tools", title: "工具调用", content: "模型提出工具名称和参数，程序通过白名单与参数校验后执行工具。", source: "week03-notes/tools" },
  { id: "zod", title: "Zod 参数校验", content: "TypeScript 类型在运行时被擦除，Zod 用于验证外部数据的结构和业务约束。", source: "week03-notes/zod" },
  { id: "timeout", title: "请求超时", content: "fetch 可以接收 AbortController 的 signal；超时后调用 abort 中止请求。", source: "week03-notes/timeout" },
  { id: "retry", title: "有限重试", content: "临时限流可以等待后有限重试；额度耗尽需要处理账户配置。", source: "week03-notes/retry" },
];

export function searchKnowledge(input: z.infer<typeof knowledgeInputSchema>) {
  const query = input.query.toLocaleLowerCase();
  return {
    results: entries.filter((entry) =>
      (entry.title + " " + entry.content).toLocaleLowerCase().includes(query),
    ).slice(0, input.limit),
  };
}
