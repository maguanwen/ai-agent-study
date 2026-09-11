import { describe, expect, it, vi } from "vitest";
import { buildTools, createModelCaller, loadAgentConfig } from "../src/model.js";
import { ToolRegistry } from "../src/tool-registry.js";
import { calculatorTool } from "../src/tools/calculator.js";
import { createTimeTool } from "../src/tools/time.js";
import { createKnowledgeTool } from "../src/tools/knowledge-search.js";

const config = loadAgentConfig({
  MODEL_API_KEY: "test-secret", MODEL_BASE_URL: "https://example.com/v1", MODEL_NAME: "test-model",
});
const tools = buildTools(new ToolRegistry([calculatorTool, createTimeTool(), createKnowledgeTool()]));
describe("工具协议适配", () => {
  it("导出三个工具的 JSON Schema，保留本地运行时约束", () => {
    expect(tools.map((tool) => tool.function.name)).toEqual(["calculator", "get_current_time", "search_knowledge"]);
    expect(tools[0]?.function.parameters).toMatchObject({ type: "object", additionalProperties: false });
    expect(tools[2]?.function.parameters.required).toContain("query");
  });
  it("发送 tools 并支持 content=null 的工具调用响应", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{
        id: "c1", type: "function", function: { name: "calculator", arguments: "{}" },
      }] } }],
    })));
    expect((await createModelCaller(config, request)([{ role: "user", content: "计算" }], tools)).message.tool_calls).toHaveLength(1);
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body).toMatchObject({ model: "test-model", tool_choice: "auto", max_completion_tokens: 1000 });
    expect(body.tools).toHaveLength(3);
    expect(body.response_format).toBeUndefined();
  });
  it.each([
    [new Response("secret body", { status: 429 }), "http"],
    [new Response("bad json"), "invalid-response"],
    [new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { role: "assistant", content: "截断" } }] })), "invalid-response"],
  ])("拒绝 HTTP 错误、非法 JSON 与截断响应", async (response, kind) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(createModelCaller(config, request)([], tools)).rejects.toMatchObject({ kind });
  });
  it("兼容服务可选择 max_tokens 参数", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: "你好" } }],
    })));
    await createModelCaller({ ...config, MODEL_TOKEN_PARAMETER: "max_tokens" }, request)([], tools);
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body.max_tokens).toBe(1000);
    expect(body.max_completion_tokens).toBeUndefined();
  });
  it("超时中止模型请求", async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("abort")), { once: true });
      }));
      const result = createModelCaller({ ...config, MODEL_TIMEOUT_MS: 100 }, request)([], tools);
      const assertion = expect(result).rejects.toMatchObject({ kind: "timeout" });
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it("配置错误不会输出密钥值", () => {
    expect(() => loadAgentConfig({ MODEL_API_KEY: "test-secret" })).toThrow(/MODEL_BASE_URL/);
    try { loadAgentConfig({ MODEL_API_KEY: "test-secret" }); }
    catch (error) { expect(String(error)).not.toContain("test-secret"); }
  });
});
