import { z } from "zod";

import { defineTool } from "./types.js";

export const calculatorInputSchema = z
  .object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    left: z.number().finite(),
    right: z.number().finite(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.operation === "divide" && input.right === 0) {
      context.addIssue({
        code: "custom",
        path: ["right"],
        message: "除数不能为 0",
      });
    }
  });

export type CalculatorInput = z.infer<typeof calculatorInputSchema>;

export interface CalculatorOutput {
  expression: string;
  result: number;
}

function calculate(input: CalculatorInput): CalculatorOutput {
  const operators = {
    add: "+",
    subtract: "-",
    multiply: "×",
    divide: "÷",
  } as const;

  let result: number;
  switch (input.operation) {
    case "add":
      result = input.left + input.right;
      break;
    case "subtract":
      result = input.left - input.right;
      break;
    case "multiply":
      result = input.left * input.right;
      break;
    case "divide":
      result = input.left / input.right;
      break;
  }

  return {
    expression: `${input.left} ${operators[input.operation]} ${input.right}`,
    result,
  };
}

export const calculatorTool = defineTool({
  name: "calculator",
  description: "执行两个有限数字之间的加、减、乘、除运算。",
  inputSchema: calculatorInputSchema,
  execute: calculate,
});
