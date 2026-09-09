import { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  invoke(rawInput: unknown): Promise<unknown>;
}

export interface ToolSpecification<
  TInputSchema extends z.ZodType,
  TResult,
> {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  execute(input: z.output<TInputSchema>): TResult | Promise<TResult>;
}

export class ToolInputValidationError extends Error {
  override readonly name = "ToolInputValidationError";

  constructor(
    readonly toolName: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(`工具 ${toolName} 的参数校验失败`);
  }
}

export function defineTool<
  TInputSchema extends z.ZodType,
  TResult,
>(
  specification: ToolSpecification<TInputSchema, TResult>,
): ToolDefinition {
  return {
    name: specification.name,
    description: specification.description,
    inputSchema: specification.inputSchema,
    async invoke(rawInput: unknown): Promise<unknown> {
      const parsed = specification.inputSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ToolInputValidationError(
          specification.name,
          parsed.error.issues,
        );
      }
      return specification.execute(parsed.data);
    },
  };
}
