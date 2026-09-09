import { performance } from "node:perf_hooks";

import type { ToolRegistry } from "./tool-registry.js";
import { ToolInputValidationError } from "./tools/types.js";

export interface ToolCallRequest {
  name: string;
  arguments: unknown;
}

export interface ToolExecutionResult {
  toolName: string;
  input: unknown;
  output: unknown;
  elapsedMs: number;
}

export class ToolNotFoundError extends Error {
  override readonly name = "ToolNotFoundError";

  constructor(readonly toolName: string) {
    super(`不允许调用未知工具：${toolName}`);
  }
}

export class ToolExecutionError extends Error {
  override readonly name = "ToolExecutionError";

  constructor(
    readonly toolName: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export async function executeTool(
  registry: ToolRegistry,
  request: ToolCallRequest,
): Promise<ToolExecutionResult> {
  const tool = registry.get(request.name);
  if (!tool) {
    throw new ToolNotFoundError(request.name);
  }

  const startedAt = performance.now();
  try {
    const output = await tool.invoke(request.arguments);
    return {
      toolName: tool.name,
      input: request.arguments,
      output,
      elapsedMs: performance.now() - startedAt,
    };
  } catch (error: unknown) {
    if (error instanceof ToolInputValidationError) {
      throw error;
    }
    throw new ToolExecutionError(
      tool.name,
      `工具 ${tool.name} 执行失败`,
      { cause: error },
    );
  }
}
