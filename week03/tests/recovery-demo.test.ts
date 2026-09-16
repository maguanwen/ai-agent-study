import { describe, expect, it, vi } from "vitest";
import { runAgent } from "../src/agent.js";
import { recoveryDemoCaller, recoveryDemoQuestion } from "../src/recovery-demo.js";
import { ToolRegistry } from "../src/tool-registry.js";
import { calculatorTool } from "../src/tools/calculator.js";

const registry = new ToolRegistry([calculatorTool]);

describe("错误恢复演示", () => {
  it("读取失败反馈后修正除数，最后根据最新成功结果回答", async () => {
    const caller = vi.fn(recoveryDemoCaller);
    const result = await runAgent(recoveryDemoQuestion, registry, caller);
    expect(result).toMatchObject({
      stopReason: "completed", steps: 3, missingUsageSteps: 3,
      answer: "修正参数后，计算器返回的结果是 4。",
    });
    expect(result.trace).toHaveLength(2);
    expect(result.trace[0]).toMatchObject({
      toolCallId: "recovery-bad", result: { ok: false, error: { kind: "invalid-arguments" } },
    });
    expect(result.trace[1]).toMatchObject({
      toolCallId: "recovery-fixed", result: { ok: true, output: { result: 4 } },
    });
    expect(result.trace.map((entry) => JSON.parse(entry.arguments).right)).toEqual([0, 3]);
    expect(caller.mock.calls[1]![0].at(-1)).toMatchObject({
      role: "tool", tool_call_id: "recovery-bad", content: expect.stringContaining("invalid-arguments"),
    });
    expect(caller.mock.calls[2]![0].map((message) => message.role))
      .toEqual(["system", "user", "assistant", "tool", "assistant", "tool"]);
  });

  it.each([
    [{ maxSteps: 2 }, "max-steps"],
    [{ maxToolCalls: 1 }, "max-tool-calls"],
  ] as const)("恢复过程仍然遵守预算 %o", async (options, stopReason) => {
    const result = await runAgent(recoveryDemoQuestion, registry, recoveryDemoCaller, options);
    expect(result).toMatchObject({ stopReason, steps: 2, answer: null });
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]?.result.ok).toBe(false);
  });

  it("其他错误不会被误当成除数错误进行修复", async () => {
    const response = await recoveryDemoCaller([{
      role: "tool", tool_call_id: "recovery-bad",
      content: JSON.stringify({ ok: false, error: { kind: "execution-error", message: "工具执行失败。" } }),
    }], []);
    expect(response.message.tool_calls).toBeUndefined();
    expect(response.message.content).toContain("无法继续修复");
  });
});
