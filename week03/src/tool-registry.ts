import type { ToolDefinition } from "./tools/types.js";

export class DuplicateToolError extends Error {
  override readonly name = "DuplicateToolError";

  constructor(readonly toolName: string) {
    super(`工具名称重复：${toolName}`);
  }
}

export class ToolRegistry {
  readonly #tools = new Map<string, ToolDefinition>();

  constructor(tools: readonly ToolDefinition[] = []) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  register(tool: ToolDefinition): void {
    if (this.#tools.has(tool.name)) {
      throw new DuplicateToolError(tool.name);
    }
    this.#tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.#tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.#tools.values()];
  }
}
