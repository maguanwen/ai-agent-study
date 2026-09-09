import { ToolRegistry } from "./tool-registry.js";
import { executeTool } from "./tool-executor.js";
import { calculatorTool } from "./tools/calculator.js";

const operation = process.argv[2] ?? "add";
const left = Number(process.argv[3] ?? "12");
const right = Number(process.argv[4] ?? "8");

const registry = new ToolRegistry([calculatorTool]);

try {
  const execution = await executeTool(registry, {
    name: "calculator",
    arguments: { operation, left, right },
  });
  console.log(JSON.stringify(execution, null, 2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`工具调用失败：${message}`);
  process.exitCode = 1;
}
