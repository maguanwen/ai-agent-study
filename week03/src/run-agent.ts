import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { runAgent } from "./agent.js";
import { createModelCaller, loadAgentConfig, type ModelCaller } from "./model.js";
import { ToolRegistry } from "./tool-registry.js";
import { calculatorTool } from "./tools/calculator.js";
import { createTimeTool } from "./tools/time.js";
import { createKnowledgeTool } from "./tools/knowledge-search.js";
import { recoveryDemoCaller, recoveryDemoQuestion } from "./recovery-demo.js";
import { repeatedDemoCaller, repeatedDemoQuestion } from "./repeated-demo.js";

async function main() {
  const demo = process.argv[2] === "--demo";
  const recoveryDemo = process.argv[2] === "--demo-recovery";
  const repeatedDemo = process.argv[2] === "--demo-repeated";
  const question = repeatedDemo ? repeatedDemoQuestion : recoveryDemo ? recoveryDemoQuestion
    : demo ? "请使用计算器计算 6 乘 7。" : process.argv.slice(2).join(" ");
  if (!question.trim()) throw new Error('用法：pnpm agent -- "请使用计算器计算 6 乘 7"');
  const registry = new ToolRegistry([calculatorTool, createTimeTool(), createKnowledgeTool()]);
  let caller: ModelCaller;
  let maxSteps = 6;
  let maxToolCalls = 8;
  if (repeatedDemo) {
    console.log("重复调用演示：模拟模型不断请求 12 + 8；第三次相同请求被拦截，无 API 费用。");
    caller = repeatedDemoCaller;
  } else if (recoveryDemo) {
    console.log("错误恢复演示：模拟模型先传错参数，再读取错误并修正；不调用真实 API。");
    caller = recoveryDemoCaller;
  } else if (demo) {
    console.log("演示模式：模拟模型选择工具，真实执行本地计算器。");
    caller = async (messages) => {
      const observation = messages.find((message) => message.role === "tool");
      if (observation?.role === "tool") {
        return { message: { role: "assistant", content: "计算器观察结果：" + observation.content } };
      }
      return { message: { role: "assistant", content: null, tool_calls: [{
        id: "demo-1", type: "function", function: {
          name: "calculator", arguments: JSON.stringify({ operation: "multiply", left: 6, right: 7 }),
        },
      }] } };
    };
  } else {
    if (existsSync(".env")) loadEnvFile(".env");
    const config = loadAgentConfig();
    caller = createModelCaller(config);
    maxSteps = config.AGENT_MAX_STEPS;
    maxToolCalls = config.AGENT_MAX_TOOL_CALLS;
  }
  const result = await runAgent(question, registry, caller, {
    maxSteps, maxToolCalls,
    onTool: (entry) => console.log(JSON.stringify(entry, null, 2)),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.stopReason !== "completed") process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Agent 启动失败");
  process.exitCode = 1;
});
