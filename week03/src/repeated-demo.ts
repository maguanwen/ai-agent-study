import type { ModelCaller } from "./model.js";

export const repeatedDemoQuestion = "请使用计算器计算 12 + 8。";

// 故意模拟不读取计算结果、持续要求相同操作的模型，无网络请求。
export const repeatedDemoCaller: ModelCaller = async (messages) => {
  const attempt = messages.filter((message) => message.role === "tool").length + 1;
  return { message: { role: "assistant", content: null, tool_calls: [{
    id: `repeated-${attempt}`, type: "function", function: {
      name: "calculator",
      // 即使 ID、空格和对象键顺序变化，也应识别为相同请求。
      arguments: attempt % 2 === 0
        ? '{ "right": 8, "left": 12, "operation": "add" }'
        : '{"operation":"add","left":12,"right":8}',
    },
  }] } };
};
