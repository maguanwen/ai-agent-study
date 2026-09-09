import { describe, expect, it } from "vitest";

import {
  DuplicateToolError,
  ToolRegistry,
} from "../src/tool-registry.js";
import {
  ToolExecutionError,
  ToolNotFoundError,
  executeTool,
} from "../src/tool-executor.js";
import { calculatorTool } from "../src/tools/calculator.js";
import { defineTool } from "../src/tools/types.js";
import { z } from "zod";

describe("ToolRegistry", () => {
  it("登记并列出白名单工具", () => {
    const registry = new ToolRegistry([calculatorTool]);

    expect(registry.get("calculator")).toBe(calculatorTool);
    expect(registry.list().map((tool) => tool.name)).toEqual(["calculator"]);
  });

  it("拒绝重复工具名称", () => {
    expect(
      () => new ToolRegistry([calculatorTool, calculatorTool]),
    ).toThrow(DuplicateToolError);
  });
});

describe("executeTool", () => {
  it("只执行注册表中的工具并记录轨迹信息", async () => {
    const registry = new ToolRegistry([calculatorTool]);

    await expect(
      executeTool(registry, {
        name: "calculator",
        arguments: { operation: "multiply", left: 6, right: 7 },
      }),
    ).resolves.toMatchObject({
      toolName: "calculator",
      input: { operation: "multiply", left: 6, right: 7 },
      output: { expression: "6 × 7", result: 42 },
      elapsedMs: expect.any(Number),
    });
  });

  it("拒绝调用未注册工具", async () => {
    await expect(
      executeTool(new ToolRegistry(), {
        name: "delete_everything",
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(ToolNotFoundError);
  });

  it("把工具内部异常转换为统一执行错误", async () => {
    const failingTool = defineTool({
      name: "failing_tool",
      description: "用于测试失败路径",
      inputSchema: z.object({}).strict(),
      execute() {
        throw new Error("内部实现细节");
      },
    });

    await expect(
      executeTool(new ToolRegistry([failingTool]), {
        name: "failing_tool",
        arguments: {},
      }),
    ).rejects.toMatchObject({
      name: "ToolExecutionError",
      toolName: "failing_tool",
      message: "工具 failing_tool 执行失败",
    } satisfies Partial<ToolExecutionError>);
  });
});
