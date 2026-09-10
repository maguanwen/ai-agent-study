import { ToolRegistry } from "./tool-registry.js";
import { executeTool } from "./tool-executor.js";
import { calculatorTool } from "./tools/calculator.js";
import { createTimeTool } from "./tools/time.js";
import { createKnowledgeTool, KnowledgeRequestError } from "./tools/knowledge-search.js";
import { ToolInputValidationError } from "./tools/types.js";

const registry = new ToolRegistry([calculatorTool, createTimeTool(), createKnowledgeTool()]);

try {
  const args = process.argv.slice(2);
  if (args[0] === "list") {
    console.log(JSON.stringify(registry.list().map(({ name, description }) => ({ name, description })), null, 2));
  } else {
    // 保留第一阶段的 multiply 6 7 等命令；新入口使用工具名和 JSON 参数。
    const legacy = args.length === 0 || ["add", "subtract", "multiply", "divide"].includes(args[0]!);
    const request = legacy ? {
      name: "calculator",
      arguments: { operation: args[0] ?? "add", left: Number(args[1] ?? "12"), right: Number(args[2] ?? "8") },
    } : {
      name: args[0]!,
      arguments: JSON.parse(args[1] ?? "{}") as unknown,
    };
    const execution = await executeTool(registry, request);
    console.log(JSON.stringify(execution, null, 2));
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`工具调用失败：${message}`);
  if (error instanceof SyntaxError) console.error("工具参数必须是合法 JSON。");
  if (error instanceof ToolInputValidationError) {
    console.error(error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("\n"));
  }
  if (error instanceof Error && error.cause instanceof KnowledgeRequestError) {
    console.error(error.cause.kind + ": " + error.cause.message);
  }
  process.exitCode = 1;
}
