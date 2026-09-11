import { describe, expect, it, vi } from "vitest";
import { runAgent } from "../src/agent.js";
import { ToolRegistry } from "../src/tool-registry.js";
import { calculatorTool } from "../src/tools/calculator.js";
import type { AssistantMessage, ModelCaller } from "../src/model.js";

const registry = new ToolRegistry([calculatorTool]);
function call(id = "call-1", args = '{"operation":"multiply","left":6,"right":7}', name = "calculator"): AssistantMessage {
  return { role: "assistant", content: null, tool_calls: [{
    id, type: "function", function: { name, arguments: args },
  }] };
}
const final = { role: "assistant", content: "结果是 42" } as const;
const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };

describe("Agent 循环", () => {
  it("允许直接回答", async () => {
    const model = vi.fn<ModelCaller>().mockResolvedValue({ message: final });
    expect(await runAgent("你好", registry, model)).toMatchObject({
      stopReason: "completed", steps: 1, trace: [], missingUsageSteps: 1,
    });
  });
  it("执行工具后按 ID 回传结果、保留消息顺序并累计 usage", async () => {
    const model = vi.fn<ModelCaller>()
      .mockResolvedValueOnce({ message: call(), usage })
      .mockResolvedValueOnce({ message: final, usage });
    const result = await runAgent("算一下", registry, model);
    expect(result).toMatchObject({
      stopReason: "completed", steps: 2, answer: "结果是 42",
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      trace: [{ toolCallId: "call-1", result: { ok: true, output: { result: 42 } } }],
    });
    const history = model.mock.calls[1]![0];
    expect(history.map((message) => message.role)).toEqual(["system", "user", "assistant", "tool"]);
    expect(history[3]).toMatchObject({ tool_call_id: "call-1", content: expect.stringContaining('"result":42') });
  });
  it.each([
    ["{", "calculator", "invalid-json"],
    ['{"operation":"divide","left":1,"right":0}', "calculator", "invalid-arguments"],
    ["{}", "unknown", "unknown-tool"],
  ])("工具失败可反馈并重新生成调用", async (args, name, kind) => {
    const model = vi.fn<ModelCaller>()
      .mockResolvedValueOnce({ message: call("bad", args, name) })
      .mockResolvedValueOnce({ message: call("fixed") })
      .mockResolvedValueOnce({ message: final });
    const result = await runAgent("计算", registry, model);
    expect(result.stopReason).toBe("completed");
    expect(result.trace[0]?.result).toMatchObject({ ok: false, error: { kind } });
    expect(result.trace[1]?.result).toMatchObject({ ok: true });
  });
  it("同一步的多个工具结果分别对应调用 ID", async () => {
    const model = vi.fn<ModelCaller>()
      .mockResolvedValueOnce({ message: { role: "assistant", tool_calls: [
        ...call("a").tool_calls!, ...call("b").tool_calls!,
      ] } })
      .mockResolvedValueOnce({ message: final });
    const result = await runAgent("计算", registry, model);
    expect(result.trace.map((entry) => entry.toolCallId)).toEqual(["a", "b"]);
    expect(model.mock.calls[1]![0].slice(-2)).toMatchObject([{ tool_call_id: "a" }, { tool_call_id: "b" }]);
  });
  it("达到步数上限不再执行工具，也不伪造最终答案", async () => {
    const model = vi.fn<ModelCaller>().mockResolvedValue({ message: call() });
    const result = await runAgent("重复", registry, model, { maxSteps: 2 });
    expect(result).toMatchObject({ stopReason: "max-steps", answer: null, steps: 2 });
    expect(result.trace).toHaveLength(1);
    expect(model).toHaveBeenCalledTimes(2);
  });
  it("达到工具调用预算停止", async () => {
    const model = vi.fn<ModelCaller>().mockResolvedValue({ message: call() });
    const result = await runAgent("重复", registry, model, { maxToolCalls: 1 });
    expect(result.stopReason).toBe("max-tool-calls");
    expect(result.trace).toHaveLength(1);
  });
  it("模型失败时保留已有轨迹并结束", async () => {
    const model = vi.fn<ModelCaller>()
      .mockResolvedValueOnce({ message: call() })
      .mockRejectedValueOnce(new Error("private detail"));
    const result = await runAgent("计算", registry, model);
    expect(result.stopReason).toBe("model-error");
    expect(result.trace).toHaveLength(1);
    expect(result.error).not.toContain("private detail");
  });
  it("拒绝同批重复 ID 和空响应", async () => {
    for (const message of [
      { role: "assistant" as const, tool_calls: [...call().tool_calls!, ...call().tool_calls!] },
      { role: "assistant" as const, content: null },
    ]) {
      const result = await runAgent("计算", registry, async () => ({ message }));
      expect(result.stopReason).toBe("model-error");
      expect(result.trace).toHaveLength(0);
    }
  });
});
