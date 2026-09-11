import { z } from "zod";
import type { ToolRegistry } from "./tool-registry.js";

export const assistantSchema = z.object({
  role: z.literal("assistant"),
  content: z.string().nullable().optional(),
  tool_calls: z.array(z.object({
    id: z.string().min(1), type: z.literal("function"),
    function: z.object({ name: z.string().min(1), arguments: z.string() }),
  })).optional(),
});
export type AssistantMessage = z.infer<typeof assistantSchema>;
export type Message =
  | { role: "system" | "user"; content: string }
  | AssistantMessage
  | { role: "tool"; tool_call_id: string; content: string };
const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});
export type Usage = z.infer<typeof usageSchema>;

export function buildTools(registry: ToolRegistry) {
  return registry.list().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name, description: tool.description,
      // 自定义 refine 规则仍由本地 Zod 校验负责。
      parameters: z.toJSONSchema(tool.inputSchema, { io: "input" }),
      strict: false,
    },
  }));
}
export type ModelCaller = (
  messages: readonly Message[], tools: ReturnType<typeof buildTools>,
) => Promise<{ message: AssistantMessage; usage?: Usage }>;

const configSchema = z.object({
  MODEL_API_KEY: z.string().trim().min(1),
  MODEL_BASE_URL: z.url(),
  MODEL_NAME: z.string().trim().min(1),
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000).default(30000),
  MODEL_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(16000).default(1000),
  MODEL_TOKEN_PARAMETER: z.enum(["max_completion_tokens", "max_tokens"]).default("max_completion_tokens"),
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(20).default(6),
  AGENT_MAX_TOOL_CALLS: z.coerce.number().int().min(1).max(30).default(8),
});
export function loadAgentConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error("请检查配置字段：" + result.error.issues.map((issue) => issue.path.join(".")).join(", "));
  }
  return result.data;
}
export class ModelRequestError extends Error {
  override readonly name = "ModelRequestError";
  constructor(readonly kind: "http" | "network" | "timeout" | "invalid-response", message: string) {
    super(message);
  }
}
export function createModelCaller(
  config: ReturnType<typeof loadAgentConfig>, request: typeof fetch = fetch,
): ModelCaller {
  return async (messages, tools) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.MODEL_TIMEOUT_MS);
    try {
      const response = await request(config.MODEL_BASE_URL.replace(/\/+$/, "") + "/chat/completions", {
        method: "POST", redirect: "error",
        headers: { Authorization: "Bearer " + config.MODEL_API_KEY, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.MODEL_NAME, messages, tools, tool_choice: "auto",
          [config.MODEL_TOKEN_PARAMETER]: config.MODEL_MAX_OUTPUT_TOKENS,
        }),
      });
      if (!response.ok) throw new ModelRequestError("http", "模型请求失败，HTTP " + response.status);
      let body: unknown;
      try { body = await response.json(); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new ModelRequestError("invalid-response", "模型响应不是合法 JSON");
      }
      const parsed = z.object({
        choices: z.array(z.object({
          message: assistantSchema, finish_reason: z.enum(["stop", "tool_calls"]),
        })).min(1),
        usage: usageSchema.optional(),
      }).safeParse(body);
      if (!parsed.success) throw new ModelRequestError("invalid-response", "模型响应不完整或工具调用协议不符合预期");
      return {
        message: parsed.data.choices[0]!.message,
        ...(parsed.data.usage ? { usage: parsed.data.usage } : {}),
      };
    } catch (error) {
      if (controller.signal.aborted) throw new ModelRequestError("timeout", "模型请求超时");
      if (error instanceof ModelRequestError) throw error;
      throw new ModelRequestError("network", "无法连接模型服务");
    } finally { clearTimeout(timer); }
  };
}
