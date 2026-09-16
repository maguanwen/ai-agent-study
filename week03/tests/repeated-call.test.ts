import { describe, expect, it, vi } from "vitest";
import { toolCallFingerprint } from "../src/repeated-call.js";
import { repeatedDemoCaller, repeatedDemoQuestion } from "../src/repeated-demo.js";
import { runAgent } from "../src/agent.js";
import type { AssistantMessage, ModelCaller } from "../src/model.js";
import { ToolRegistry } from "../src/tool-registry.js";
import { calculatorTool } from "../src/tools/calculator.js";

const registry = new ToolRegistry([calculatorTool]);
const args = '{"operation":"add","left":12,"right":8}';
function call(id: string, argumentsText = args) {
  return { id, type: "function" as const, function: { name: "calculator", arguments: argumentsText } };
}
function reply(...calls: ReturnType<typeof call>[]): { message: AssistantMessage } {
  return { message: { role: "assistant", tool_calls: calls } };
}

describe("工具调用指纹", () => {
  it("递归忽略对象键顺序与空格", () => {
    expect(toolCallFingerprint("x", '{"b":{"y":2,"x":1},"a":0}'))
      .toBe(toolCallFingerprint("x", '{ "a":0,"b":{"x":1,"y":2}}'));
  });
  it("保留工具名、参数值、类型和数组顺序的区别", () => {
    const keys = [
      toolCallFingerprint("x", '{"a":[1,2]}'),
      toolCallFingerprint("y", '{"a":[1,2]}'),
      toolCallFingerprint("x", '{"a":[2,1]}'),
      toolCallFingerprint("x", '{"a":["1",2]}'),
    ];
    expect(new Set(keys).size).toBe(4);
  });
  it("非法 JSON 按原文识别，且不与合法 JSON 混淆", () => {
    expect(toolCallFingerprint("x", "{")).toBe(toolCallFingerprint("x", "{"));
    expect(toolCallFingerprint("x", "{")).not.toBe(toolCallFingerprint("x", '"{"'));
  });
});

describe("重复调用保护", () => {
  it("不同 ID 的第三次相同调用被拦截，保留前两次轨迹", async () => {
    const model = vi.fn(repeatedDemoCaller);
    const result = await runAgent(repeatedDemoQuestion, registry, model);
    expect(result).toMatchObject({
      stopReason: "repeated-tool-call", steps: 3, answer: null,
      blockedCall: { toolCallId: "repeated-3", toolName: "calculator", limit: 2 },
    });
    expect(model).toHaveBeenCalledTimes(3);
    expect(result.trace.map((entry) => entry.toolCallId)).toEqual(["repeated-1", "repeated-2"]);
    expect(result.trace.every((entry) => entry.result.ok)).toBe(true);
  });
  it("同一批超限时整批都不执行", async () => {
    const invoke = vi.fn(calculatorTool.invoke);
    const localRegistry = new ToolRegistry([{ ...calculatorTool, invoke }]);
    const result = await runAgent("计算", localRegistry, async () => reply(call("a"), call("b"), call("c")));
    expect(result.stopReason).toBe("repeated-tool-call");
    expect(result.trace).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });
  it.each(["{", '{"operation":"divide","left":12,"right":0}'])("失败尝试也计数：%s", async (input) => {
    const result = await runAgent("计算", registry, async () => reply(call("bad", input)));
    expect(result.stopReason).toBe("repeated-tool-call");
    expect(result.trace).toHaveLength(2);
    expect(result.trace.every((entry) => !entry.result.ok)).toBe(true);
  });
  it("修改参数不会被当成重复，可正常完成", async () => {
    const model = vi.fn<ModelCaller>()
      .mockResolvedValueOnce(reply(call("a")))
      .mockResolvedValueOnce(reply(call("b", '{"operation":"multiply","left":20,"right":3}')))
      .mockResolvedValueOnce({ message: { role: "assistant", content: "60" } });
    const result = await runAgent("分两步计算", registry, model, { maxIdenticalToolCalls: 1 });
    expect(result).toMatchObject({ stopReason: "completed", answer: "60" });
    expect(result.trace).toHaveLength(2);
  });
  it("不同任务不共享计数，且可调整阈值", async () => {
    for (let i = 0; i < 2; i++) {
      const result = await runAgent("计算", registry, repeatedDemoCaller, { maxIdenticalToolCalls: 1 });
      expect(result).toMatchObject({ stopReason: "repeated-tool-call", steps: 2 });
      expect(result.trace).toHaveLength(1);
    }
  });
  it("穿插其他请求仍累计相同调用", async () => {
    const model = vi.fn<ModelCaller>()
      .mockResolvedValueOnce(reply(call("a")))
      .mockResolvedValueOnce(reply(call("b", '{"operation":"add","left":1,"right":2}')))
      .mockResolvedValueOnce(reply(call("c")));
    const result = await runAgent("计算", registry, model, { maxIdenticalToolCalls: 1 });
    expect(result.stopReason).toBe("repeated-tool-call");
    expect(result.trace).toHaveLength(2);
  });
  it.each([0, -1, 1.5, 31])("拒绝非法阈值 %s", async (limit) => {
    const model = vi.fn(repeatedDemoCaller);
    await expect(runAgent("计算", registry, model, { maxIdenticalToolCalls: limit })).rejects.toThrow();
    expect(model).not.toHaveBeenCalled();
  });
});
