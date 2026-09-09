import { describe, expect, it } from "vitest";

import { calculatorTool } from "../src/tools/calculator.js";
import { ToolInputValidationError } from "../src/tools/types.js";

describe("calculatorTool", () => {
  it.each([
    ["add", 12, 8, 20],
    ["subtract", 12, 8, 4],
    ["multiply", 12, 8, 96],
    ["divide", 12, 3, 4],
  ] as const)("执行 %s 运算", async (operation, left, right, expected) => {
    await expect(
      calculatorTool.invoke({ operation, left, right }),
    ).resolves.toMatchObject({ result: expected });
  });

  it("拒绝除以 0", async () => {
    await expect(
      calculatorTool.invoke({ operation: "divide", left: 12, right: 0 }),
    ).rejects.toBeInstanceOf(ToolInputValidationError);
  });

  it("拒绝未知操作、字符串数字和额外字段", async () => {
    await expect(
      calculatorTool.invoke({
        operation: "power",
        left: "2",
        right: 3,
        unsafe: true,
      }),
    ).rejects.toBeInstanceOf(ToolInputValidationError);
  });
});
