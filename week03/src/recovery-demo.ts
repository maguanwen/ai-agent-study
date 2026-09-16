import { z } from "zod";
import type { ModelCaller } from "./model.js";

export const recoveryDemoQuestion = "请使用计算器计算 12 除以 3。";

// 仅用于教学：模拟模型读取工具反馈，不请求 API，也不是通用的参数修复器。
const observationSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(false), error: z.object({ kind: z.string(), message: z.string() }) }),
  z.object({ ok: z.literal(true), output: z.object({ result: z.number().finite() }) }),
]);

export const recoveryDemoCaller: ModelCaller = async (messages) => {
  // 读取最近一次工具结果，不能一直读取第一条失败结果。
  const observation = messages.findLast((message) => message.role === "tool");
  let right = 0; // 第一轮故意把用户要求的除数 3 写成 0，触发本地校验。
  let id = "recovery-bad";

  if (observation?.role === "tool") {
    const result = observationSchema.parse(JSON.parse(observation.content));
    if (result.ok) {
      return { message: { role: "assistant", content: `修正参数后，计算器返回的结果是 ${result.output.result}。` } };
    }
    if (result.error.kind !== "invalid-arguments" || observation.tool_call_id !== "recovery-bad") {
      return { message: { role: "assistant", content: `演示无法继续修复：${result.error.message}` } };
    }
    // 第二轮模拟模型根据错误反馈，恢复为题目要求的除数，而不是重发原请求。
    right = 3;
    id = "recovery-fixed";
  }

  return { message: { role: "assistant", content: null, tool_calls: [{
    id, type: "function", function: {
      name: "calculator",
      arguments: JSON.stringify({ operation: "divide", left: 12, right }),
    },
  }] } };
};
