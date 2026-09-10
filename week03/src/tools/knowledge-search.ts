import { knowledgeInputSchema, knowledgeResponseSchema } from "../knowledge.js";
import { defineTool } from "./types.js";

export class KnowledgeRequestError extends Error {
  override readonly name = "KnowledgeRequestError";
  constructor(
    readonly kind: "timeout" | "network" | "http" | "invalid-response",
    message: string,
  ) { super(message); }
}

export function createKnowledgeTool(options: {
  endpoint?: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
} = {}) {
  // 地址来自开发者配置，不允许工具调用参数指定任意 URL。
  const endpoint = options.endpoint ?? "http://127.0.0.1:3033/knowledge";
  const timeoutMs = options.timeoutMs ?? 3000;
  const request = options.fetchImplementation ?? fetch;
  return defineTool({
    name: "search_knowledge",
    description: "按关键词查询本地学习资料，返回条目及来源；未找到时返回空数组。",
    inputSchema: knowledgeInputSchema,
    async execute({ query, limit }) {
      const url = new URL(endpoint);
      url.searchParams.set("query", query);
      url.searchParams.set("limit", String(limit));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await request(url, { signal: controller.signal, redirect: "error" });
        if (!response.ok) {
          throw new KnowledgeRequestError("http", "知识服务返回 HTTP " + response.status);
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch (error) {
          if (controller.signal.aborted) throw error;
          throw new KnowledgeRequestError("invalid-response", "知识服务未返回合法 JSON");
        }
        const parsed = knowledgeResponseSchema.safeParse(body);
        if (!parsed.success) {
          throw new KnowledgeRequestError("invalid-response", "知识服务响应结构不合法");
        }
        return parsed.data;
      } catch (error) {
        if (controller.signal.aborted) {
          throw new KnowledgeRequestError("timeout", "知识服务请求超时");
        }
        if (error instanceof KnowledgeRequestError) throw error;
        throw new KnowledgeRequestError("network", "无法连接知识服务，请先运行 pnpm serve");
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
